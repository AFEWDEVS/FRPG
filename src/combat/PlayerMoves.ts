import Phaser from 'phaser';
import { EventBus } from '../core/EventBus';
import { GameState } from '../core/GameState';
import { CLASSES } from '../data/classes';
import { gridToWorld } from '../iso/iso';
import type { Enemy } from '../entities/Enemy';
import type { CombatSystem } from './CombatSystem';
import { rollPlayerDamage, type DamageInfo } from './damage';

/**
 * Heavy-combat moveset of the hero: stamina, 3-hit light combo with wind-up / active / recovery frames and 200 ms input
 * buffer, chargeable heavy attack, dodge roll with i-frames, block and parry, sprint, player stagger.
 * Timers run on game time (they freeze with hit-stop). CombatSystem owns one instance (c.moves).
 */
type St = 'idle' | 'windup' | 'active' | 'recover' | 'charge' | 'dodge' | 'stagger';

interface Swing { wind: number; act: number; rec: number; pct: number; poise: number; stop: number; cost: number; kb: number; imp: number; fin?: boolean; heavy?: boolean }

const COMBO: Record<'melee' | 'bolt' | 'arrow', Swing[]> = {
  melee: [
    { wind: 150, act: 90, rec: 250, pct: 88, poise: 20, stop: 50, cost: 8, kb: 0.35, imp: 0.35 },
    { wind: 140, act: 90, rec: 270, pct: 98, poise: 20, stop: 55, cost: 8, kb: 0.4, imp: 0.4 },
    { wind: 270, act: 130, rec: 430, pct: 165, poise: 46, stop: 115, cost: 13, kb: 1.2, imp: 0.9, fin: true },
  ],
  bolt: [
    { wind: 170, act: 60, rec: 230, pct: 82, poise: 13, stop: 40, cost: 7, kb: 0.25, imp: 0.25 },
    { wind: 160, act: 60, rec: 250, pct: 90, poise: 13, stop: 42, cost: 7, kb: 0.25, imp: 0.25 },
    { wind: 300, act: 80, rec: 450, pct: 165, poise: 40, stop: 100, cost: 12, kb: 0.9, imp: 0.7, fin: true },
  ],
  arrow: [
    { wind: 110, act: 50, rec: 210, pct: 72, poise: 11, stop: 40, cost: 6, kb: 0.2, imp: 0.2 },
    { wind: 110, act: 50, rec: 220, pct: 76, poise: 11, stop: 40, cost: 6, kb: 0.2, imp: 0.2 },
    { wind: 240, act: 70, rec: 400, pct: 150, poise: 38, stop: 95, cost: 11, kb: 0.8, imp: 0.65, fin: true },
  ],
};

export const STAMINA = {
  dodge: 22, heavy: 26, heavyStartMin: 12, chargeDrainPerS: 12, sprintPerS: 10, blockBase: 10, blockPerDmg: 0.5,
  regenDelay: 650, exhaustedDelay: 1000, exhaustedRecover: 0.25,
};
const DODGE = { dist: 3, ms: 340, iframes: 300, recover: 110 };
const CHARGE_MS = 1000;
const CLASS_GLOW: Record<string, number> = { knight: 0xffe9a0, mage: 0xe0a0ff, ranger: 0xa8ff90 };

export class PlayerMoves {
  state: St = 'idle';
  exhausted = false;
  blocking = false;
  sprinting = false;
  charge = 0;
  private clock = 0;
  private t = 0;
  private cur: Swing | null = null;
  private comboIdx = 0;
  private comboResetAt = 0;
  private aimed = { gx: 0, gy: 0 };
  private buffer: { gx: number; gy: number; until: number } | null = null;
  private chargeHeld = false;
  private heavyWanted: { gx: number; gy: number } | null = null;
  private blockHeld = false;
  private parryUntil = 0;
  private lastParryPress = -1e9;
  private iUntil = 0;
  private lastSpend = -1e9;
  private lastEmit = 0;
  private lastSent = -1;
  private lastExhaustFx = -1e9;
  private lastDodgeFx = -1e9;
  private lastChargeFx = 0;
  private lastChargeEmit = -1;
  private chargeFull = false;
  private glow?: Phaser.GameObjects.Image;
  private shield?: Phaser.GameObjects.Image;
  private sprintWant = false;
  private lastTrail = 0;

  constructor(private c: CombatSystem) {
    GameState.stamina = Math.min(GameState.stamina, c.derived.maxStamina);
  }

  // ------------------------------------------------------------ queries
  get iframes(): boolean { return this.clock < this.iUntil; }
  get maxStamina(): number { return this.c.derived.maxStamina; }
  /** Movement locked by a committed action. */
  get locked(): boolean {
    const s = this.state;
    if (s === 'windup' || s === 'active' || s === 'charge' || s === 'dodge' || s === 'stagger') return true;
    return s === 'recover' && !!this.cur && this.t > this.recMs(this.cur) * 0.5;
  }
  /** True while a swing / heavy is in wind-up or active frames (armored if heavy). */
  get committed(): boolean { return this.state === 'windup' || this.state === 'active' || this.state === 'charge'; }
  speedMul(): number {
    let m = 1;
    if (this.exhausted) m *= 0.7;
    if (this.sprinting) m *= 1.45;
    if (this.blocking) m *= 0.45;
    if (this.state === 'charge') m *= 0;
    return m;
  }
  canCast(): boolean { return this.state === 'idle' || this.state === 'recover'; }
  onSkillStart(): void { if (this.state === 'recover') { this.state = 'idle'; this.cur = null; this.buffer = null; } }

  private speedFactor(): number {
    const cls = CLASSES[GameState.profile.classId];
    const d = this.c.derived;
    return (cls.basic === 'bolt' ? d.castSpeed : d.attackSpeed) / (this.exhausted ? 1.35 : 1);
  }
  private recMs(s: Swing): number { return s.rec / this.speedFactor(); }

  // ------------------------------------------------------------ stamina
  spend(n: number): void {
    GameState.stamina = Math.max(0, GameState.stamina - n);
    this.lastSpend = this.clock;
    if (GameState.stamina <= 0 && !this.exhausted) this.setExhausted(true);
  }
  refund(n: number): void { GameState.stamina = Math.min(this.maxStamina, GameState.stamina + n); }

  private setExhausted(on: boolean): void {
    this.exhausted = on;
    if (!on) return;
    const p = this.c.player;
    if (this.sprinting) this.sprinting = false;
    this.cancelAction();
    if (this.clock - this.lastExhaustFx > 3500) {
      this.lastExhaustFx = this.clock;
      EventBus.emit('emote:show', { target: 'player', name: 'sweat' });
      this.c.vfx.floatingText('¡Sin aliento!', p.x, p.y - 140, { size: 16, color: '#bfe8ff' });
    }
    this.emitStamina(true);
  }

  private emitStamina(force = false): void {
    const s = Math.round(GameState.stamina * 2) / 2;
    if (!force && (s === this.lastSent || performance.now() - this.lastEmit < 90)) return;
    this.lastSent = s; this.lastEmit = performance.now();
    EventBus.emit('player:stamina', { stamina: GameState.stamina, max: this.maxStamina, exhausted: this.exhausted });
  }

  // ------------------------------------------------------------ per-frame
  update(dt: number): void {
    const c = this.c, p = c.player;
    this.clock += dt;
    if (p.dead) { this.reset(); return; }
    if (c.now < c.stunUntil && this.committed) this.cancelAction();
    const max = this.maxStamina;
    if (GameState.stamina > max) GameState.stamina = max;

    // regen
    const delay = this.exhausted ? STAMINA.exhaustedDelay : STAMINA.regenDelay;
    if (this.clock - this.lastSpend > delay && this.state !== 'charge') {
      const k = this.blocking ? 0.3 : this.sprinting ? 0 : 1;
      GameState.stamina = Math.min(max, GameState.stamina + c.derived.staminaRegen * k * dt / 1000);
    }
    if (this.exhausted && GameState.stamina >= max * STAMINA.exhaustedRecover) this.exhausted = false;

    // sprint
    const moving = p.hasPath && !p.dashing;
    this.sprinting = this.sprintWant && !this.exhausted && moving && this.state === 'idle' && GameState.stamina > 0 && !this.blocking;
    if (this.sprinting) this.spend(STAMINA.sprintPerS * dt / 1000);

    // block start / end
    const canBlock = !this.exhausted && (this.state === 'idle' || this.state === 'recover') && !this.chargeHeld;
    if (this.blockHeld && !this.blocking && canBlock) {
      if (this.state === 'recover') { this.state = 'idle'; this.cur = null; this.buffer = null; }
      this.blocking = true;
      c.player.stop();
      this.setShield(true);
    } else if (this.blocking && (!this.blockHeld || !canBlock)) { this.blocking = false; this.setShield(false); }

    // state machine
    switch (this.state) {
      case 'idle':
        if (this.clock > this.comboResetAt) this.comboIdx = 0;
        if (this.heavyWanted && this.chargeHeld && !this.blocking) { const h = this.heavyWanted; this.heavyWanted = null; this.beginCharge(h.gx, h.gy); }
        break;
      case 'windup':
        this.t -= dt;
        if (this.t <= 0 && this.cur) { this.strike(this.cur); this.state = 'active'; this.t = this.cur.act / this.speedFactor(); }
        break;
      case 'active':
        this.t -= dt;
        if (this.t <= 0 && this.cur) { this.state = 'recover'; this.t = this.recMs(this.cur); this.comboResetAt = this.clock + this.t + 450; }
        break;
      case 'recover':
        this.t -= dt;
        if (this.t <= 0) {
          this.state = 'idle';
          const b = this.buffer;
          this.buffer = null;
          if (this.chargeHeld && this.heavyWanted) break;
          if (b && b.until >= this.clock && !this.blockHeld && c.now >= c.castUntil) this.startLight(b.gx, b.gy);
        }
        break;
      case 'charge': this.updateCharge(dt); break;
      case 'dodge': case 'stagger':
        this.t -= dt;
        if (this.t <= 0) this.state = 'idle';
        break;
    }
    if (this.state !== 'charge' && this.glow) this.dropGlow();
    this.emitStamina();
  }

  reset(): void {
    this.state = 'idle'; this.cur = null; this.buffer = null; this.blocking = false; this.chargeHeld = false; this.heavyWanted = null;
    this.setShield(false); this.dropGlow();
  }

  /** Abort anything in progress (stun, exhaustion, taking a skill cast). */
  cancelAction(): void {
    if (this.state === 'charge') this.dropGlow();
    if (this.state === 'windup' || this.state === 'active' || this.state === 'charge' || this.state === 'recover') { this.state = 'idle'; this.cur = null; }
    this.buffer = null; this.heavyWanted = null;
  }

  // ------------------------------------------------------------ light combo
  /** Request a light attack (auto-attack loop or click). Starts it, or buffers it for 200 ms while busy. */
  light(gx: number, gy: number): boolean {
    const c = this.c;
    if (c.player.dead || this.blockHeld || this.chargeHeld || c.now < c.castUntil) return false;
    if (this.state === 'idle') { this.startLight(gx, gy); return true; }
    if (this.state === 'windup' || this.state === 'active' || this.state === 'recover') { this.buffer = { gx, gy, until: this.clock + 200 }; return true; }
    return false;
  }

  private startLight(gx: number, gy: number): void {
    const cls = CLASSES[GameState.profile.classId];
    const seq = COMBO[cls.basic];
    if (this.clock > this.comboResetAt) this.comboIdx = 0;
    const sw = seq[this.comboIdx % seq.length];
    this.comboIdx = (this.comboIdx + 1) % seq.length;
    this.spend(sw.cost);
    this.beginSwing(sw, gx, gy);
  }

  private beginSwing(sw: Swing, gx: number, gy: number): void {
    const c = this.c, p = c.player;
    const a = c.aim(gx, gy);
    p.stop();
    p.faceGrid(a.dx, a.dy);
    this.aimed = { gx: a.dx, gy: a.dy };
    this.cur = sw;
    this.state = 'windup';
    const f = this.speedFactor();
    this.t = sw.wind / f;
    const total = (sw.wind + sw.act) / f + this.recMs(sw);
    const w = gridToWorld(a.dx, a.dy);
    const k = sw.fin || sw.heavy ? 1.5 : 1;
    p.anim.attackLunge(w.x * k, w.y * k, sw.act / f + 70, Math.min(520, total), sw.wind / f);
    c.sfx('sword_swing_2', { volume: 0.12, pitchVar: 0.1 });
  }

  /** Active frames start: deal the hit / spawn the projectile. */
  private strike(sw: Swing): void {
    const c = this.c, p = c.player;
    const cls = CLASSES[GameState.profile.classId];
    const { gx: dx, gy: dy } = this.aimed;
    const w = gridToWorld(dx, dy);
    const ang = Math.atan2(w.y, w.x);
    const cx = p.x, cy = p.y - 45;
    if (sw.heavy) { this.strikeHeavy(sw, dx, dy, ang, cx, cy); return; }
    if (cls.basic === 'melee') {
      const mirror = this.comboIdx === 0 ? 0.55 : this.comboIdx === 2 ? -0.55 : 0; // comboIdx already advanced
      c.sfx(sw.fin ? 'sword_swing' : 'sword_swing_2', { volume: sw.fin ? 0.9 : 0.7, pitchVar: 0.08 });
      c.vfx.slashArc(cx + w.x * 0.25, cy + w.y * 0.25, ang + mirror, { size: sw.fin ? 290 : 195, ms: sw.fin ? 260 : 200 });
      this.trailSweep(cx, cy, ang, sw.fin ? 3 : 2);
      const reach = sw.fin ? 2.5 : 2.0, arc = sw.fin ? -0.35 : 0.2;
      for (const e of c.hostiles()) {
        const ex = e.gx - p.gx, ey = e.gy - p.gy, dist = Math.hypot(ex, ey);
        if (dist > reach + e.radius) continue;
        if (dist > 0.6 && (ex * dx + ey * dy) / dist < arc) continue;
        c.playerHit(e, sw.pct, 'physical', { knockback: sw.kb, poise: sw.poise, hitStop: sw.stop, weight: 1, impulse: sw.imp });
      }
      if (sw.fin) { c.vfx.shockwave(p.x + w.x * 0.6, p.y + w.y * 0.6, { radius: 170, duration: 300 }); c.impulse(dx, dy, 0.5); }
    } else if (cls.basic === 'bolt') {
      c.sfx('fireball_cast', { volume: sw.fin ? 0.6 : 0.35 });
      c.vfx.flash(cx + w.x * 0.2, cy, { element: 'arcane', size: sw.fin ? 130 : 80, ms: 150 });
      const r = rollPlayerDamage(c.derived, sw.pct);
      c.spawnProjectile({
        owner: 'player', gx: p.gx, gy: p.gy, dx, dy, speed: sw.fin ? 11 : 15, range: 13, radius: sw.fin ? 0.6 : 0.45, element: 'arcane', size: sw.fin ? 1.15 : 0.7, light: 90, height: 48,
        onHit: (pr, tg) => {
          c.vfx.impact(pr.worldX, pr.worldY, 'arcane', !!tg || sw.fin === true);
          if (tg && tg !== 'player') {
            c.damageEnemy(tg, { amount: r.amount, type: 'lightning', crit: r.crit, from: p, knockback: sw.kb, color: r.crit ? undefined : '#e0b8ff', silent: true, poise: sw.poise, hitStop: sw.stop, weight: 1, impulse: sw.imp });
            c.sfx('lightning', { volume: 0.35 });
          }
        },
      });
    } else {
      c.sfx('arrow_shoot', { volume: sw.fin ? 0.8 : 0.55, pitchVar: 0.1 });
      this.trailSweep(cx, cy, ang, 1);
      const r = rollPlayerDamage(c.derived, sw.pct);
      c.spawnProjectile({
        owner: 'player', gx: p.gx, gy: p.gy, dx, dy, speed: sw.fin ? 27 : 21, range: 15, radius: 0.35, element: 'physical', kind: 'arrow', height: 46, pierce: sw.fin ? 1 : 0,
        onHit: (pr, tg) => {
          if (tg && tg !== 'player') { c.damageEnemy(tg, { amount: r.amount, type: 'physical', crit: r.crit, from: p, knockback: sw.kb, silent: true, poise: sw.poise, hitStop: sw.stop, weight: 1, impulse: sw.imp }); c.sfx('arrow_hit', { volume: 0.6 }); }
          else c.vfx.impact(pr.worldX, pr.worldY, 'physical', false);
        },
      });
    }
  }

  private trailSweep(cx: number, cy: number, ang: number, n: number): void {
    const c = this.c;
    for (let i = 0; i < n * 2; i++) {
      const a = ang - 0.7 + (1.4 * i) / (n * 2 - 1 || 1);
      c.after(i * 22, () => c.vfx.trail(cx + Math.cos(a) * 56, cy + Math.sin(a) * 30, 'physical', 0.8));
    }
  }

  // ------------------------------------------------------------ heavy attack
  heavyStart(gx: number, gy: number, targetId?: string): void {
    const c = this.c, p = c.player;
    if (p.dead) return;
    if (targetId) {
      const t = c.enemyById(targetId);
      if (t && p.distanceTo(t) > 4.5) return; // too far: keep walking to it
    }
    this.chargeHeld = true;
    this.heavyWanted = { gx, gy };
    this.buffer = null;
  }

  heavyRelease(gx: number, gy: number): void {
    this.chargeHeld = false;
    this.heavyWanted = null;
    if (this.state !== 'charge') return;
    this.releaseHeavy(gx, gy);
  }

  private beginCharge(gx: number, gy: number): void {
    const c = this.c, p = c.player;
    if (this.exhausted || GameState.stamina < STAMINA.heavyStartMin) {
      this.chargeHeld = false;
      if (!this.exhausted) { EventBus.emit('emote:show', { target: 'player', name: 'sweat' }); c.vfx.floatingText('Sin aguante', p.x, p.y - 140, { size: 15, color: '#bfe8ff' }); }
      return;
    }
    const a = c.aim(gx, gy);
    p.stop(); p.faceGrid(a.dx, a.dy);
    this.aimed = { gx: a.dx, gy: a.dy };
    this.state = 'charge'; this.charge = 0; this.chargeFull = false;
    const col = CLASS_GLOW[GameState.profile.classId] ?? 0xffe9a0;
    this.glow = c.scene.add.image(0, -55, 'vfx_flare').setBlendMode(Phaser.BlendModes.ADD).setTint(col).setScale(0.1).setAlpha(0.8);
    p.add(this.glow);
    c.sfx('buff', { volume: 0.3, pitchVar: 0.02 });
    p.anim.squash(1.08, 0.9);
  }

  private updateCharge(dt: number): void {
    const c = this.c, p = c.player;
    this.charge = Math.min(1, this.charge + dt / CHARGE_MS);
    this.spend(STAMINA.chargeDrainPerS * dt / 1000 * (this.charge >= 1 ? 0.3 : 1));
    const pulse = 1 + 0.12 * Math.sin(this.clock / 55);
    if (this.glow) { this.glow.setScale((0.12 + 0.55 * this.charge) * pulse).setAlpha(0.55 + 0.4 * this.charge); }
    p.anim.squash(1 + 0.03 * Math.sin(this.clock / 40), 1 - 0.07 * this.charge);
    if (this.clock - this.lastChargeFx > 120) {
      this.lastChargeFx = this.clock;
      const col = CLASS_GLOW[GameState.profile.classId] ?? 0xffe9a0;
      c.vfx.emit('stars', p.x + (Math.random() - 0.5) * 70, p.y - 20 - Math.random() * 60, 1, { tint: col, scale: 0.1 + 0.1 * this.charge, speed: [5, 25], life: 400 });
    }
    if (this.charge >= 1 && !this.chargeFull) {
      this.chargeFull = true;
      c.vfx.shockwave(p.x, p.y, { radius: 130, duration: 260 });
      c.vfx.flash(p.x, p.y - 55, { size: 140, ms: 200 });
      c.sfx('heart_sparkle', { volume: 0.5 });
      c.vfx.screenShake(0.002, 70);
    }
    const q = Math.round(this.charge * 20);
    if (q !== this.lastChargeEmit) { this.lastChargeEmit = q; EventBus.emit('player:charge', { value: this.charge }); }
    const aimG = { gx: this.aimed.gx + p.gx, gy: this.aimed.gy + p.gy };
    if (GameState.stamina <= 0 || !this.chargeHeld) this.releaseHeavy(aimG.gx, aimG.gy);
    else if (this.charge >= 1 && this.clock - this.lastSpend > 2200) this.releaseHeavy(aimG.gx, aimG.gy);
  }

  private releaseHeavy(gx: number, gy: number): void {
    const ch = this.charge;
    this.dropGlow();
    this.chargeHeld = false;
    EventBus.emit('player:charge', { value: 0 });
    this.spend(STAMINA.heavy * (0.5 + 0.5 * ch));
    const sw: Swing = { wind: 140, act: 140, rec: 560, pct: 210 + 230 * ch, poise: 85 + 90 * ch, stop: 95 + 30 * ch, cost: 0, kb: 2.0 + 0.8 * ch, imp: 1.1 + 0.5 * ch, heavy: true };
    this.state = 'idle';
    this.beginSwing(sw, gx, gy);
  }

  private strikeHeavy(sw: Swing, dx: number, dy: number, ang: number, cx: number, cy: number): void {
    const c = this.c, p = c.player;
    const cls = CLASSES[GameState.profile.classId];
    const w = gridToWorld(dx, dy);
    const full = sw.pct > 380;
    c.impulse(dx, dy, sw.imp);
    const base: Partial<DamageInfo> = { knockback: sw.kb, poise: sw.poise, hitStop: sw.stop, weight: 1, impulse: sw.imp, heavy: true };
    if (cls.basic === 'melee') {
      c.sfx('sword_swing', { volume: 1, pitchVar: 0.04 });
      c.sfx('sword_hit_2', { volume: 0.5 });
      c.vfx.slashArc(cx + w.x * 0.3, cy + w.y * 0.3, ang, { size: 360, ms: 300 });
      this.trailSweep(cx, cy, ang, 4);
      const fx = p.x + w.x * 0.9, fy = p.y + w.y * 0.9;
      c.vfx.explosion(fx, fy, { element: 'physical', radius: 90, power: 0.9, shake: false });
      c.vfx.shockwave(fx, fy, { radius: 280, duration: 380 });
      for (const e of c.hostiles()) {
        const ex = e.gx - p.gx, ey = e.gy - p.gy, dist = Math.hypot(ex, ey);
        if (dist > 2.8 + e.radius) continue;
        if (dist > 0.6 && (ex * dx + ey * dy) / dist < -0.15) continue;
        c.playerHit(e, sw.pct, 'physical', base);
      }
    } else if (cls.basic === 'bolt') {
      c.sfx('fireball_cast', { volume: 0.9 });
      c.vfx.flash(cx + w.x * 0.2, cy, { element: 'arcane', size: 190, ms: 220 });
      const r = rollPlayerDamage(c.derived, sw.pct);
      c.spawnProjectile({
        owner: 'player', gx: p.gx, gy: p.gy, dx, dy, speed: 9.5, range: 13, radius: 0.8, element: 'arcane', size: 1.8, light: 160, height: 50,
        onHit: (pr, tg) => {
          const R = 2.1;
          c.vfx.explosion(pr.worldX, pr.worldY, { element: 'arcane', radius: R * 45, power: 1.3, shake: false });
          c.vfx.shockwave(pr.worldX, pr.worldY, { element: 'arcane', radius: R * 100, duration: 400 });
          c.sfx('fire_explosion', { volume: 0.7 });
          let first = true;
          for (const e of c.enemiesInCircle(pr.gx, pr.gy, R)) {
            c.damageEnemy(e, { ...base, amount: r.amount * (first ? 1 : 0.7), type: 'lightning', crit: r.crit, from: pr, color: '#e0b8ff', silent: !first, impulse: first ? sw.imp : 0.3 } as DamageInfo);
            first = false;
          }
          void tg;
        },
      });
    } else {
      c.sfx('arrow_shoot', { volume: 1, pitchVar: 0.03 });
      c.vfx.shockwave(p.x, p.y, { radius: 120, duration: 240 });
      this.trailSweep(cx, cy, ang, 2);
      const r = rollPlayerDamage(c.derived, sw.pct);
      c.spawnProjectile({
        owner: 'player', gx: p.gx, gy: p.gy, dx, dy, speed: 30, range: 16, radius: 0.5, element: 'physical', kind: 'arrow', size: 1.4, height: 46, pierce: 3,
        onHit: (pr, tg) => {
          if (tg && tg !== 'player') { c.damageEnemy(tg, { ...base, amount: r.amount, type: 'physical', crit: r.crit, from: p, silent: true } as DamageInfo); c.sfx('sword_hit_2', { volume: 0.7 }); }
          else c.vfx.impact(pr.worldX, pr.worldY, 'physical', true);
        },
      });
    }
    if (full) c.vfx.zoomPunch(1.04, 90, 80, 260);
  }

  private dropGlow(): void { if (this.glow) { this.glow.destroy(); this.glow = undefined; } }

  // ------------------------------------------------------------ dodge roll
  dodge(gx: number, gy: number): void {
    const c = this.c, p = c.player;
    if (p.dead || p.dashing || this.state === 'dodge' || this.state === 'stagger' || this.state === 'active') return;
    if (c.now < c.stunUntil) return;
    if (this.exhausted || GameState.stamina <= 0) {
      if (this.clock - this.lastDodgeFx > 800) { this.lastDodgeFx = this.clock; EventBus.emit('emote:show', { target: 'player', name: 'sweat' }); c.vfx.floatingText('¡Sin aliento!', p.x, p.y - 140, { size: 15, color: '#bfe8ff' }); }
      return;
    }
    // direction: toward the pointer / stick; fallback to current facing
    let dx = gx - p.gx, dy = gy - p.gy;
    if (Math.hypot(dx, dy) < 0.3) { dx = p.facingLeft ? -1 : 1; dy = p.facingLeft ? 1 : -1; }
    const l = Math.hypot(dx, dy); dx /= l; dy /= l;
    this.cancelAction();
    if (this.charge > 0) { this.charge = 0; EventBus.emit('player:charge', { value: 0 }); }
    this.chargeHeld = false;
    c.castUntil = c.now; // dodge cancels casts (the timed-cast callback sees p.dashing)
    this.blocking = false; this.setShield(false);
    this.spend(STAMINA.dodge);
    const end = c.clampWalkable(p.gx, p.gy, p.gx + dx, p.gy + dy, DODGE.dist);
    this.state = 'dodge';
    this.t = DODGE.ms + DODGE.recover;
    this.iUntil = this.clock + DODGE.iframes;
    p.faceGrid(dx, dy);
    const w = gridToWorld(dx, dy);
    c.sfx('sword_swing_2', { volume: 0.4, pitchVar: 0.25 });
    c.sfx('footstep_grass', { volume: 0.5 });
    c.vfx.emit('smoke', p.x, p.y - 8, 5, { tint: 0xd8c8b0, scale: 0.25, scaleEnd: 0.7, alpha: 0.5, life: 520, speed: [20, 70] });
    p.dashTo(end.fx, end.fy, DODGE.ms, () => {
      c.vfx.emit('smoke', p.x, p.y - 8, 4, { tint: 0xd8c8b0, scale: 0.3, scaleEnd: 0.8, alpha: 0.5, life: 480, speed: [15, 50] });
      p.anim.squash(1.25, 0.78);
    }, () => {
      if (this.clock - this.lastTrail > 45) { this.lastTrail = this.clock; c.vfx.emit('smoke', p.x, p.y - 6, 1, { tint: 0xd8c8b0, scale: 0.18, scaleEnd: 0.5, alpha: 0.4, life: 380, speed: [0, 12] }); }
    }, 'Sine.easeOut');
    p.anim.roll(w.x, w.y, DODGE.ms);
    this.emitStamina(true);
  }

  // ------------------------------------------------------------ block / parry / sprint
  setBlock(down: boolean): void {
    this.blockHeld = down;
    if (down && !this.exhausted && this.clock - this.lastParryPress > 420) { this.lastParryPress = this.clock; this.parryUntil = this.clock + 150; }
  }
  setSprint(on: boolean): void { this.sprintWant = on; }

  private setShield(on: boolean): void {
    const p = this.c.player;
    if (on && !this.shield) {
      this.shield = this.c.scene.add.image(0, -50, 'vfx_light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xbfe8ff).setScale(0.55).setAlpha(0.35);
      p.add(this.shield);
    } else if (!on && this.shield) { this.shield.destroy(); this.shield = undefined; }
  }

  /** Called by CombatSystem.damagePlayer before damage is applied. negated = nothing gets through. */
  filterIncoming(info: DamageInfo, amount: number, src?: Enemy): { negated: boolean; amount: number } {
    const c = this.c, p = c.player;
    if (info.pure || info.dot) return { negated: false, amount };
    if (this.iframes) {
      if (this.clock - this.lastDodgeFx > 250) {
        this.lastDodgeFx = this.clock;
        c.vfx.floatingText('¡Esquiva!', p.x, p.y - 135, { size: 16, color: '#bfe8ff' });
        c.vfx.emit('stars', p.x, p.y - 50, 4, { tint: 0xbfe8ff, scale: 0.1, speed: [30, 90], life: 360 });
        this.refund(8);
      }
      return { negated: true, amount: 0 };
    }
    if (this.clock < this.parryUntil && !this.exhausted) {
      this.parryUntil = 0;
      this.onParry(src, info);
      return { negated: true, amount: 0 };
    }
    if (this.blocking) {
      const cost = STAMINA.blockBase + amount * STAMINA.blockPerDmg;
      const shield = !!GameState.profile.equipment.offhand;
      const w = src ? gridToWorld(p.gx - src.gx, p.gy - src.gy) : { x: 1, y: 0 };
      if (GameState.stamina < cost) {
        this.spend(GameState.stamina); // guard break
        this.blocking = false; this.setShield(false);
        c.vfx.floatingText('¡Guardia rota!', p.x, p.y - 135, { size: 17, color: '#ff9a7a' });
        return { negated: false, amount };
      }
      this.spend(cost);
      c.vfx.fx.hitSpark(p.x, p.y - 55, Math.atan2(w.y, w.x), 'physical', false);
      c.sfx('sword_hit', { volume: 0.7 });
      c.vfx.floatingText('Bloqueo', p.x, p.y - 135, { size: 14, color: '#cfe8ff', duration: 600 });
      c.vfx.screenShake(0.003, 80);
      p.anim.squash(1.12, 0.9);
      c.vfx.hitStop(45);
      return { negated: false, amount: Math.max(1, Math.round(amount * (shield ? 0.3 : 0.5))) };
    }
    return { negated: false, amount };
  }

  private onParry(src: Enemy | undefined, info: DamageInfo): void {
    const c = this.c, p = c.player;
    this.refund(18);
    EventBus.emit('emote:show', { target: 'player', name: 'sparkle' });
    EventBus.emit('player:parry');
    c.sfx('sword_hit_2', { volume: 0.9 });
    c.sfx('heart_sparkle', { volume: 0.6 });
    c.vfx.floatingText('¡PARADA!', p.x, p.y - 145, { size: 22, color: '#ffe680', duration: 900 });
    c.vfx.screenFlash(0xffd860, 120, 0.45);
    c.vfx.impact(p.x, p.y - 55, 'holy', true);
    c.vfx.shockwave(p.x, p.y - 20, { element: 'holy', radius: 190, duration: 320 });
    c.vfx.hitStop(95);
    c.slowMo(150, 0.15);
    p.anim.squash(1.18, 0.86);
    const from = src ?? (info.from as { gx: number; gy: number } | undefined);
    if (from) c.impulse(p.gx - from.gx, p.gy - from.gy, 0.7);
    if (src && !src.dead) {
      if (src.def.boss) src.addPoise(-src.maxPoise * 0.4);
      else src.stagger(1300, true);
      if (src.distanceTo(p) < 4) src.knockFrom(p, 0.8);
    }
  }

  // ------------------------------------------------------------ being hit
  /** After damage was applied (post block). Staggers the hero on heavy hits unless armored mid-attack. */
  afterHit(amount: number, info: DamageInfo, src?: Enemy): void {
    const c = this.c, p = c.player;
    if (p.dead) return;
    const heavy = info.heavy || amount >= c.derived.maxLife * 0.16;
    if (!heavy) return;
    const armored = (this.committed && c.armor >= 20) || (!!this.cur?.heavy && (this.state === 'windup' || this.state === 'active'));
    if (armored) { p.anim.squash(1.12, 0.9); return; }
    this.stagger(src ?? (info.from as { gx: number; gy: number } | undefined));
  }

  stagger(from?: { gx: number; gy: number }): void {
    const c = this.c, p = c.player;
    if (this.state === 'stagger' || p.dashing) return;
    this.cancelAction();
    this.chargeHeld = false;
    this.blocking = false; this.setShield(false);
    c.castUntil = c.now;
    this.state = 'stagger';
    this.t = 460;
    p.stop();
    EventBus.emit('player:staggered');
    EventBus.emit('emote:show', { target: 'player', name: 'dots' });
    const dx = from ? p.gx - from.gx : (p.facingLeft ? 1 : -1), dy = from ? p.gy - from.gy : 0;
    const end = c.clampWalkable(p.gx, p.gy, p.gx + dx, p.gy + dy, 1.2);
    p.dashTo(end.fx, end.fy, 240, undefined, undefined, 'Quad.easeOut');
    c.vfx.screenShake(0.008, 140);
  }
}
