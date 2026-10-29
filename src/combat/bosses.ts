import Phaser from 'phaser';
import { gridToWorld } from '../iso/iso';
import type { Enemy } from '../entities/Enemy';
import { VFX_DEPTH, type Element } from '../vfx/VfxManager';
import type { CombatSystem } from './CombatSystem';
import type { DamageType } from './damage';

export interface BossBrain {
  update(dtMs: number, time: number): void;
  onDamaged(): void;
  destroy(): void;
}

interface Attack {
  id: string;
  weight: number;
  /** Allowed distance band to the player (tiles). */
  min?: number; max?: number;
  /** Starts the attack; returns how long (ms) the boss stays busy. */
  run: () => number;
  /** Optional gate. */
  can?: () => boolean;
}

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Shared boss scaffolding: engage/intro, phase change at 50%, attack picker, movement, helpers. */
abstract class BossBase implements BossBrain {
  protected engaged = false;
  protected phase = 1;
  protected busy = 0;
  protected atkCd = 1500;
  protected basicCd = 0;
  protected introT = 0;
  protected attacks: Attack[] = [];
  protected dead = false;
  protected taunted = new Set<number>();
  /** Preferred distance to the player while idle (0 = melee). */
  protected keep = 0;
  protected readonly intro: string = '';

  constructor(protected e: Enemy, protected c: CombatSystem) {}

  protected get p() { return this.c.player; }
  protected get vfx() { return this.c.vfx; }
  protected dmg(mult = 1): number { return this.e.rollBoss(mult); }
  protected say(t: string): void { this.c.bossTaunt(this.e, t); }
  protected shout(t: string): void { this.c.skillShout(this.e.x, this.e.y - this.e.sprite.displayHeight - 10, t, '#ffb060'); }
  protected later(ms: number, fn: () => void): void { this.c.after(ms, () => { if (!this.dead && !this.e.dead) fn(); }); }
  protected get dist(): number { return this.e.distanceTo(this.p); }
  protected get ang(): number { return Math.atan2(this.p.gy - this.e.gy, this.p.gx - this.e.gx); }
  protected cooldown(): number { return this.phase === 1 ? 2200 : 1400; }

  /** Damage the player if inside a grid circle. */
  protected hitCircle(gx: number, gy: number, r: number, mult: number, type: DamageType = 'physical', color?: string): boolean {
    const p = this.p;
    if (p.dead || Math.hypot(p.gx - gx, p.gy - gy) > r + 0.25) return false;
    this.c.damagePlayer({ amount: this.dmg(mult), type, from: { gx, gy }, color }, this.e);
    return true;
  }

  /** Enemy-owned projectile toward an angle (grid). */
  protected shoot(angle: number, o: { speed?: number; element?: Element; size?: number; mult?: number; type?: DamageType; kind?: 'orb' | 'petal'; range?: number; homing?: number; light?: number; gx?: number; gy?: number; color?: string }): void {
    const e = this.e, c = this.c;
    const mult = o.mult ?? 0.6;
    c.spawnProjectile({
      owner: 'enemy', gx: o.gx ?? e.gx, gy: o.gy ?? e.gy, dx: Math.cos(angle), dy: Math.sin(angle), speed: o.speed ?? 6, range: o.range ?? 14, radius: 0.45,
      element: o.element ?? 'arcane', size: o.size ?? 0.8, kind: o.kind ?? 'orb', light: o.light ?? 80, height: e.sprite.displayHeight * 0.5,
      steer: o.homing ? (pr, dt) => {
        const want = Math.atan2(this.p.gy - pr.gy, this.p.gx - pr.gx), cur = Math.atan2(pr.dy, pr.dx);
        const diff = Phaser.Math.Angle.Wrap(want - cur), step = Phaser.Math.Clamp(diff, -o.homing! * dt / 1000, o.homing! * dt / 1000);
        pr.dx = Math.cos(cur + step); pr.dy = Math.sin(cur + step);
      } : undefined,
      onHit: (pr, t) => {
        c.vfx.impact(pr.worldX, pr.worldY, o.element ?? 'arcane', t !== null);
        if (t === 'player') c.damagePlayer({ amount: this.dmg(mult), type: o.type ?? 'lightning', from: pr, color: o.color }, e);
      },
    });
  }

  /** Ground blast: explosion visuals + damage to the player. */
  protected blast(gx: number, gy: number, r: number, mult: number, element: Element, type: DamageType, power = 1): void {
    const w = gridToWorld(gx, gy);
    this.vfx.explosion(w.x, w.y, { element, radius: r * 45, power, shake: power > 0.8 });
    this.vfx.shockwave(w.x, w.y, { element, radius: r * 100, duration: 450 });
    this.hitCircle(gx, gy, r, mult, type);
  }

  protected setMoving(b: boolean): void { this.e.setMoving(b); }
  protected startPhase2(): void {}
  protected onThreshold(_pct: number): void {}
  protected engageLine(): string { return this.intro; }
  protected onDeathLine(): string { return ''; }

  protected engage(): void {
    this.engaged = true;
    this.e.invulnerable = true;
    this.introT = 1500;
    this.c.engageBoss(this.e);
    const l = this.engageLine();
    if (l) this.later(500, () => this.say(l));
  }

  onDamaged(): void {
    const pct = (this.e.hp / this.e.maxHp) * 100;
    for (const th of [75, 25]) if (pct <= th && !this.taunted.has(th)) { this.taunted.add(th); this.onThreshold(th); }
    if (pct <= 50 && this.phase === 1) { this.phase = 2; this.startPhase2(); }
  }

  update(dt: number, _time?: number): void {
    const e = this.e, p = this.p;
    if (!this.engaged) {
      if (!p.dead && this.dist < (e.def.aggro ?? 11)) this.engage();
      return;
    }
    if (this.introT > 0) { this.introT -= dt; if (this.introT <= 0) e.invulnerable = false; return; }
    if (p.dead) return;
    this.basicCd -= dt;
    if (this.busy > 0) { this.busy -= dt; return; }
    e.faceGrid(p.gx - e.gx, p.gy - e.gy);
    this.atkCd -= dt;
    if (this.atkCd <= 0) {
      const d = this.dist;
      const ok = this.attacks.filter((a) => (a.min === undefined || d >= a.min) && (a.max === undefined || d <= a.max) && (a.can?.() ?? true));
      if (ok.length) {
        const tot = ok.reduce((s, a) => s + a.weight, 0);
        let r = Math.random() * tot;
        let chosen = ok[0];
        for (const a of ok) { r -= a.weight; if (r <= 0) { chosen = a; break; } }
        this.busy = chosen.run();
        this.atkCd = this.cooldown();
        return;
      }
    }
    this.movement(dt);
  }

  /** Default: chase to melee range and swing. */
  protected movement(dt: number): void {
    const e = this.e, a = e.def.atk;
    const d = this.dist;
    if (this.keep > 0) {
      if (d < this.keep - 1.2) this.setMoving(e.stepToward(e.gx + (e.gx - this.p.gx), e.gy + (e.gy - this.p.gy), dt, 0, 0.9));
      else if (d > this.keep + 2) this.setMoving(e.stepToward(this.p.gx, this.p.gy, dt, this.keep));
      return;
    }
    if (d > a.range * 0.8) { this.setMoving(e.stepToward(this.p.gx, this.p.gy, dt, a.range * 0.7)); return; }
    if (this.basicCd <= 0) {
      this.basicCd = a.cooldown * (this.phase === 2 ? 0.75 : 1);
      const ang = this.ang;
      const tele = this.vfx.telegraphCone(e.gx, e.gy, ang, a.range + 0.8, 0.8, a.windup, 0xff5a2a);
      this.busy = a.windup + 200;
      this.later(a.windup, () => {
        tele.destroy();
        const sw = gridToWorld(Math.cos(ang), Math.sin(ang));
        e.anim.attackLunge(sw.x, sw.y);
        this.vfx.slashArc(e.x + sw.x * 0.3, e.y - e.sprite.displayHeight * 0.5, Math.atan2(sw.y, sw.x), { size: 220, ms: 220 });
        this.c.sfx('sword_swing_2', { volume: 0.6 });
        const p = this.p;
        const dx = p.gx - e.gx, dy = p.gy - e.gy, dd = Math.hypot(dx, dy);
        if (dd <= a.range + 1 && (dd < 0.8 || Math.acos(Phaser.Math.Clamp((dx * Math.cos(ang) + dy * Math.sin(ang)) / dd, -1, 1)) < 0.8)) {
          this.c.damagePlayer({ amount: this.dmg(1), type: 'physical', from: e }, e);
        }
      });
    }
  }

  destroy(): void {
    this.dead = true;
    if (this.e.dead && this.engaged) { const l = this.onDeathLine(); if (l) this.c.bossTaunt(this.e, l); }
  }
}

// ======================================================================== Reina Espinas
class ThornQueenBrain extends BossBase {
  protected readonly intro = '¡Mis rosas no son para ti, mortal!';
  constructor(e: Enemy, c: CombatSystem) {
    super(e, c);
    this.attacks = [
      { id: 'thorns', weight: 3, run: () => this.thorns() },
      { id: 'petals', weight: 3, min: 2.5, run: () => this.petals() },
      { id: 'vines', weight: 2, can: () => c.scene.enemies.filter((m) => m.def.id === 'vine' && !m.dead).length < 4, run: () => this.vines() },
    ];
  }
  protected onDeathLine() { return 'Mis... pétalos... se marchitan...'; }
  protected startPhase2(): void {
    const e = this.e;
    e.invulnerable = true; this.busy = 1300;
    this.say('¡Las rosas florecen... con furia!');
    this.vfx.shockwave(e.x, e.y, { element: 'nature', radius: 420, duration: 900 });
    this.vfx.explosion(e.x, e.y - 60, { element: 'love', radius: 120, power: 1.6 });
    e.speed *= 1.2;
    this.vfx.glow(e.sprite, 0xff6aae, 4);
    this.later(1300, () => { e.invulnerable = false; });
  }
  private thorns(): number {
    this.shout('¡Lluvia de Espinas!!');
    const n = this.phase === 1 ? 4 : 7;
    for (let i = 0; i < n; i++) {
      this.later(i * 240, () => {
        const p = this.p;
        const gx = i === 0 ? p.gx : p.gx + rnd(-3, 3), gy = i === 0 ? p.gy : p.gy + rnd(-3, 3);
        if (!this.c.isWalkable(gx, gy)) return;
        const tele = this.vfx.telegraphCircle(gx, gy, 1.4, 850, 0x6cd05a);
        this.later(850, () => {
          tele.destroy();
          const w = gridToWorld(gx, gy);
          this.vfx.emit('stars', w.x, w.y - 20, 12, { tint: 0x9aff7a, scale: 0.24, speed: [60, 280], life: 600 });
          this.vfx.emit('sparks', w.x, w.y - 30, 12, { tint: 0xff8ac8, scale: 0.18, speed: [100, 340], life: 600 });
          this.blast(gx, gy, 1.4, 1.2, 'nature', 'physical', 0.9);
          this.c.sfx('arrow_hit', { volume: 0.5 });
        });
      });
    }
    return n * 240 + 1000;
  }
  private petals(): number {
    this.shout('¡Pétalos Cortantes!!');
    const arms = this.phase === 1 ? 2 : 3;
    const base = this.ang;
    this.c.sfx('heart_sparkle', { volume: 0.6 });
    const tele = this.vfx.telegraphCircle(this.e.gx, this.e.gy, 1.8, 400, 0xff6aae);
    this.later(400, () => {
      tele.destroy();
      this.c.every(1800, 90, (i) => {
        for (let a = 0; a < arms; a++) this.shoot(base + i * 0.32 + (a * Math.PI * 2) / arms, { speed: 4.6, element: 'love', kind: 'petal', size: 1, mult: 0.55, type: 'physical', color: '#ff8ac8', range: 12, light: 60 });
      });
    });
    return 2500;
  }
  private vines(): number {
    this.shout('¡Zarzas Voraces!!');
    const n = this.phase === 1 ? 2 : 3;
    this.say('¡Enredaderas, abrazadlo!');
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = rnd(2.5, 4);
      const gx = this.p.gx + Math.cos(a) * d, gy = this.p.gy + Math.sin(a) * d;
      if (!this.c.isWalkable(gx, gy)) continue;
      const tele = this.vfx.telegraphCircle(gx, gy, 1, 700, 0x6cd05a);
      this.later(700, () => {
        tele.destroy();
        const w = gridToWorld(gx, gy);
        this.vfx.explosion(w.x, w.y, { element: 'nature', radius: 60, power: 0.8, shake: false, decal: false });
        const v = this.c.spawnEnemy('vine', gx, gy, { level: this.e.level });
        v.aggro = true;
      });
    }
    return 1600;
  }
}

// ======================================================================== Ogro Poeta
const POEMS = [
  'Rosas son rojas, tu casco es de hojalata...',
  'Mi amor es profundo... como tu tumba.',
  'Oh, musa cruel, ¡tu espada me desata!',
  'Violetas son moradas, tus chistes... horrendos.',
  'Verso libre: ¡AAAARGH!',
];
class OgrePoetBrain extends BossBase {
  protected readonly intro = '¡Silencio! ¡Declamo mi obra maestra!';
  constructor(e: Enemy, c: CombatSystem) {
    super(e, c);
    this.attacks = [
      { id: 'slam', weight: 3, max: 6, run: () => this.slam() },
      { id: 'poem', weight: 3, max: 8, run: () => this.poem() },
      { id: 'rock', weight: 3, min: 3, run: () => this.rock() },
    ];
  }
  protected onDeathLine() { return 'Mi... obra... inconclusa...'; }
  protected onThreshold(p: number): void { this.say(p === 75 ? '¡Eso no rima!' : '¡Mis versos! ¡Me hieres con críticas!'); }
  protected startPhase2(): void {
    const e = this.e;
    e.invulnerable = true; this.busy = 1300;
    this.say('¡Ahora viene el SEGUNDO ACTO!');
    this.vfx.shockwave(e.x, e.y, { element: 'physical', radius: 420, duration: 900 });
    this.vfx.explosion(e.x, e.y - 60, { element: 'physical', radius: 120, power: 1.6 });
    e.speed *= 1.25;
    this.later(1300, () => { e.invulnerable = false; });
  }
  private slam(): number {
    this.shout('¡Golpe Sísmico!!');
    const e = this.e;
    const r = 3.2;
    const tele = this.vfx.telegraphCircle(e.gx, e.gy, r, 1000, 0xff5a2a);
    let tele2: { destroy: () => void } | null = null;
    if (this.phase === 2) tele2 = this.vfx.telegraphCircle(e.gx, e.gy, 5.4, 1500, 0xff5a2a);
    this.later(1000, () => {
      tele.destroy();
      this.c.sfx('sword_hit_2', { volume: 1 });
      this.vfx.emit('dirt', e.x, e.y - 10, 16, { tint: 0x6a5a48, scale: 0.4, speed: [100, 340], life: 800 });
      this.blast(e.gx, e.gy, r, 1.5, 'physical', 'physical', 1.4);
      if (!this.p.dead && this.p.distanceTo(e) <= r + 0.25) this.c.stunPlayer(500);
      this.vfx.screenShake(0.01, 300);
    });
    if (tele2) this.later(1500, () => {
      tele2!.destroy();
      const w = gridToWorld(e.gx, e.gy);
      this.vfx.shockwave(w.x, w.y, { element: 'physical', radius: 5.4 * 100, duration: 600, thick: true });
      this.vfx.explosion(w.x, w.y, { element: 'physical', radius: 150, power: 1.2 });
      const d = this.p.distanceTo(e);
      if (d > r && d <= 5.6) this.c.damagePlayer({ amount: this.dmg(1.2), type: 'physical', from: e }, e);
    });
    return this.phase === 2 ? 1900 : 1500;
  }
  private poem(): number {
    this.shout('¡Poema Aturdidor!!');
    const e = this.e;
    const ang = this.ang;
    this.say(pick(POEMS));
    const tele = this.vfx.telegraphCone(e.gx, e.gy, ang, 6.5, 0.85, 1200, 0xd070ff);
    this.later(1200, () => {
      tele.destroy();
      this.c.sfx('heart_sparkle', { volume: 0.8 });
      const b = { x: e.x, y: e.y - e.sprite.displayHeight * 0.6 };
      for (let i = 0; i < 14; i++) {
        const a = ang - 0.85 + (1.7 * i) / 13;
        const w = gridToWorld(Math.cos(a), Math.sin(a));
        const l = Math.hypot(w.x, w.y) || 1;
        this.vfx.emit('stars', b.x + (w.x / l) * 40, b.y + (w.y / l) * 20, 2, { tint: 0xe0a0ff, scale: 0.26, speed: [200, 420], life: 700 });
      }
      this.vfx.emit('swirl', b.x, b.y, 6, { tint: 0xd070ff, scale: 0.5, speed: [60, 220], life: 700 });
      const p = this.p;
      const dx = p.gx - e.gx, dy = p.gy - e.gy, dd = Math.hypot(dx, dy);
      if (!p.dead && dd <= 6.8 && Math.acos(Phaser.Math.Clamp((dx * Math.cos(ang) + dy * Math.sin(ang)) / (dd || 1), -1, 1)) <= 0.85) {
        this.c.damagePlayer({ amount: this.dmg(0.5), type: 'physical', from: e, color: '#e0a0ff' }, e);
        this.c.confusePlayer(4000);
      }
    });
    return 1900;
  }
  private rock(): number {
    this.shout('¡Roca Rodante!!');
    const n = this.phase === 1 ? 1 : 3;
    this.c.sfx('boss_roar', { volume: 0.4 });
    for (let i = 0; i < n; i++) {
      this.later(i * 450, () => {
        const p = this.p;
        const gx = p.gx + (i ? rnd(-2.5, 2.5) : 0), gy = p.gy + (i ? rnd(-2.5, 2.5) : 0);
        const w = gridToWorld(gx, gy);
        const tele = this.vfx.telegraphCircle(gx, gy, 1.6, 900, 0xff5a2a);
        const rock = this.c.scene.add.image(w.x, w.y - 700, 'fx_rock').setScale(3).setDepth(VFX_DEPTH);
        this.c.scene.tweens.add({ targets: rock, y: w.y, angle: 360, duration: 900, ease: 'Quad.easeIn', onComplete: () => {
          rock.destroy(); tele.destroy();
          this.vfx.emit('dirt', w.x, w.y - 10, 12, { tint: 0x6a5a48, scale: 0.35, speed: [80, 300], life: 700 });
          this.blast(gx, gy, 1.6, 1.3, 'physical', 'physical', 1);
          this.c.sfx('sword_hit_2', { volume: 0.7 });
        } });
      });
    }
    return n * 450 + 1000;
  }
}

// ======================================================================== Gárgola Celosa
class GargoyleBrain extends BossBase {
  protected readonly intro = '¡¿Quién es esa... piedra bonita a tu lado?!';
  private stoneT = 0;
  private stoneUntil = 0;
  constructor(e: Enemy, c: CombatSystem) {
    super(e, c);
    this.attacks = [
      { id: 'dive', weight: 4, run: () => this.dive() },
      { id: 'beam', weight: 3, min: 2, run: () => this.beam() },
    ];
  }
  protected onDeathLine() { return 'Al menos... soy la gárgola más guapa...'; }
  protected onThreshold(p: number): void { this.say(p === 75 ? '¡Me das celos hasta cuando sangras!' : '¡NO ME DEJES!'); }
  protected startPhase2(): void { this.say('¡Piedra soy... y piedra seré!'); this.stoneSkin(); }
  protected cooldown(): number { return this.phase === 1 ? 2000 : 1300; }
  update(dt: number, time: number): void {
    super.update(dt, time);
    if (this.phase === 2 && this.engaged) {
      this.stoneT -= dt;
      if (this.stoneUntil && this.c.now > this.stoneUntil) {
        this.stoneUntil = 0; this.e.dmgMult = 1; this.e.anim.baseTint = undefined; this.e.sprite.clearTint();
        this.vfx.explosion(this.e.x, this.e.y - 50, { element: 'physical', radius: 80, power: 1, shake: false, decal: false });
      }
      if (this.stoneT <= 0 && !this.stoneUntil && this.busy <= 0) this.stoneSkin();
    }
  }
  private stoneSkin(): void {
    this.shout('¡Piel de Piedra!!');
    const e = this.e;
    this.stoneT = 16000;
    this.stoneUntil = this.c.now + 6000;
    e.dmgMult = 0.3;
    e.anim.baseTint = 0x8890a0; e.sprite.setTint(0x8890a0);
    this.vfx.shockwave(e.x, e.y, { element: 'physical', radius: 250, duration: 700 });
    this.vfx.floatingText('¡Piel de piedra!', e.x, e.y - e.sprite.displayHeight - 60, { color: '#b8c0d0', size: 22 });
  }
  private dive(): number {
    this.shout('¡Picado Mortal!!');
    const e = this.e, c = this.c;
    const times = this.phase === 2 ? 2 : 1;
    let t0 = 0;
    for (let k = 0; k < times; k++) {
      this.later(t0, () => {
        e.invulnerable = true;
        c.scene.tweens.add({ targets: e, alpha: 0, duration: 350 });
        this.vfx.emit('smoke', e.x, e.y - 40, 6, { tint: 0x707890, scale: 0.4, scaleEnd: 0.9, alpha: 0.5, life: 700 });
        this.later(500, () => {
          const p = this.p;
          const gx = p.gx, gy = p.gy;
          const tele = this.vfx.telegraphCircle(gx, gy, 2.2, 1000, 0x6aff6a);
          this.later(1000, () => {
            tele.destroy();
            e.setGrid(gx, gy);
            e.invulnerable = false;
            const ground = e.y;
            e.y = ground - 520; e.setAlpha(1);
            c.scene.tweens.add({ targets: e, y: ground, duration: 220, ease: 'Quad.easeIn', onComplete: () => {
              this.vfx.emit('dirt', e.x, e.y, 14, { tint: 0x707890, scale: 0.4, speed: [100, 340], life: 800 });
              this.blast(gx, gy, 2.2, 1.7, 'physical', 'physical', 1.3);
              c.sfx('sword_hit_2', { volume: 1 });
              this.vfx.screenShake(0.011, 280);
            } });
          });
        });
      });
      t0 += 2200;
    }
    return t0 + 400;
  }
  private beam(): number {
    this.shout('¡Rayo Pétreo!!');
    const e = this.e, c = this.c;
    const base = this.ang;
    const tele = this.vfx.telegraphLine(e.gx, e.gy, base, 14, 1.4, 900, 0x6aff6a);
    this.say('¡Mírame a MÍ!');
    this.later(900, () => {
      tele.destroy();
      c.sfx('lightning', { volume: 0.9 });
      const g = c.scene.add.graphics().setDepth(VFX_DEPTH + 2).setBlendMode(Phaser.BlendModes.ADD);
      const dur = 1400, sweep = this.phase === 2 ? 0.9 : 0.55;
      let t = 0, acc = 0;
      const light = this.vfx.addLight(e.x, e.y, 200, 0.8);
      c.addUpdater((dt) => {
        t += dt; acc += dt;
        const k = t / dur;
        if (k >= 1 || e.dead) { g.destroy(); if (light) light.dead = true; return false; }
        const a = base - sweep + 2 * sweep * k;
        const ox = e.x, oy = e.y - e.sprite.displayHeight * 0.55;
        const end = gridToWorld(e.gx + Math.cos(a) * 14, e.gy + Math.sin(a) * 14);
        g.clear();
        const wob = Math.sin(t / 40) * 3;
        g.lineStyle(26 + wob, 0x3acf4a, 0.25); g.lineBetween(ox, oy, end.x, end.y - 40);
        g.lineStyle(12, 0x8aff7a, 0.7); g.lineBetween(ox, oy, end.x, end.y - 40);
        g.lineStyle(4, 0xe8ffe0, 1); g.lineBetween(ox, oy, end.x, end.y - 40);
        if (light) { light.x = (ox + end.x) / 2; light.y = (oy + end.y) / 2; light.radius = 220; }
        const bp = gridToWorld(e.gx + Math.cos(a) * (3 + 8 * (k % 0.2) * 5), e.gy + Math.sin(a) * (3 + 8 * (k % 0.2) * 5));
        this.vfx.emit('sparks', bp.x, bp.y - 20, 1, { tint: 0x8aff7a, scale: 0.12, speed: [20, 90], life: 300 });
        if (acc >= 150) {
          acc = 0;
          const p = this.p;
          const rx = p.gx - e.gx, ry = p.gy - e.gy;
          const along = rx * Math.cos(a) + ry * Math.sin(a), perp = Math.abs(-rx * Math.sin(a) + ry * Math.cos(a));
          if (along > 0 && along < 14.5 && perp < 0.85) c.damagePlayer({ amount: this.dmg(0.4), type: 'lightning', from: e, color: '#8aff7a' }, e);
        }
        return true;
      });
    });
    return 2500;
  }
}

// ======================================================================== Lord Malvarrón
const MALV_INTRO = '¡Ah, el héroe! ¿Vienes a perder con estilo?';
const MALV_TELEPORT = ['¡Pf! Demasiado lento.', '¿Me buscabas? ¡Estoy aquí!', 'Tele-transporte... ¡y tele-peinado!', '¡Atrápame si puedes, patán!'];
const MALV_HURT = ['¡Mi capa! ¡Es de seda!', '¡Auch! ¡Eso no estaba en el guion!', '¿Quién te enseñó a pegar así?'];
class MalvarronBrain extends BossBase {
  protected readonly intro = MALV_INTRO;
  constructor(e: Enemy, c: CombatSystem) {
    super(e, c);
    this.keep = 6;
    this.attacks = [
      { id: 'tp', weight: 2, run: () => this.teleport(true) },
      { id: 'missiles', weight: 4, run: () => this.missiles() },
      { id: 'clones', weight: 2, can: () => !c.scene.enemies.some((m) => m.def.id === 'mirror_clone' && !m.dead), run: () => this.clones() },
      { id: 'meteors', weight: 3, can: () => this.phase === 2, run: () => this.meteors() },
    ];
  }
  protected onDeathLine() { return '¡Imposible! ¡Mi cabello... mi fama... Amaranta...!'; }
  protected onThreshold(p: number): void { this.say(p === 75 ? pick(MALV_HURT) : '¡Está bien, está bien! ¡Me toca ponerme serio!'); }
  protected startPhase2(): void {
    const e = this.e;
    this.say('¡Basta de juegos! ¡Voy a usar mi MEJOR hechizo!');
    this.vfx.shockwave(e.x, e.y, { element: 'arcane', radius: 480, duration: 900 });
    this.vfx.explosion(e.x, e.y - 60, { element: 'arcane', radius: 140, power: 1.8 });
    e.speed *= 1.2;
    this.vfx.glow(e.sprite, 0xc060ff, 5);
    this.atkCd = 500;
  }
  protected cooldown(): number { return this.phase === 1 ? 1800 : 1100; }
  private teleport(taunt: boolean): number {
    const e = this.e, c = this.c;
    if (taunt && Math.random() < 0.6) this.say(pick(MALV_TELEPORT));
    c.sfx('portal', { volume: 0.7 });
    this.vfx.explosion(e.x, e.y - 50, { element: 'arcane', radius: 90, power: 1, shake: false, decal: false });
    this.vfx.decal('magic_circle', e.x, e.y, { scale: 0.6, tint: 0xc060ff, duration: 800, blend: 'ADD', spin: 180 });
    e.invulnerable = true;
    e.setAlpha(0);
    this.later(550, () => {
      const p = this.p;
      for (let tries = 0; tries < 20; tries++) {
        const a = Math.random() * Math.PI * 2, d = rnd(4.5, 6.5);
        const gx = p.gx + Math.cos(a) * d, gy = p.gy + Math.sin(a) * d;
        if (c.isWalkable(gx, gy) && c.lineClear(p.gx, p.gy, gx, gy)) { e.setGrid(gx, gy); break; }
      }
      e.setAlpha(1);
      e.invulnerable = false;
      this.vfx.explosion(e.x, e.y - 50, { element: 'arcane', radius: 90, power: 1, shake: false, decal: false });
    });
    return 900;
  }
  private missiles(): number {
    this.shout('¡Misiles Arcanos!!');
    const volleys = this.phase === 1 ? 3 : 4, per = this.phase === 1 ? 5 : 7;
    this.c.sfx('fireball_cast', { volume: 0.5 });
    for (let v = 0; v < volleys; v++) {
      this.later(500 + v * 480, () => {
        const base = this.ang;
        this.c.sfx('lightning', { volume: 0.4 });
        this.vfx.flash(this.e.x, this.e.y - this.e.sprite.displayHeight * 0.6, { element: 'arcane', size: 110, ms: 200 });
        for (let i = 0; i < per; i++) this.shoot(base - 0.5 + (1 * i) / (per - 1), { speed: 6.5, element: 'arcane', size: 0.65, mult: 0.5, type: 'lightning', homing: 0.9, light: 80, color: '#e0b0ff' });
      });
    }
    return 500 + volleys * 480 + 500;
  }
  private clones(): number {
    this.shout('¡Ilusión Doble!!');
    const e = this.e, c = this.c;
    const n = this.phase === 1 ? 2 : 3;
    this.say('¿Cuál es el verdadero? ¡Elige con cuidado, querido!');
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 15; tries++) {
        const a = (i / n) * Math.PI * 2 + Math.random(), d = rnd(3, 5);
        const gx = e.gx + Math.cos(a) * d, gy = e.gy + Math.sin(a) * d;
        if (!c.isWalkable(gx, gy)) continue;
        const cl = c.spawnEnemy('mirror_clone', gx, gy, { level: e.level });
        const w = gridToWorld(gx, gy);
        this.vfx.explosion(w.x, w.y - 40, { element: 'arcane', radius: 60, power: 0.7, shake: false, decal: false });
        c.after(10000, () => { if (!cl.dead) { this.vfx.explosion(cl.x, cl.y - 40, { element: 'arcane', radius: 50, power: 0.6, shake: false, decal: false }); cl.vanish(); } });
        break;
      }
    }
    return 1000 + this.teleportDelay();
  }
  private teleportDelay(): number { this.later(900, () => { this.teleport(false); }); return 1000; }
  private meteors(): number {
    this.shout('¡Lluvia de Meteoros!!');
    this.say('¡Lluvia de meteoritos! ¡Con mucho cariño!');
    for (let i = 0; i < 7; i++) {
      this.later(i * 260, () => {
        const p = this.p;
        const gx = i % 2 === 0 ? p.gx : p.gx + rnd(-3.5, 3.5), gy = i % 2 === 0 ? p.gy : p.gy + rnd(-3.5, 3.5);
        if (!this.c.isWalkable(gx, gy)) return;
        const w = gridToWorld(gx, gy);
        const tele = this.vfx.telegraphCircle(gx, gy, 1.6, 1000, 0xff6a2a);
        const rock = this.c.scene.add.image(w.x + 160, w.y - 560, 'vfx_fire').setTint(0xffb050).setBlendMode(Phaser.BlendModes.ADD).setScale(0.9).setDepth(VFX_DEPTH);
        this.c.scene.tweens.add({ targets: rock, x: w.x, y: w.y, duration: 1000, ease: 'Quad.easeIn', onUpdate: () => this.vfx.trail(rock.x, rock.y, 'fire', 1.6), onComplete: () => {
          rock.destroy(); tele.destroy();
          this.blast(gx, gy, 1.6, 1.4, 'fire', 'fire', 1.1);
          this.c.sfx('fire_explosion', { volume: 0.7 });
        } });
      });
    }
    return 2800;
  }
}

export function createBossBrain(e: Enemy, c: CombatSystem): BossBrain | undefined {
  switch (e.def.id) {
    case 'thorn_queen': return new ThornQueenBrain(e, c);
    case 'ogre_poet': return new OgrePoetBrain(e, c);
    case 'jealous_gargoyle': return new GargoyleBrain(e, c);
    case 'malvarron': return new MalvarronBrain(e, c);
    default: return undefined;
  }
}