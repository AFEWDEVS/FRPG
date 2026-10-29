import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { EventBus } from '../core/EventBus';
import { GameState } from '../core/GameState';
import { CLASSES } from '../data/classes';
import { SKILL_BY_ID } from '../data/skills';
import { Enemy, type EnemySpawn } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { findPath, nearestWalkable } from '../iso/pathfinding';
import { gridToWorld } from '../iso/iso';
import type { GameScene } from '../scenes/GameScene';
import { cooldownMs, effectiveLevel, manaCostOf, normalizeHotbar, skillValue } from '../skills';
import { CAST_MS, GROUND_R, EXECUTORS, type SkillCtx } from '../skills/executors';
import type { Element, VfxManager } from '../vfx/VfxManager';
import { Projectile, type ProjectileOpts } from './Projectile';
import {
  CRIT_COLOR, DAMAGE_COLORS, DAMAGE_SFX, armorReduction, missChance, playerResist, rollPlayerDamage, shakeFor,
  type DamageInfo, type HitResult,
} from './damage';
import { computeDerived, type DerivedStats } from './stats';
import { PlayerMoves } from './PlayerMoves';
import type { GridPos } from '../core/types';

type Updater = (dtMs: number) => boolean | void;

const ELEMENT_FX: Record<string, Element> = { physical: 'physical', fire: 'fire', cold: 'ice', lightning: 'lightning', holy: 'holy', arcane: 'arcane', love: 'love', nature: 'nature' };
const SHOUT_COLOR: Record<string, string> = { physical: '#ffffff', fire: '#ffb060', cold: '#a8e8ff', lightning: '#d9b8ff', holy: '#ffe680', arcane: '#e0a0ff', love: '#ff9ac8', nature: '#a8ff90' };

/**
 * Owns everything that happens during a fight in one GameScene: damage pipeline, player attacks and skills,
 * enemy registration/ticking, projectiles, status effects, boss encounters, death/respawn.
 * GameScene creates it after the entities exist and calls `update()` each frame.
 */
export class CombatSystem {
  readonly vfx: VfxManager;
  derived: DerivedStats;
  readonly cooldowns = new Map<string, { until: number; total: number }>();
  projectiles: Projectile[] = [];
  now = 0;

  // player status
  shieldAbsorb = 0;
  shieldUntil = 0;
  shieldFx?: { destroy: () => void };
  armorBonus = 0;
  armorUntil = 0;
  frostArmor = false;
  slowMult = 1;
  slowUntil = 0;
  stunUntil = 0;
  hasteMult = 1;
  hasteUntil = 0;
  /** Damage dealt to the player is nulled while true (dash i-frames). */
  invulnerable = false;

  private target: Enemy | null = null;
  private pending: { skillId: string; gx: number; gy: number; targetId?: string; slot: string } | null = null;
  private attackReadyAt = 0;
  castUntil = 0;
  moves: PlayerMoves;
  private timeMul = 1;
  private slowMoUntil = 0;
  private attackers = new Set<Enemy>();
  private repath = 0;
  private updaters: Updater[] = [];
  private unsub: (() => void)[] = [];
  private lastDeriveAt = -1000;
  private lastVit = '';
  private lastSfx = new Map<string, number>();
  private bossActive: Enemy | null = null;
  private noManaAt = 0;
  private slowTinted = false;
  private casting = false;
  private lastShout = new Map<string, number>();
  private healAcc = 0;
  private healAt = 0;

  constructor(readonly scene: GameScene) {
    this.vfx = scene.vfx;
    this.derived = this.computeNow();
    normalizeHotbar();
    this.moves = new PlayerMoves(this);
    const p = this.player;
    p.walkable = (i, j) => scene.map.isWalkable(i, j);
    for (const e of scene.enemies) this.register(e);
    this.unsub.push(EventBus.on('skill:use', (s) => this.useSlot(s.slot, s.gx, s.gy, s.targetId)));
    this.unsub.push(EventBus.on('input:dodge', (d) => this.moves.dodge(d.gx, d.gy)));
    this.unsub.push(EventBus.on('input:heavy', (h) => { if (h.phase === 'start') this.moves.heavyStart(h.gx, h.gy, h.targetId); else this.moves.heavyRelease(h.gx, h.gy); }));
    this.unsub.push(EventBus.on('input:block', (b) => this.moves.setBlock(b.down)));
    this.unsub.push(EventBus.on('input:sprint', (s) => this.moves.setSprint(s.on)));
    this.unsub.push(EventBus.on('player:levelup', ({ level }) => this.levelUpFx(level)));
    this.refreshVitals(0);
  }

  get player(): Player { return this.scene.player; }

  private computeNow(): DerivedStats {
    const pr = GameState.profile;
    return computeDerived({ classId: pr.classId, level: pr.level, stats: pr.stats, equipment: pr.equipment as Record<string, unknown> });
  }

  /** Call after equipment / attribute changes for an immediate refresh (otherwise refreshed every 250 ms). */
  refreshDerived(): void { this.derived = this.computeNow(); this.lastDeriveAt = this.now; }

  // ------------------------------------------------------------ queries

  isWalkable(gx: number, gy: number): boolean { return this.scene.map.isWalkable(Math.floor(gx), Math.floor(gy)); }
  hostiles(): Enemy[] { return this.scene.enemies.filter((e) => !e.dead && e.active && !e.charmed); }
  allies(): Enemy[] { return this.scene.enemies.filter((e) => !e.dead && e.active && e.charmed); }
  enemyById(id: string): Enemy | undefined { return this.scene.enemies.find((e) => e.id === id && !e.dead); }
  enemiesInCircle(gx: number, gy: number, r: number): Enemy[] {
    return this.hostiles().filter((e) => Math.hypot(e.gx - gx, e.gy - gy) <= r + e.radius * 0.5);
  }
  nearestHostile(gx: number, gy: number, maxD: number, skip?: Set<string>): Enemy | null {
    let best: Enemy | null = null, bd = maxD;
    for (const e of this.hostiles()) {
      if (skip?.has(e.id) || e.invulnerable) continue;
      const d = Math.hypot(e.gx - gx, e.gy - gy);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  /** Nearest walkable point along the segment from (ax,ay) toward (bx,by), at most `maxDist` tiles. */
  clampWalkable(ax: number, ay: number, bx: number, by: number, maxDist: number): GridPos & { fx: number; fy: number } {
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
    const dist = Math.min(l, maxDist);
    let lastX = ax, lastY = ay;
    for (let s = 0.25; s <= dist + 0.001; s += 0.25) {
      const x = ax + (dx / l) * s, y = ay + (dy / l) * s;
      if (!this.isWalkable(x, y)) break;
      lastX = x; lastY = y;
    }
    return { gx: Math.floor(lastX), gy: Math.floor(lastY), fx: lastX, fy: lastY };
  }

  // ------------------------------------------------------------ scheduling

  addUpdater(fn: Updater): void { this.updaters.push(fn); }
  /** Run `fn` after `ms` of game time (pauses with hit-stop, dies with the scene). */
  after(ms: number, fn: () => void): void {
    let t = ms;
    this.updaters.push((dt) => { t -= dt; if (t <= 0) { fn(); return false; } return true; });
  }
  /** Call `fn(i)` every `intervalMs` for `durationMs`; `end` runs once at the end. Returns a canceller. */
  every(durationMs: number, intervalMs: number, fn: (i: number) => void, end?: () => void): () => void {
    let left = durationMs, acc = 0, i = 0, stop = false;
    this.updaters.push((dt) => {
      if (stop) return false;
      left -= dt; acc += dt;
      while (acc >= intervalMs && i * intervalMs <= durationMs) { acc -= intervalMs; fn(i++); }
      if (left <= 0) { end?.(); return false; }
      return true;
    });
    return () => { stop = true; };
  }

  sfx(name: string, o: { volume?: number; pitchVar?: number } = {}): void {
    const t = performance.now();
    if (t - (this.lastSfx.get(name) ?? 0) < 45) return;
    this.lastSfx.set(name, t);
    AudioManager.sfx(name, o);
  }

  // ------------------------------------------------------------ registration

  register(e: Enemy): void {
    e.ctx = this;
    e.init();
    if (!this.scene.enemies.includes(e)) this.scene.enemies.push(e);
  }

  /** Spawn an enemy at runtime (boss summons). Returns it already registered. */
  spawnEnemy(defId: string, gx: number, gy: number, o: Partial<EnemySpawn> = {}): Enemy {
    const e = new Enemy(this.scene, { defId, gx: Math.floor(gx), gy: Math.floor(gy), ...o }, this.scene.map.isWalkable);
    e.setGrid(gx, gy);
    this.register(e);
    e.aggro = true;
    return e;
  }

  alertPack(src: Enemy): void {
    for (const e of this.scene.enemies) if (!e.dead && !e.aggro && !e.charmed && !e.def.boss && src.distanceTo(e) < 6) e.aggro = true;
  }

  // ------------------------------------------------------------ events for entities

  readonly events = {
    damaged: (e: Enemy, dealt: number) => EventBus.emit('enemy:damaged', { id: e.id, amount: Math.round(dealt), hp: e.hp }),
    bossHp: (e: Enemy) => EventBus.emit('boss:hp', { bossId: e.def.id, hp: Math.round(e.hp), maxHp: e.maxHp }),
  };

  // ------------------------------------------------------------ main loop

  update(time: number, dtMs: number): void {
    this.now = this.scene.time.now;
    if (this.timeMul < 1 && performance.now() > this.slowMoUntil) { this.timeMul = 1; this.scene.tweens.timeScale = 1; }
    dtMs *= this.timeMul;
    const p = this.player;
    if (this.now - this.lastDeriveAt > 250) { this.derived = this.computeNow(); this.lastDeriveAt = this.now; }
    for (let i = this.updaters.length - 1; i >= 0; i--) { if (this.updaters[i](dtMs) === false) this.updaters.splice(i, 1); }
    this.statuses(dtMs);
    this.refreshVitals(dtMs);
    this.moves.update(dtMs);
    for (const e of this.attackers) if (e.dead || !e.active || !e.attacking) this.attackers.delete(e);

    if (!p.dead) this.playerActions(dtMs);

    const list = this.scene.enemies;
    for (let n = list.length - 1; n >= 0; n--) {
      const e = list[n];
      if (!e.active) { list.splice(n, 1); continue; }
      e.tick(time, dtMs);
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      if (!pr.update(dtMs)) this.projectiles.splice(i, 1);
    }
  }

  // ------------------------------------------------------------ player vitals & status

  private refreshVitals(dtMs: number): void {
    const d = this.derived;
    const dt = dtMs / 1000;
    if (!this.player.dead) {
      GameState.life = Math.min(d.maxLife, GameState.life + d.lifeRegen * dt);
      GameState.mana = Math.min(d.maxMana, GameState.mana + d.manaRegen * dt);
    }
    GameState.life = Math.max(0, Math.min(d.maxLife, GameState.life));
    GameState.mana = Math.max(0, Math.min(d.maxMana, GameState.mana));
    this.player.hp = GameState.life;
    this.player.maxHp = d.maxLife;
    const key = `${Math.floor(GameState.life)}/${d.maxLife}/${Math.floor(GameState.mana)}/${d.maxMana}`;
    if (key !== this.lastVit) { this.lastVit = key; GameState.emitVitals(); }
  }

  private statuses(dtMs: number): void {
    const p = this.player;
    const now = this.now;
    if (this.shieldAbsorb > 0 && now > this.shieldUntil) this.clearShield();
    if (this.armorBonus > 0 && now > this.armorUntil) { this.armorBonus = 0; this.frostArmor = false; }
    if (this.slowUntil && now > this.slowUntil) { this.slowUntil = 0; this.slowMult = 1; }
    if (this.hasteUntil && now > this.hasteUntil) { this.hasteUntil = 0; this.hasteMult = 1; }
    const slowed = this.slowMult < 1 && !p.dead;
    if (slowed !== this.slowTinted) { this.slowTinted = slowed; if (slowed) p.sprite.setTint(0xcfa8ff); else p.sprite.clearTint(); }
    p.speedMultiplier = this.derived.moveSpeed * this.slowMult * this.hasteMult * this.moves.speedMul() * (now < this.stunUntil ? 0 : 1);
    p.locked = now < this.castUntil || now < this.stunUntil || this.moves.locked;
    void dtMs;
  }

  /** Player-facing armor including temporary bonuses. */
  get armor(): number { return this.derived.armor + this.armorBonus; }

  clearShield(): void { this.shieldAbsorb = 0; this.shieldFx?.destroy(); this.shieldFx = undefined; }

  slowPlayer(mult: number, ms: number): void {
    this.slowMult = Math.min(this.slowMult, mult);
    this.slowUntil = Math.max(this.slowUntil, this.now + ms);
  }
  hastePlayer(mult: number, ms: number): void { this.hasteMult = Math.max(this.hasteMult, mult); this.hasteUntil = Math.max(this.hasteUntil, this.now + ms); }
  stunPlayer(ms: number): void {
    this.stunUntil = Math.max(this.stunUntil, this.now + ms);
    this.player.stop();
    this.vfx.emit('stars', this.player.x, this.player.y - 90, 5, { tint: 0xffee88, scale: 0.12, speed: [20, 60], life: 500 });
  }
  confusePlayer(ms: number): void {
    const p = this.player;
    p.confusedUntil = this.now + ms;
    this.vfx.floatingText('¿¡Qué?!', p.x, p.y - 130, { color: '#e0b0ff', size: 20 });
    this.every(ms, 280, () => { if (!p.dead) this.vfx.emit('swirl', p.x, p.y - 100, 1, { tint: 0xd8a0ff, scale: 0.2, scaleEnd: 0.05, life: 600, speed: [0, 20] }); });
  }
  spendMana(n: number): boolean {
    if (GameState.mana < n) return false;
    GameState.mana -= n;
    return true;
  }
  healPlayer(n: number): void {
    if (this.player.dead || n <= 0) return;
    const before = GameState.life;
    GameState.life = Math.min(this.derived.maxLife, GameState.life + n);
    this.healAcc += GameState.life - before;
    if (this.healAcc >= 1 && this.now - this.healAt > 250) {
      const p = this.player;
      this.vfx.damageNumber('+' + Math.round(this.healAcc), p.x, p.y - 125, { kind: 'heal' });
      this.vfx.emit('hearts', p.x, p.y - 60, 2, { tint: 0x8affa0, scale: 0.1, life: 900, speed: [20, 60] });
      this.healAcc = 0; this.healAt = this.now;
    }
  }

  /** RO-style skill shout above a caster (throttled per name). */
  skillShout(x: number, y: number, name: string, color = '#ffe9a0'): void {
    const t = performance.now();
    if (t - (this.lastShout.get(name) ?? 0) < 450) return;
    this.lastShout.set(name, t);
    this.vfx.fx.shout('¡' + name + '!!', x, y, color);
  }

  // ------------------------------------------------------------ damage pipeline

  /** Deals damage from the player to an enemy (resists, armor, crit visuals, knockback, hit-stop, lifesteal). */
  damageEnemy(e: Enemy, info: DamageInfo): HitResult {
    if (e.dead || e.invulnerable) return { dealt: 0, crit: false, killed: false };
    if (!info.dot && !info.pure && !info.ally && !info.noMiss && Math.random() < missChance(GameState.profile.level, this.derived.dex, e.level ?? 1, e.def.armor ?? 0, info.type !== 'physical', !!e.def.boss)) {
      const mc = e.center;
      this.vfx.damageNumber('MISS', mc.x, mc.y - e.sprite.displayHeight * 0.45, { kind: 'miss' });
      if (!e.aggro) { e.aggro = true; this.alertPack(e); }
      return { dealt: 0, crit: false, killed: false };
    }
    const lvl = info.ally ? 1 + Math.floor(GameState.profile.level * 0.5) : GameState.profile.level;
    const mitigated = e.mitigate(info.amount, info.type, info.pure, lvl);
    let amount = Math.max(1, Math.round(mitigated));
    if (e.staggered && !info.dot) amount = Math.round(amount * (e.def.boss ? 1.4 : 1.25));
    const hpBefore = e.hp;
    const dealt = Math.round(e.applyDamage(amount));
    if (dealt <= 0) return { dealt: 0, crit: false, killed: false };
    const c = e.center;
    const crit = !!info.crit;
    const color = crit ? CRIT_COLOR : info.color ?? DAMAGE_COLORS[info.type];
    if (!info.dot || dealt >= 2) this.vfx.damageNumber(crit ? `${dealt}!` : String(dealt), c.x, c.y - e.sprite.displayHeight * 0.45, { color, crit, kind: crit ? 'crit' : info.dot ? 'dot' : 'dmg' });
    if (!info.dot) {
      const pal = info.type === 'fire' ? 'fire' : info.type === 'cold' ? 'ice' : info.type === 'lightning' ? 'lightning' : 'physical';
      const fr = info.from ? gridToWorld(info.from.gx, info.from.gy) : { x: c.x - 1, y: c.y };
      this.vfx.fx.hitSpark(c.x, c.y, Math.atan2(c.y - fr.y, c.x - fr.x), pal, crit);
      if (!info.silent) { const names = DAMAGE_SFX[info.type]; this.sfx(names[Math.floor(Math.random() * names.length)], { volume: 0.6 }); }
      if (info.knockback && info.from) e.knockFrom(info.from, info.knockback * (crit ? 1.5 : 1));
      if (!info.ally) {
        const ratio = dealt / Math.max(1, e.maxHp);
        if (info.hitStop) this.vfx.hitStop(Math.min(120, info.hitStop + (crit ? 15 : 0)));
        else if (crit || ratio > 0.04) this.vfx.hitStop(Math.min(120, 24 + ratio * 260 + (crit ? 36 : 0)));
        const sh = shakeFor(dealt, e.maxHp, crit);
        if (info.impulse && info.from) this.impulse(e.gx - info.from.gx, e.gy - info.from.gy, info.impulse);
        else if (sh > 0.0035) this.vfx.screenShake(sh, 100);
        if (info.weight) this.sfx('enemy_hit', { volume: info.heavy ? 0.65 : 0.4 });
        if (crit) { this.vfx.screenShake(Math.max(sh, 0.006), 130); this.vfx.screenFlash(0xfff4d0, 70); }
      }
    }
    if (!info.dot && !e.dead && !e.invulnerable) e.hitPoise(info.poise ?? 12, { heavy: info.heavy });
    if (!info.ally && this.derived.lifeSteal > 0) this.healPlayer((dealt * this.derived.lifeSteal) / 100);
    if (!e.aggro) { e.aggro = true; this.alertPack(e); }
    return { dealt, crit, killed: e.dead && hpBefore > 0 };
  }

  /** Player-sourced hit: `pct` percent of the player's damage roll. */
  playerHit(e: Enemy, pct: number, type: DamageInfo['type'], o: Partial<DamageInfo> = {}): HitResult {
    const r = rollPlayerDamage(this.derived, pct);
    const p = this.player;
    return this.damageEnemy(e, { amount: r.amount, type, crit: r.crit, from: p, knockback: 0.35, poise: Math.round(pct * 0.18), ...o });
  }

  /** Damage to the player. Returns damage actually taken (after armor / resist / shield). */
  damagePlayer(info: DamageInfo, src?: Enemy): number {
    const p = this.player;
    if (p.dead || this.invulnerable) return 0;
    if (!info.pure && !info.dot && !this.moves.iframes && Math.random() < 0.03) { this.vfx.damageNumber('MISS', p.x, p.y - 120, { kind: 'miss' }); return 0; }
    const d = this.derived;
    let a = info.amount;
    if (!info.pure) {
      if (info.type === 'physical') a *= 1 - armorReduction(this.armor, src?.level ?? 1);
      else a *= 1 - playerResist(d, info.type) / 100;
    }
    a = Math.max(1, Math.round(a));
    const fi = this.moves.filterIncoming(info, a, src);
    if (fi.negated) return 0;
    a = fi.amount;
    if (this.shieldAbsorb > 0) {
      const ab = Math.min(a, this.shieldAbsorb);
      this.shieldAbsorb -= ab; a -= ab;
      this.vfx.damageNumber(`(${Math.round(ab)})`, p.x, p.y - 110, { color: '#ffe680', small: true });
      this.vfx.emit('stars', p.x, p.y - 60, 4, { tint: 0xffe680, scale: 0.12, speed: [40, 120], life: 400 });
      if (this.shieldAbsorb <= 0) { this.clearShield(); this.vfx.explosion(p.x, p.y - 50, { element: 'holy', radius: 60, power: 0.7, shake: false, decal: false }); }
    }
    if (a <= 0) return 0;
    GameState.life = Math.max(0, GameState.life - a);
    this.vfx.damageNumber(String(a), p.x, p.y - 120, { kind: 'player' });
    this.vfx.impact(p.x, p.y - 50, info.type === 'fire' ? 'fire' : info.type === 'cold' ? 'ice' : info.type === 'lightning' ? 'lightning' : 'physical', false);
    p.anim.flash(70);
    this.sfx('player_hurt', { volume: 0.7 });
    this.vfx.screenShake(Math.min(0.01, 0.002 + (a / d.maxLife) * 0.03), 110);
    if (a > d.maxLife * 0.15) this.vfx.hitStop(50);
    if (src && this.frostArmor && src.distanceTo(p) < 3) { src.slow(0.55, 1800); this.vfx.impact(src.x, src.y - 40, 'ice', false); }
    EventBus.emit('player:damaged', { amount: a, type: info.type, life: GameState.life });
    GameState.emitVitals();
    if (GameState.life <= 0) this.killPlayer();
    else this.moves.afterHit(a, info, src);
    return a;
  }

  private killPlayer(): void {
    const p = this.player;
    if (p.dead) return;
    p.dead = true;
    this.moves.reset();
    p.stop();
    this.clearShield();
    this.target = null; this.pending = null;
    EventBus.emit('player:died');
    this.sfx('player_death', {});
    this.vfx.floatingText('Has caído... pero el amor nunca muere', p.x, p.y - 150, { size: 22, color: '#ff8a8a', duration: 2400 });
    this.scene.tweens.add({ targets: p.sprite, angle: p.facingLeft ? -90 : 90, alpha: 0.6, duration: 500, ease: 'Cubic.easeIn' });
    this.vfx.explosion(p.x, p.y - 40, { element: 'love', radius: 70, power: 0.8, shake: false, decal: false });
    this.scene.time.delayedCall(2300, () => {
      const lost = Math.floor(GameState.profile.gold * 0.1);
      if (lost > 0) GameState.addGold(-lost);
      const d = this.computeNow();
      GameState.life = d.maxLife; GameState.mana = d.maxMana; GameState.stamina = d.maxStamina;
      GameState.emitVitals();
      GameState.save();
      EventBus.emit('player:respawn', { goldLost: lost });
      this.scene.travelTo({ areaId: 'town', entry: 'start' });
    });
  }

  private levelUpFx(level: number): void {
    const p = this.player;
    const d = this.computeNow();
    GameState.life = d.maxLife; GameState.mana = d.maxMana;
    this.derived = d;
    const x = p.x, y = p.y - 50;
    this.vfx.fx.levelUp(x, p.y, level);
    this.vfx.explosion(x, y, { element: 'holy', radius: 130, power: 1.6, shake: true, decal: false });
    this.vfx.shockwave(x, p.y, { element: 'holy', radius: 420, duration: 900 });
    this.vfx.shockwave(x, p.y, { element: 'holy', radius: 260, duration: 600 });
    this.vfx.decal('magic_circle', x, p.y, { scale: 0.9, tint: 0xffe680, duration: 1800, blend: 'ADD', spin: 120, alpha: 0.9 });
    for (let i = 0; i < 6; i++) this.after(i * 90, () => this.vfx.emit('stars', x + (Math.random() - 0.5) * 60, y - i * 22, 6, { tint: 0xffe680, scale: 0.22, speed: [30, 120], life: 900 }));
    this.vfx.lightPulse(x, y, 520, 1200, 1);
    this.vfx.zoomPunch(1.06, 250, 250, 500);
    this.vfx.screenFlash(0xfff2b0, 220);
  }

  // ------------------------------------------------------------ enemy death & bosses

  onEnemyDied(e: Enemy): void {
    const lvl = GameState.profile.level;
    const xp = e.xpValue(lvl);
    const c = e.center;
    EventBus.emit('enemy:died', {
      id: e.id, defId: e.def.id, gx: e.gx, gy: e.gy, xp, champion: e.champion,
      enemy: e, x: e.x, y: e.y, level: e.level, isChampion: e.champion, isBoss: e.isBoss,
    });
    if (xp > 0) {
      GameState.gainXp(xp);
      this.vfx.floatingText(`+${xp} XP`, e.x, e.y - e.sprite.displayHeight - 20, { color: '#ffd24a', size: 16, duration: 900 });
    }
    this.sfx('enemy_death', { volume: 0.8 });
    this.vfx.fx.deathPop(c.x, c.y, e.isBoss || e.champion);
    if (e.isBoss) {
      this.vfx.explosion(c.x, c.y, { element: 'holy', radius: 150, power: 2, shake: true });
      this.vfx.shockwave(e.x, e.y, { element: 'holy', radius: 500, duration: 1000 });
      this.vfx.zoomPunch(1.1, 300, 600, 700);
      this.vfx.hitStop(160);
      for (const m of this.scene.enemies) if (m.def.minion && !m.dead) m.vanish();
      EventBus.emit('boss:hp', { bossId: e.def.id, hp: 0, maxHp: e.maxHp });
      EventBus.emit('boss:defeated', { bossId: e.def.id });
      this.bossActive = null;
      AudioManager.playMusic(this.scene.areaDef.music);
    } else {
      this.vfx.emit('smoke', c.x, c.y, 3, { tint: 0x2a2220, scale: 0.4, scaleEnd: 0.8, alpha: 0.4, life: 700 });
      this.vfx.emit('sparks', c.x, c.y, 8, { tint: 0xffd890, scale: 0.15, speed: [60, 200] });
      if (e.def.id === 'heart_slime') this.vfx.hearts(c.x, c.y, 5, 18);
    }
    if (e.affixes.includes('explosive')) {
      const r = 2.6;
      this.vfx.floatingText('¡Cuidado!', e.x, e.y - e.sprite.displayHeight - 30, { color: '#ff9a3a', size: 18, duration: 900 });
      this.vfx.telegraphCircle(e.gx, e.gy, r, 800, 0xff6a2a);
      const gx = e.gx, gy = e.gy;
      this.after(800, () => {
        const w = gridToWorld(gx, gy);
        this.vfx.explosion(w.x, w.y, { element: 'fire', radius: r * 45, power: 1.4 });
        this.sfx('fire_explosion', {});
        if (!this.player.dead && Math.hypot(this.player.gx - gx, this.player.gy - gy) <= r) this.damagePlayer({ amount: e.rollBoss(1.2), type: 'fire' }, e);
        for (const o of this.hostiles()) if (Math.hypot(o.gx - gx, o.gy - gy) <= r) this.damageEnemy(o, { amount: e.rollBoss(1.2), type: 'fire', ally: true, silent: true });
      });
    }
  }

  /** Boss intro: camera zoom, roar, music switch, UI health bar. Called by the boss brain once. */
  engageBoss(e: Enemy): void {
    if (this.bossActive === e) return;
    this.bossActive = e;
    this.sfx('boss_roar', { volume: 1 });
    AudioManager.playMusic('boss');
    this.vfx.zoomPunch(1.18, 500, 900, 700);
    this.vfx.screenShake(0.008, 600);
    this.vfx.shockwave(e.x, e.y, { element: 'shadow', radius: 380, duration: 800 });
    this.vfx.emit('smoke', e.x, e.y - 20, 12, { tint: 0x1a1018, scale: 0.8, scaleEnd: 1.8, alpha: 0.5, life: 1400, speed: [30, 120] });
    EventBus.emit('boss:engaged', { bossId: e.def.id, name: e.def.name, hp: Math.round(e.hp), maxHp: e.maxHp });
    EventBus.emit('boss:poise', { bossId: e.def.id, value: Math.round(e.poise), max: e.maxPoise });
  }

  /** Comedic / dramatic line shown above the boss and sent to the UI. */
  bossTaunt(e: Enemy, text: string): void {
    this.vfx.floatingText(text, e.x, e.y - e.sprite.displayHeight - 30, { color: '#ffe0a0', size: 20, duration: 2600, rise: 30 });
    EventBus.emit('boss:taunt', { bossId: e.def.id, text });
  }

  // ------------------------------------------------------------ projectiles

  spawnProjectile(o: ProjectileOpts): Projectile {
    const p = new Projectile(this, o);
    this.projectiles.push(p);
    return p;
  }

  // ------------------------------------------------------------ player actions

  attackTarget(e: Enemy | null): void {
    this.target = e;
    this.pending = null;
    this.repath = 0;
  }
  clearTarget(): void { this.target = null; this.pending = null; }

  private slotSkill(slot: 'left' | 'right' | number): string | null {
    const s = GameState.profile.skillSlots;
    const v = slot === 'left' ? s[0] : slot === 'right' ? s[1] : s[1 + (slot as number)];
    return v ?? null;
  }

  /** Entry point for the 'skill:use' intent (right click / keys 1-6 / explicit left). */
  useSlot(slot: 'left' | 'right' | 1 | 2 | 3 | 4 | 5 | 6, gx: number, gy: number, targetId?: string): void {
    if (this.player.dead || this.scene.player !== this.player) return;
    const id = this.slotSkill(slot);
    if (!id) return;
    if (id === 'attack') { this.basicAt(gx, gy, targetId); return; }
    const def = SKILL_BY_ID[id];
    if (!def) return;
    const t = targetId ? this.enemyById(targetId) : undefined;
    this.requestCast(id, gx, gy, t, String(slot));
  }

  private basicAt(gx: number, gy: number, targetId?: string): void {
    const t = targetId ? this.enemyById(targetId) : undefined;
    if (t) { this.attackTarget(t); return; }
    this.performBasic(gx, gy);
  }

  /** Cast now if in reach, otherwise walk toward the targeted enemy first (melee skills). */
  private requestCast(skillId: string, gx: number, gy: number, t: Enemy | undefined, slot: string): void {
    const def = SKILL_BY_ID[skillId];
    const p = this.player;
    if (def.targeting === 'melee' && t) {
      const reach = def.range + t.radius;
      if (p.distanceTo(t) > reach) { this.pending = { skillId, gx: t.gx, gy: t.gy, targetId: t.id, slot }; this.target = null; this.repath = 0; return; }
    }
    this.pending = null;
    this.cast(skillId, gx, gy, t);
  }

  private walkTo(gx: number, gy: number): void {
    const m = this.scene.map;
    const g = nearestWalkable(m.isWalkable, { gx: Math.floor(gx), gy: Math.floor(gy) }, 5);
    if (!g) return;
    const start = { gx: Math.floor(this.player.gx), gy: Math.floor(this.player.gy) };
    const path = findPath(m.width, m.height, m.isWalkable, start, g);
    if (path) this.player.setPath(path);
  }

  private playerActions(dtMs: number): void {
    const p = this.player;
    if (this.now < this.stunUntil || p.dashing) return;
    this.repath -= dtMs;
    if (this.pending) {
      const pd = this.pending;
      const t = pd.targetId ? this.enemyById(pd.targetId) : undefined;
      if (!t) { this.pending = null; return; }
      const def = SKILL_BY_ID[pd.skillId];
      if (p.distanceTo(t) > def.range + t.radius) {
        if (this.repath <= 0) { this.repath = 250; this.walkTo(t.gx, t.gy); }
        return;
      }
      p.stop();
      this.pending = null;
      this.cast(pd.skillId, t.gx, t.gy, t);
      return;
    }
    const t = this.target;
    if (!t) return;
    if (t.dead || !t.active || t.charmed) { this.target = null; return; }
    const cls = CLASSES[GameState.profile.classId];
    const left = this.slotSkill('left');
    const ls = left && left !== 'attack' && effectiveLevel(left) > 0 ? SKILL_BY_ID[left] : null;
    const usingSkill = !!ls && GameState.mana >= manaCostOf(ls, effectiveLevel(ls.id)) && !this.onCooldown(ls.id);
    const range = usingSkill && ls
      ? (ls.targeting === 'melee' ? ls.range + t.radius : Math.min(ls.range, 9))
      : cls.basic === 'melee' ? 1.7 + t.radius : 9;
    if (p.distanceTo(t) > range || (cls.basic !== 'melee' && !this.lineClear(p.gx, p.gy, t.gx, t.gy))) {
      if (this.repath <= 0) { this.repath = 250; this.walkTo(t.gx, t.gy); }
      return;
    }
    p.stop();
    if (this.moves.canCast()) p.faceGrid(t.gx - p.gx, t.gy - p.gy);
    if (this.now < this.castUntil) return;
    if (usingSkill && ls && this.moves.canCast()) { if (this.cast(ls.id, t.gx, t.gy, t)) return; }
    this.moves.light(t.gx, t.gy);
  }

  /** True if no wall blocks the straight line between two grid points. */
  lineClear(ax: number, ay: number, bx: number, by: number): boolean {
    const l = Math.hypot(bx - ax, by - ay);
    for (let s = 0.5; s < l; s += 0.5) if (!this.isWalkable(ax + ((bx - ax) * s) / l, ay + ((by - ay) * s) / l)) return false;
    return true;
  }

  onCooldown(id: string): boolean { return this.now < (this.cooldowns.get(id)?.until ?? 0); }

  aim(gx: number, gy: number): { dx: number; dy: number; angle: number } {
    const p = this.player;
    let dx = gx - p.gx, dy = gy - p.gy;
    const l = Math.hypot(dx, dy);
    if (l < 0.05) { dx = p.facingLeft ? -1 : 1; dy = p.facingLeft ? 1 : -1; } // default: screen left/right
    const ll = Math.hypot(dx, dy) || 1;
    dx /= ll; dy /= ll;
    return { dx, dy, angle: Math.atan2(dy, dx) };
  }

  /** Class basic attack: now a committed light-combo swing handled by PlayerMoves. */
  performBasic(gx: number, gy: number, _t?: Enemy): void { this.moves.light(gx, gy); }

  /** Execute a skill: checks cooldown / mana, optional cast time (circle + bar + shout), runs the executor, applies cost & cooldown. */
  cast(skillId: string, gx: number, gy: number, target?: Enemy): boolean {
    const def = SKILL_BY_ID[skillId];
    const p = this.player;
    if (!def || p.dead || p.dashing || this.casting || !this.moves.canCast()) return false;
    const lvl = effectiveLevel(skillId);
    if (lvl <= 0) { this.vfx.floatingText('Habilidad no aprendida', p.x, p.y - 130, { size: 16, color: '#cccccc' }); return false; }
    if (this.now < this.castUntil) return false;
    const cd = this.cooldowns.get(skillId);
    if (cd && this.now < cd.until) { EventBus.emit('skill:failed', { skillId, reason: 'cooldown' }); return false; }
    const cost = manaCostOf(def, lvl);
    if (GameState.mana < cost) {
      EventBus.emit('skill:failed', { skillId, reason: 'mana' });
      if (this.now - this.noManaAt > 900) { this.noManaAt = this.now; this.vfx.floatingText('Sin maná', p.x, p.y - 130, { size: 16, color: '#7fa6ff' }); }
      return false;
    }
    this.moves.onSkillStart();
    const ct = CAST_MS[skillId] ?? 0;
    if (ct <= 0) return this.runSkill(skillId, gx, gy, target, 1);
    // ---- timed cast: ground circle + cast bar + shout, then the executor fires
    const ms = ct / Math.max(0.5, this.derived.castSpeed);
    const a = this.aim(gx, gy);
    p.stop();
    p.faceGrid(a.dx, a.dy);
    const sw = gridToWorld(a.dx, a.dy);
    p.anim.attackLunge(sw.x * 0.4, sw.y * 0.4, Math.min(ms, 200), Math.max(280, ms)); // cast anim spans the whole cast
    this.casting = true;
    this.castUntil = this.now + ms + 60;
    const el = ELEMENT_FX[def.element];
    const gr = GROUND_R[skillId];
    let ground: { gx: number; gy: number; R: number; wx: number; wy: number } | undefined;
    if (gr) { const end = this.clampWalkable(p.gx, p.gy, gx, gy, def.range); const w = gridToWorld(end.fx, end.fy); ground = { gx: end.fx, gy: end.fy, R: gr, wx: w.x, wy: w.y }; }
    const fx = this.vfx.fx.castFx(p.x, p.y, el, ms, { ground });
    this.skillShout(p.x, p.y - 150, def.name, SHOUT_COLOR[def.element]);
    this.sfx('buff', { volume: 0.25 });
    this.after(ms, () => {
      this.casting = false;
      fx.destroy();
      if (p.dead || this.now < this.stunUntil || p.dashing) return;
      this.castUntil = this.now;
      const tg = target && !target.dead ? target : undefined;
      this.runSkill(skillId, tg ? tg.gx : gx, tg ? tg.gy : gy, tg, 0.5, true);
    });
    return true;
  }

  private runSkill(skillId: string, gx: number, gy: number, target: Enemy | undefined, lockMul: number, shouted = false): boolean {
    const def = SKILL_BY_ID[skillId];
    const p = this.player;
    const lvl = effectiveLevel(skillId);
    const cost = manaCostOf(def, lvl);
    if (GameState.mana < cost) return false;
    const a = this.aim(gx, gy);
    const spd = def.element === 'physical' || def.element === 'holy' ? this.derived.attackSpeed : this.derived.castSpeed;
    let lock = 440 / spd;
    const x: SkillCtx = {
      c: this, def, lvl, p, d: this.derived, gx, gy, dx: a.dx, dy: a.dy, angle: a.angle, target,
      v: (k) => skillValue(def, k, lvl),
      lock: (ms) => { lock = ms; },
    };
    const exec = EXECUTORS[skillId];
    if (!exec) return false;
    p.faceGrid(a.dx, a.dy);
    if (exec(x) === false) return false;
    GameState.mana -= cost;
    const total = Math.max(0, cooldownMs(def, lvl));
    if (total > 0) {
      this.cooldowns.set(skillId, { until: this.now + total, total });
      EventBus.emit('skill:cooldown', { skillId, remaining: total, total });
    }
    this.castUntil = this.now + lock * lockMul;
    const sw = gridToWorld(a.dx, a.dy);
    p.anim.attackLunge(sw.x, sw.y, Math.min(220, lock), shouted ? false : undefined); // timed casts already played their anim
    if (!shouted) {
      this.skillShout(p.x, p.y - 150, def.name, SHOUT_COLOR[def.element]);
    }
    this.attackReadyAt = Math.max(this.attackReadyAt, this.now + 250);
    GameState.emitVitals();
    return true;
  }

  // ------------------------------------------------------------ heavy-combat helpers

  /** Attack slots so groups take turns: at most 2 enemies (3 in big packs) attack at once. */
  requestAttack(e: Enemy): boolean {
    if (this.attackers.has(e)) return true;
    const near = this.hostiles().filter((h) => h.aggro && h.distanceTo(this.player) < 9).length;
    const cap = near >= 6 ? 3 : 2;
    if (this.attackers.size >= cap) return false;
    this.attackers.add(e);
    return true;
  }

  /** Camera kick along a grid-space direction; uses GameScene.cameraImpulse when the camera module provides it. */
  impulse(dgx: number, dgy: number, mag: number): void {
    const w = gridToWorld(dgx, dgy);
    const l = Math.hypot(w.x, w.y) || 1;
    const sc = this.scene as unknown as { cameraImpulse?: (dx: number, dy: number, m: number) => void };
    if (sc.cameraImpulse) sc.cameraImpulse(w.x / l, w.y / l, mag);
    else this.vfx.screenShake(Math.min(0.012, 0.003 + mag * 0.005), 110);
  }

  /** Brief slow motion (parry): scales combat time and tweens. */
  slowMo(ms: number, scale: number): void {
    this.timeMul = scale;
    this.slowMoUntil = performance.now() + ms;
    this.scene.tweens.timeScale = scale;
  }

  // ------------------------------------------------------------ cleanup

  destroy(): void {
    this.scene.tweens.timeScale = 1;
    this.moves.reset();
    this.unsub.forEach((u) => u());
    this.unsub = [];
    for (const pr of this.projectiles) pr.destroy();
    this.projectiles = [];
    this.updaters = [];
    this.clearShield();
  }
}