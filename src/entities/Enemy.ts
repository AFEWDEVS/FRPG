import Phaser from 'phaser';
import type { CombatSystem } from '../combat/CombatSystem';
import { createBossBrain, type BossBrain } from '../combat/bosses';
import { CHAMPION_AFFIXES, ENEMIES, enemyDmgMult, enemyHpMult, enemyXpMult, type EnemyDef } from '../data/enemies';
import { gridToWorld } from '../iso/iso';
import type { Element } from '../vfx/VfxManager';
import { Entity } from './Entity';
import type { Player } from './Player';

export interface EnemySpawn {
  defId: string;
  gx: number;
  gy: number;
  champion?: boolean;
  affixes?: string[];
  /** Explicit level; otherwise Enemy.areaLevel (+0..1). */
  level?: number;
}

type WalkFn = (i: number, j: number) => boolean;
type State = 'idle' | 'chase' | 'windup' | 'recover' | 'flee' | 'dash';

export interface AiTarget { gx: number; gy: number; radius: number; ref: Enemy | Player; isPlayer: boolean; }

const BOSS_LEVEL: Record<string, number> = { thorn_queen: 6, ogre_poet: 9, jealous_gargoyle: 15, malvarron: 20 };

/**
 * Enemy with a small AI state machine (idle/wander -> chase -> telegraphed attack -> recover), status effects,
 * champion affixes, shields and charm support. Bosses delegate to a BossBrain (combat/bosses.ts).
 * `ctx` is assigned by CombatSystem.register().
 */
export class Enemy extends Entity {
  /** Base level for enemies spawned in the current area (set by GameScene before spawning). */
  static areaLevel = 1;

  readonly def: EnemyDef;
  readonly champion: boolean;
  readonly affixes: string[];
  readonly level: number;
  dead = false;
  /** Set by charm effects (Serenata): fights for the player. */
  charmed = false;
  charmUntil = 0;
  ctx!: CombatSystem;
  // status
  stunUntil = 0;
  slowUntil = 0;
  slowMult = 1;
  rootUntil = 0;
  burnUntil = 0;
  burnDps = 0;
  /** Boss intro / phase transitions. */
  invulnerable = false;
  /** Incoming damage multiplier (stone skin). */
  dmgMult = 1;
  shield = 0;
  maxShield = 0;
  aggro = false;
  brain?: BossBrain;

  private aiState: State = 'idle';
  private stateT = 0;
  private cdT = 0;
  private home: { gx: number; gy: number };
  private wanderT = 1000 + Math.random() * 2500;
  private wanderGoal: { gx: number; gy: number } | null = null;
  private aggroRange: number;
  private winding?: { x: number; y: number; target: AiTarget };
  private tele?: { destroy: () => void };
  private auraFx?: { destroy: () => void };
  private shieldImg?: Phaser.GameObjects.Image;
  private bar?: Phaser.GameObjects.Graphics;
  private fled = false;
  private fleeT = 0;
  private dashV?: { dx: number; dy: number; left: number; hit: boolean; target: AiTarget };
  private knock?: { vx: number; vy: number; ms: number };
  private burnAcc = 0;
  private fieryT = 0;
  private kissT = 2500 + Math.random() * 3000;
  private heartT = 0;
  private bossHpSent = -1;
  private speedAffix = 1;

  constructor(scene: Phaser.Scene, s: EnemySpawn, private walk: WalkFn) {
    const def = ENEMIES[s.defId] ?? ENEMIES.goblin;
    super(scene, { kind: 'enemy', textureKey: def.textureKey, gx: s.gx + 0.5, gy: s.gy + 0.5, scale: def.scale, radius: 0.6 * def.scale });
    this.def = def;
    this.champion = !!s.champion && !def.boss;
    this.affixes = this.champion ? (s.affixes ?? []) : [];
    this.home = { gx: this.gx, gy: this.gy };
    this.level = s.level ?? (BOSS_LEVEL[def.id] ?? Math.max(1, Enemy.areaLevel + (Math.random() < 0.4 ? 1 : 0)));
    const hpMult = def.boss ? 1 + 0.05 * (this.level - 1) : enemyHpMult(this.level);
    this.maxHp = this.hp = Math.round(def.hp * hpMult * (this.champion ? 2.5 : 1));
    this.speedAffix = this.affixes.includes('fast') ? 1.35 : 1;
    this.speed = def.speed * (this.affixes.includes('fast') ? 1.3 : 1);
    this.aggroRange = def.aggro ?? 8;
    if (def.tint !== undefined) { this.sprite.setTint(def.tint); this.anim.baseTint = def.tint; }
    if (def.alpha !== undefined) this.sprite.setAlpha(def.alpha);
    if (this.champion) {
      this.sprite.setTint(0x88aaff);
      this.anim.baseTint = 0x88aaff;
      const names = this.affixes.map((a) => CHAMPION_AFFIXES.find((c) => c.id === a)?.name ?? a).join(' ');
      this.addLabel(`${def.name} (${names})`, '#7fa6ff');
      if (this.affixes.includes('shielded')) { this.maxShield = this.shield = Math.round(this.maxHp * 0.6); }
    } else if (def.boss) {
      this.addLabel(def.name, '#ffd24a');
    }
    this.bar = scene.add.graphics();
    this.add(this.bar);
  }

  /** Called by CombatSystem once `ctx` is set: builds VFX and brains. */
  init(): void {
    const v = this.ctx.vfx;
    if (this.champion) {
      const a = this.affixes;
      const el: Element = a.includes('fiery') ? 'fire' : a.includes('lovesick') ? 'love' : a.includes('frozen') ? 'ice' : a.includes('explosive') ? 'fire' : 'ice';
      this.auraFx = v.aura(this, { element: el, tex: el === 'fire' ? 'fire' : el === 'love' ? 'heart' : 'light', height: 40 * this.def.scale, scale: 0.3 });
      v.glow(this.sprite, el === 'fire' ? 0xff7a1e : el === 'love' ? 0xff6aae : 0x5588ff, 3);
    }
    if (this.maxShield > 0 && this.scene.textures.exists('vfx_light')) {
      this.shieldImg = this.scene.add.image(0, -this.sprite.displayHeight * 0.5, 'vfx_light').setTint(0x66aaff).setBlendMode(Phaser.BlendModes.ADD)
        .setScale(this.sprite.displayHeight / 150).setAlpha(0.55);
      this.add(this.shieldImg);
      this.scene.tweens.add({ targets: this.shieldImg, alpha: 0.3, yoyo: true, repeat: -1, duration: 700 });
    }
    if (this.def.boss) this.brain = createBossBrain(this, this.ctx);
    this.drawBar();
  }

  setMoving(b: boolean): void { this.moving = b; }
  get isBoss(): boolean { return !!this.def.boss; }
  get center(): { x: number; y: number } { return { x: this.x, y: this.y - this.sprite.displayHeight * 0.5 }; }
  get effSpeed(): number {
    const t = this.scene.time.now;
    if (t < this.rootUntil) return 0;
    return this.speed * (t < this.slowUntil ? this.slowMult : 1);
  }

  // ------------------------------------------------------------ damage

  /** Reduce raw damage by armor / resists / stone skin. */
  mitigate(amount: number, type: 'physical' | 'fire' | 'cold' | 'lightning', pure?: boolean, attackerLevel = 1): number {
    let a = amount;
    if (!pure) {
      if (type === 'physical') { const ar = this.def.armor ?? 0; a *= 1 - Math.min(0.85, ar / (ar + 25 + attackerLevel * 12)); }
      else a *= 1 - Math.min(90, this.def.resists?.[type] ?? 0) / 100;
    }
    return Math.max(0, a * this.dmgMult);
  }

  /** Apply already-mitigated damage. Returns total damage dealt (including absorbed). */
  applyDamage(n: number): number {
    if (this.dead || this.invulnerable || n <= 0) return 0;
    let dealt = n;
    if (this.shield > 0) {
      const ab = Math.min(this.shield, n);
      this.shield -= ab; n -= ab;
      if (this.shield <= 0) {
        this.shieldImg?.destroy(); this.shieldImg = undefined;
        this.ctx.vfx.explosion(this.center.x, this.center.y, { element: 'ice', radius: 70, power: 0.8, shake: false, decal: false });
        this.ctx.sfx('ice_shatter', { volume: 0.7 });
      } else if (this.shieldImg) this.shieldImg.setAlpha(0.3 + 0.4 * (this.shield / this.maxShield));
    }
    this.hp = Math.max(0, this.hp - n);
    this.aggro = true;
    this.anim.flash();
    this.drawBar();
    this.ctx.events.damaged(this, dealt);
    if (this.def.boss) this.sendBossHp();
    if (this.hp <= 0) { this.die(); return dealt; }
    this.brain?.onDamaged();
    if (this.def.flees && !this.fled && !this.charmed && this.hp < this.maxHp * 0.3) {
      this.fled = true; this.aiState = 'flee'; this.fleeT = 3200; this.cancelWind();
      const q = this.def.quips;
      this.ctx.vfx.floatingText(q ? q[Math.floor(Math.random() * q.length)] : '¡Socorro!', this.x, this.y - this.sprite.displayHeight - 30, { color: '#ffe680', size: 16, duration: 1400 });
    }
    return dealt;
  }

  private sendBossHp(force = false): void {
    const pct = Math.round((this.hp / this.maxHp) * 100);
    if (!force && pct === this.bossHpSent) return;
    this.bossHpSent = pct;
    this.ctx.events.bossHp(this);
  }

  /** Slide away from a point. */
  knockFrom(from: { gx: number; gy: number }, tiles: number): void {
    if (this.def.boss || tiles <= 0) return;
    const dx = this.gx - from.gx, dy = this.gy - from.gy, l = Math.hypot(dx, dy) || 1;
    const ms = 140;
    this.knock = { vx: (dx / l) * (tiles / ms) * 1000, vy: (dy / l) * (tiles / ms) * 1000, ms };
    this.cancelWind();
  }

  stun(ms: number): void {
    if (this.dead) return;
    if (this.def.boss) ms *= 0.25;
    this.stunUntil = Math.max(this.stunUntil, this.scene.time.now + ms);
    this.cancelWind();
    this.ctx.vfx.emit('stars', this.x, this.y - this.sprite.displayHeight, 5, { tint: 0xffee88, scale: 0.12, speed: [20, 60], life: 500 });
  }
  slow(mult: number, ms: number): void {
    const t = this.scene.time.now;
    if (t >= this.slowUntil || mult < this.slowMult) this.slowMult = mult;
    this.slowUntil = Math.max(this.slowUntil, t + ms);
    this.sprite.setTint(0x9fdcff);
  }
  root(ms: number): void { this.rootUntil = Math.max(this.rootUntil, this.scene.time.now + ms); }
  burn(dps: number, ms: number): void {
    this.burnDps = Math.max(this.burnDps, dps);
    this.burnUntil = Math.max(this.burnUntil, this.scene.time.now + ms);
  }

  charm(ms: number): void {
    if (this.def.charmImmune || this.def.boss || this.dead) return;
    this.charmed = true;
    this.charmUntil = this.scene.time.now + ms * (this.champion ? 0.5 : 1);
    this.cancelWind();
    this.aiState = 'chase';
    this.sprite.setTint(0xff8ac8);
    this.anim.baseTint = 0xff8ac8;
    this.ctx.vfx.hearts(this.x, this.y - this.sprite.displayHeight, 6);
  }
  private uncharm(): void {
    this.charmed = false;
    this.anim.baseTint = this.champion ? 0x88aaff : this.def.tint;
    this.restoreTint();
  }

  // ------------------------------------------------------------ AI

  private restoreTint(): void {
    this.sprite.clearTint();
    if (this.anim.baseTint !== undefined) this.sprite.setTint(this.anim.baseTint);
  }

  private cancelWind(): void {
    this.tele?.destroy(); this.tele = undefined; this.winding = undefined;
    if (this.aiState === 'windup' || this.aiState === 'dash') { this.aiState = 'chase'; this.dashV = undefined; this.restoreTint(); }
  }

  /** Move toward a grid point with axis sliding. Returns true if moved. */
  stepToward(tx: number, ty: number, dtMs: number, stopDist: number, speedMul = 1): boolean {
    const sp = this.effSpeed * speedMul;
    if (sp <= 0) return false;
    const dx = tx - this.gx, dy = ty - this.gy;
    const d = Math.hypot(dx, dy);
    if (d <= stopDist) return false;
    const step = Math.min(d - stopDist, (sp * dtMs) / 1000);
    return this.moveBy((dx / d) * step, (dy / d) * step, dx, dy);
  }

  moveBy(mx: number, my: number, faceX = mx, faceY = my): boolean {
    const nx = this.gx + mx, ny = this.gy + my;
    const ok = (x: number, y: number) => this.walk(Math.floor(x), Math.floor(y));
    if (ok(nx, ny)) { this.gx = nx; this.gy = ny; }
    else if (ok(nx, this.gy)) this.gx = nx;
    else if (ok(this.gx, ny)) this.gy = ny;
    else return false;
    this.faceGrid(faceX, faceY);
    this.syncPosition();
    return true;
  }

  private pickTarget(): AiTarget | null {
    const ctx = this.ctx;
    if (this.charmed) {
      let best: Enemy | null = null, bd = 9;
      for (const e of ctx.hostiles()) { const d = this.distanceTo(e); if (d < bd) { bd = d; best = e; } }
      if (best) return { gx: best.gx, gy: best.gy, radius: best.radius, ref: best, isPlayer: false };
      return null;
    }
    let best: AiTarget | null = null;
    let bd = Infinity;
    const p = ctx.player;
    if (!p.dead) { bd = this.distanceTo(p); best = { gx: p.gx, gy: p.gy, radius: 0.4, ref: p, isPlayer: true }; }
    for (const a of ctx.allies()) { const d = this.distanceTo(a); if (d < bd && d < 6) { bd = d; best = { gx: a.gx, gy: a.gy, radius: a.radius, ref: a, isPlayer: false }; } }
    return best;
  }

  private updateStatus(dt: number, now: number): void {
    if (this.charmed && now > this.charmUntil) this.uncharm();
    if (this.charmed) {
      this.heartT -= dt;
      if (this.heartT <= 0) { this.heartT = 650; this.ctx.vfx.hearts(this.x, this.y - this.sprite.displayHeight * 1.05, 1, 10); }
    }
    if (now < this.burnUntil) {
      this.burnAcc += dt;
      if (this.burnAcc >= 500) {
        this.burnAcc = 0;
        this.ctx.damageEnemy(this, { amount: this.burnDps * 0.5, type: 'fire', pure: true, dot: true, ally: true, silent: true });
        this.ctx.vfx.emit('fire', this.x, this.y - this.sprite.displayHeight * 0.5, 3, { tint: 0xff8a2a, scale: 0.25, speed: [10, 50], life: 500 });
      }
    }
    if (this.slowUntil && now > this.slowUntil) { this.slowUntil = 0; this.slowMult = 1; this.restoreTint(); }
    if (this.knock) {
      const k = this.knock;
      k.ms -= dt;
      this.moveBy((k.vx * dt) / 1000, (k.vy * dt) / 1000, 0, 0);
      if (k.ms <= 0) this.knock = undefined;
    }
  }

  tick(time: number, dtMs: number): void {
    this.anim.update(dtMs, this.moving);
    if (this.dead || !this.ctx) return;
    const now = this.scene.time.now;
    this.moving = false;
    this.updateStatus(dtMs, now);
    if (this.dead) return;
    if (now < this.stunUntil) return;
    this.cdT = Math.max(0, this.cdT - dtMs);
    if (this.brain) { this.brain.update(dtMs, time); return; }
    this.affixTick(dtMs);
    this.ai(dtMs);
  }

  private affixTick(dt: number): void {
    const ctx = this.ctx;
    if (this.aiState === 'windup' || this.charmed || !this.aggro) return;
    const p = ctx.player;
    if (p.dead) return;
    if (this.affixes.includes('fiery')) {
      this.fieryT -= dt;
      if (this.fieryT <= 0) {
        this.fieryT = 1200;
        ctx.vfx.shockwave(this.x, this.y, { element: 'fire', radius: 150, duration: 500 });
        ctx.vfx.emit('fire', this.x, this.y - 20, 8, { tint: 0xff7a1e, scale: 0.5, speed: [30, 110], life: 500 });
        if (this.distanceTo(p) < 2.3) ctx.damagePlayer({ amount: this.rollDmg() * 0.45, type: 'fire', from: this, silent: false }, this);
      }
    }
    if (this.affixes.includes('lovesick')) {
      this.kissT -= dt;
      const d = this.distanceTo(p);
      if (this.kissT <= 0 && d < 8 && d > 1.5) {
        this.kissT = 4800;
        this.blowKiss(p);
      }
    }
  }

  private blowKiss(p: Player): void {
    const ctx = this.ctx;
    const dx = p.gx - this.gx, dy = p.gy - this.gy;
    ctx.vfx.hearts(this.x, this.y - this.sprite.displayHeight * 0.8, 3, 8);
    ctx.sfx('heart_sparkle', { volume: 0.6 });
    ctx.spawnProjectile({
      owner: 'enemy', gx: this.gx, gy: this.gy, dx, dy, speed: 5.5, range: 11, radius: 0.5, element: 'love', size: 0.9, light: 90, kind: 'petal',
      onHit: (pr, t) => {
        if (t === 'player') {
          ctx.damagePlayer({ amount: this.rollDmg() * 0.4, type: 'physical', from: this, color: '#ff8ac8' }, this);
          ctx.slowPlayer(0.6, 2500);
          ctx.vfx.hearts(p.x, p.y - 60, 6, 14);
          ctx.vfx.floatingText('¡Beso!', p.x, p.y - 120, { color: '#ff8ac8', size: 18 });
        }
        if (t !== null) ctx.vfx.impact(pr.worldX, pr.worldY, 'love', true);
      },
    });
  }

  private rollDmg(): number {
    const [a, b] = this.def.atk.dmg;
    return (a + Math.random() * (b - a)) * enemyDmgMult(this.level) * (this.champion ? 1.25 : 1);
  }
  /** Damage roll for boss patterns (scaled by level). */
  rollBoss(mult = 1): number { return this.rollDmg() * mult; }

  private ai(dt: number): void {
    const ctx = this.ctx;
    const tgt = this.pickTarget();
    const a = this.def.atk;
    const now = this.scene.time.now;
    void now;

    if (this.aiState === 'windup') {
      this.stateT -= dt;
      if (this.winding && tgt) this.faceGrid(tgt.gx - this.gx, tgt.gy - this.gy);
      if (this.stateT <= 0) this.execute(tgt);
      return;
    }
    if (this.aiState === 'recover') {
      this.stateT -= dt;
      if (this.stateT <= 0) this.aiState = 'chase';
      return;
    }
    if (this.aiState === 'dash') { this.updateDash(dt); return; }
    if (this.aiState === 'flee') {
      this.fleeT -= dt;
      const p = ctx.player;
      this.moving = this.stepToward(this.gx + (this.gx - p.gx), this.gy + (this.gy - p.gy), dt, 0, 1.25);
      if (this.fleeT <= 0) this.aiState = 'chase';
      return;
    }

    if (!tgt) { this.idle(dt); return; }
    const d = this.distanceTo(tgt) - tgt.radius * 0.3;
    if (!this.charmed) {
      if (!this.aggro && d < this.aggroRange) { this.aggro = true; ctx.alertPack(this); }
      if (!this.aggro) { this.idle(dt); return; }
      if (d > this.aggroRange * 2.2 && !this.def.boss) { this.aggro = false; return; }
    } else if (d > 12 && tgt.isPlayer) { return; }

    const keep = a.keepDist ?? 0;
    if (a.kind === 'ranged' && d < keep) {
      this.moving = this.stepToward(this.gx + (this.gx - tgt.gx), this.gy + (this.gy - tgt.gy), dt, 0, 0.85);
      this.faceGrid(tgt.gx - this.gx, tgt.gy - this.gy);
      if (!this.moving && this.cdT <= 0) this.beginWindup(tgt);
      else if (this.moving && d > keep * 0.6 && this.cdT <= 0 && d <= a.range) this.beginWindup(tgt);
      return;
    }
    if (d > a.range * 0.92) {
      if (this.def.immobile) return;
      this.moving = this.stepToward(tgt.gx, tgt.gy, dt, Math.max(0.3, a.range * 0.7));
      return;
    }
    this.faceGrid(tgt.gx - this.gx, tgt.gy - this.gy);
    if (this.cdT <= 0) this.beginWindup(tgt);
  }

  private idle(dt: number): void {
    if (this.def.immobile) return;
    if (this.charmed) {
      const p = this.ctx.player;
      if (this.distanceTo(p) > 3) this.moving = this.stepToward(p.gx, p.gy, dt, 2, 1.1);
      return;
    }
    this.wanderT -= dt;
    if (this.wanderT <= 0 && !this.wanderGoal) {
      this.wanderGoal = { gx: this.home.gx + (Math.random() - 0.5) * 5, gy: this.home.gy + (Math.random() - 0.5) * 5 };
      this.wanderT = 2500 + Math.random() * 3500;
    }
    if (this.wanderGoal) {
      this.moving = this.stepToward(this.wanderGoal.gx, this.wanderGoal.gy, dt, 0.2, 0.45);
      if (!this.moving) this.wanderGoal = null;
    }
  }

  private atkSpeed(): number { return this.speedAffix; }

  private beginWindup(t: AiTarget): void {
    const a = this.def.atk;
    const ctx = this.ctx;
    this.aiState = 'windup';
    this.stateT = a.windup / this.atkSpeed();
    this.winding = { x: t.gx, y: t.gy, target: t };
    this.faceGrid(t.gx - this.gx, t.gy - this.gy);
    const ms = this.stateT;
    const ang = Math.atan2(t.gy - this.gy, t.gx - this.gx);
    if (a.kind === 'slam') this.tele = ctx.vfx.telegraphCircle(this.gx, this.gy, a.radius ?? 2, ms, 0xff5a2a);
    else if (a.kind === 'lunge') this.tele = ctx.vfx.telegraphLine(this.gx, this.gy, ang, a.range + 0.3, 0.9, ms, 0xff5a2a);
    else if (a.kind === 'ranged') ctx.vfx.flash(this.x, this.y - this.sprite.displayHeight * 0.6, { element: (a.element === 'ice' ? 'ice' : (a.element ?? 'physical')) as Element, size: 70, ms });
    this.sprite.setTint(0xff9d8a);
  }

  private execute(tgt: AiTarget | null): void {
    const a = this.def.atk;
    const ctx = this.ctx;
    const w = this.winding;
    this.tele = undefined; this.winding = undefined;
    this.restoreTint();
    this.cdT = a.cooldown / this.atkSpeed();
    this.aiState = 'recover'; this.stateT = 260;
    if (!w) { this.aiState = 'chase'; return; }
    const target = tgt ?? w.target;
    const sw = gridToWorld(w.x - this.gx, w.y - this.gy);
    this.anim.attackLunge(sw.x, sw.y);
    const info = (mult = 1) => ({ amount: this.rollDmg() * mult, type: a.type, from: this as { gx: number; gy: number }, knockback: 0 });
    if (a.kind === 'melee') {
      ctx.sfx('sword_swing_2', { volume: 0.35 });
      ctx.vfx.slashArc(this.x + sw.x * 0.1, this.y - this.sprite.displayHeight * 0.5, Math.atan2(sw.y, sw.x), { size: 110 * this.def.scale, ms: 180 });
      if (this.distanceTo(target) <= a.range + 0.7) this.strike(target, info());
    } else if (a.kind === 'lunge') {
      const l = Math.hypot(w.x - this.gx, w.y - this.gy) || 1;
      this.dashV = { dx: (w.x - this.gx) / l, dy: (w.y - this.gy) / l, left: a.range + 0.3, hit: false, target };
      this.aiState = 'dash';
    } else if (a.kind === 'ranged') {
      const el = (a.element ?? 'physical') as Element;
      const dx = w.x - this.gx, dy = w.y - this.gy;
      ctx.sfx(el === 'fire' ? 'fireball_cast' : 'arrow_shoot', { volume: 0.4 });
      ctx.spawnProjectile({
        owner: this.charmed ? 'ally' : 'enemy', gx: this.gx, gy: this.gy, dx, dy, speed: a.projSpeed ?? 6, range: a.range + 4, radius: 0.45, element: el, size: 0.8,
        light: el === 'fire' || el === 'arcane' ? 100 : 0, height: this.sprite.displayHeight * 0.55,
        onHit: (pr, t) => {
          if (t === null) { ctx.vfx.impact(pr.worldX, pr.worldY, el, false); return; }
          ctx.vfx.impact(pr.worldX, pr.worldY, el, true);
          this.strike(t === 'player' ? ctx.player : t, info());
        },
      });
    } else if (a.kind === 'slam') {
      const r = a.radius ?? 2;
      ctx.vfx.explosion(this.x, this.y, { element: a.element ?? 'physical', radius: r * 45, power: 0.8 });
      ctx.vfx.screenShake(0.004, 120);
      ctx.sfx('sword_hit_2', { volume: 0.7 });
      const targets = this.charmed ? ctx.hostiles() : [ctx.player, ...ctx.allies()];
      for (const t of targets) if (!('dead' in t && t.dead) && this.distanceTo(t) <= r + 0.4) this.strike(t, info());
    }
  }

  private updateDash(dt: number): void {
    const dv = this.dashV;
    if (!dv) { this.aiState = 'chase'; return; }
    const step = Math.min(dv.left, (13 * dt) / 1000);
    const moved = this.moveBy(dv.dx * step, dv.dy * step);
    dv.left -= step;
    this.moving = true;
    this.ctx.vfx.trail(this.x, this.y - 20, 'physical', 0.8);
    const t = dv.target;
    if (!dv.hit && this.distanceTo(t) < 1.2) { dv.hit = true; this.strike(t, { amount: this.rollDmg(), type: this.def.atk.type, from: this }); }
    if (dv.left <= 0.01 || !moved) { this.dashV = undefined; this.aiState = 'recover'; this.stateT = 400; }
  }

  private strike(t: AiTarget | Enemy | Player, info: { amount: number; type: 'physical' | 'fire' | 'cold' | 'lightning'; from: { gx: number; gy: number } }): void {
    const ctx = this.ctx;
    const ref = 'ref' in t ? t.ref : t;
    if (ref.kind === 'player') {
      ctx.damagePlayer({ ...info, knockback: 0 }, this);
      if (this.affixes.includes('frozen')) ctx.slowPlayer(0.65, 1800);
    } else ctx.damageEnemy(ref as Enemy, { ...info, ally: true, knockback: 0.4 });
  }

  // ------------------------------------------------------------ death & UI

  private drawBar(): void {
    const g = this.bar;
    if (!g) return;
    g.clear();
    if (this.def.boss || this.hp >= this.maxHp || this.dead || this.def.minion && this.maxHp <= 1) return;
    const w = 46, y = -this.sprite.displayHeight - 4;
    g.fillStyle(0x000000, 0.7).fillRect(-w / 2 - 1, y - 1, w + 2, 6);
    g.fillStyle(this.charmed ? 0xff6aae : this.champion ? 0x5a8aff : 0xc0281c, 1).fillRect(-w / 2, y, (w * this.hp) / this.maxHp, 4);
    if (this.shield > 0) g.fillStyle(0x9ad0ff, 0.9).fillRect(-w / 2, y - 3, (w * this.shield) / this.maxShield, 2);
  }

  /** XP awarded for this enemy relative to the player's level. */
  xpValue(playerLevel: number): number {
    if (this.def.minion) return 0;
    const diff = playerLevel - this.level;
    const f = diff > 2 ? Math.max(0.1, 1 - 0.12 * (diff - 2)) : 1;
    return Math.max(1, Math.round(this.def.xp * enemyXpMult(this.level) * (this.champion ? 2.5 : 1) * f));
  }

  die(): void {
    if (this.dead) return;
    this.dead = true;
    this.hp = 0;
    this.cancelWind();
    this.auraFx?.destroy();
    this.brain?.destroy();
    this.shieldImg?.destroy();
    this.bar?.clear();
    this.label?.setVisible(false);
    this.ctx.onEnemyDied(this);
    this.scene.tweens.add({ targets: this, alpha: 0, duration: 650, delay: 150, onComplete: () => this.destroy() });
  }

  /** Remove without death effects (boss clones, area cleanup). */
  vanish(): void {
    if (this.dead) return;
    this.dead = true;
    this.cancelWind();
    this.auraFx?.destroy();
    this.brain?.destroy();
    this.scene.tweens.add({ targets: this, alpha: 0, duration: 250, onComplete: () => this.destroy() });
  }
}