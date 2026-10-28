import Phaser from 'phaser';
import { CLASSES } from '../data/classes';
import { GameState } from '../core/GameState';
import type { CombatSystem } from '../combat/CombatSystem';
import type { DerivedStats } from '../combat/stats';
import { rollPlayerDamage } from '../combat/damage';
import type { SkillDef } from '../data/skills';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { gridToWorld } from '../iso/iso';
import { PALETTE, VFX_DEPTH, type Element } from '../vfx/VfxManager';

export interface SkillCtx {
  c: CombatSystem;
  def: SkillDef;
  lvl: number;
  p: Player;
  d: DerivedStats;
  /** Aim point (grid). */
  gx: number; gy: number;
  /** Unit aim direction (grid). */
  dx: number; dy: number;
  /** Aim angle in grid space. */
  angle: number;
  target?: Enemy;
  /** Scaled skill value (see SkillDef.values). */
  v: (key: string) => number;
  /** Override the cast lock (ms the hero cannot move). */
  lock: (ms: number) => void;
}
type Exec = (x: SkillCtx) => boolean | void;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const body = (p: Player) => ({ x: p.x, y: p.y - 45 });

/** Ghost image of the hero that fades away (dash afterimages). */
function afterimage(x: SkillCtx, tint: number): void {
  const p = x.p, s = p.sprite;
  const img = p.scene.add.image(p.x, p.y, s.texture.key).setOrigin(0.5, 1).setScale(s.scaleX, s.scaleY).setFlipX(s.flipX).setTint(tint).setAlpha(0.55)
    .setDepth(p.depth - 1).setBlendMode(Phaser.BlendModes.ADD);
  p.scene.tweens.add({ targets: img, alpha: 0, duration: 320, onComplete: () => img.destroy() });
}

/** Sector test: is `e` within `reach` tiles and `halfAngle` of the aim direction? */
function inCone(x: SkillCtx, e: Enemy, reach: number, halfAngle: number): boolean {
  const ex = e.gx - x.p.gx, ey = e.gy - x.p.gy, d = Math.hypot(ex, ey);
  if (d > reach + e.radius) return false;
  if (d < 0.7) return true;
  return Math.acos(Phaser.Math.Clamp((ex * x.dx + ey * x.dy) / d, -1, 1)) <= halfAngle;
}

/** Area hit helper: percent of player damage to every enemy in a circle (grid). */
function areaHit(x: SkillCtx, gx: number, gy: number, r: number, pct: number, type: 'physical' | 'fire' | 'cold' | 'lightning', o: Parameters<CombatSystem['playerHit']>[3] = {}): Enemy[] {
  const hit = x.c.enemiesInCircle(gx, gy, r);
  for (const e of hit) x.c.playerHit(e, pct, type, { from: { gx, gy }, ...o });
  return hit;
}

type Traps = { gx: number; gy: number; armedAt: number; until: number; fx: Phaser.GameObjects.Image[]; light: { dead?: boolean } | null; dead: boolean }[];
const TRAPS = new WeakMap<CombatSystem, Traps>();

export const EXECUTORS: Record<string, Exec> = {
  // ================================================================ Caballero Galante
  golpe_valiente: (x) => {
    const { c, p } = x;
    const pct = x.v('dmg');
    const sw = gridToWorld(x.dx, x.dy);
    c.sfx('sword_swing', { volume: 0.8 });
    const b = body(p);
    c.vfx.slashArc(b.x + sw.x * 0.3, b.y + sw.y * 0.3, Math.atan2(sw.y, sw.x), { size: 260, ms: 240 });
    c.vfx.slashArc(b.x + sw.x * 0.3, b.y + sw.y * 0.3 + 6, Math.atan2(sw.y, sw.x) + 0.25, { size: 220, ms: 200, element: 'holy' });
    c.after(110, () => {
      for (const e of c.hostiles()) if (inCone(x, e, x.def.range + 0.3, 1.4)) c.playerHit(e, pct, 'physical', { knockback: 0.6 });
    });
    x.lock(340 / x.d.attackSpeed);
  },

  torbellino: (x) => {
    const { c, p } = x;
    const dur = x.v('dur') * 1000, pct = x.v('dmg');
    const r = x.def.range;
    c.sfx('sword_swing_2', { volume: 0.8 });
    x.lock(dur + 100);
    p.stop();
    let flip = false;
    c.every(dur, 150, (i) => {
      if (p.dead) return;
      const b = body(p);
      flip = !flip;
      p.sprite.setFlipX(flip);
      c.vfx.slashArc(b.x, b.y, (i * 1.3) % (Math.PI * 2), { size: 300, ms: 200 });
      c.vfx.shockwave(p.x, p.y, { element: 'physical', radius: r * 60, duration: 260 });
      c.vfx.emit('sparks', b.x, b.y, 6, { tint: 0xffe8c0, scale: 0.16, speed: [120, 300] });
      c.sfx('sword_swing', { volume: 0.4 });
      areaHit(x, p.gx, p.gy, r, pct, 'physical', { knockback: 0.5, silent: i % 2 === 1 });
    }, () => { p.anim.setFacingLeft(p.facingLeft); });
  },

  escudo_radiante: (x) => {
    const { c, p } = x;
    const lvlMul = 1 + GameState.profile.level * 0.05;
    c.clearShield();
    c.shieldAbsorb = x.v('absorb') * lvlMul;
    c.shieldUntil = c.now + x.v('dur') * 1000;
    c.sfx('buff', {});
    const circle = c.vfx.groundCircle(p.x, p.y, { scale: 0.55, tint: 0xffd45a, alpha: 0.8, spin: 4000 });
    const aura = c.vfx.aura(p, { element: 'holy', tex: 'star', height: 50, rate: 90, scale: 0.22 });
    const light = c.vfx.addLight(p.x, p.y - 40, 170, 0.8);
    const bubble = p.scene.add.image(p.x, p.y - 45, 'fx_disc').setTint(0xffe090).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setScale(0.55).setDepth(VFX_DEPTH - 3);
    c.vfx.glow(bubble, 0xffd45a, 3);
    c.shieldFx = { destroy: () => { circle?.destroy(); aura.destroy(); bubble.destroy(); if (light) light.dead = true; } };
    const fx = c.shieldFx;
    c.addUpdater(() => {
      if (c.shieldFx !== fx) return false;
      circle?.setPosition(p.x, p.y); bubble.setPosition(p.x, p.y - 45);
      bubble.setAlpha(0.22 + Math.sin(c.now / 160) * 0.08);
      if (light) { light.x = p.x; light.y = p.y - 40; }
      return true;
    });
    c.vfx.explosion(p.x, p.y - 40, { element: 'holy', radius: 70, power: 0.8, shake: false, decal: false });
    c.vfx.floatingText('¡Escudo Radiante!', p.x, p.y - 130, { color: '#ffe680', size: 18 });
  },

  aura_coraje: (x) => {
    const { c, p } = x;
    const dur = x.v('dur') * 1000, pct = x.v('dmg'), r = x.def.range;
    c.sfx('buff', {});
    const circle = c.vfx.groundCircle(p.x, p.y, { scale: r * 0.5, tint: 0xffd45a, alpha: 0.55, spin: 6000 });
    const light = c.vfx.addLight(p.x, p.y - 20, 200, 0.7);
    c.vfx.shockwave(p.x, p.y, { element: 'holy', radius: r * 70, duration: 600 });
    let acc = 0, left = dur;
    c.addUpdater((dt) => {
      left -= dt; acc += dt;
      circle?.setPosition(p.x, p.y);
      if (light) { light.x = p.x; light.y = p.y - 20; }
      if (acc >= 600 && !p.dead) {
        acc = 0;
        c.vfx.emit('stars', p.x, p.y - 20, 6, { tint: 0xffe680, scale: 0.16, speed: [40, r * 55], life: 700 });
        for (const e of c.enemiesInCircle(p.gx, p.gy, r)) c.playerHit(e, pct, 'fire', { knockback: 0, silent: true, color: '#ffe680', dot: true });
      }
      if (left <= 0 || p.dead) { circle?.destroy(); if (light) light.dead = true; return false; }
      return true;
    });
    x.lock(300);
  },

  carga_heroica: (x) => {
    const { c, p } = x;
    const t = x.target ?? c.nearestHostile(x.gx, x.gy, 3);
    const tgx = t ? t.gx : x.gx, tgy = t ? t.gy : x.gy;
    const ax = tgx - p.gx, ay = tgy - p.gy, l = Math.hypot(ax, ay) || 1;
    const dist = Math.min(x.def.range, Math.max(0, l - (t ? 1.2 : 0)));
    if (dist < 0.8) return false;
    const end = c.clampWalkable(p.gx, p.gy, p.gx + ax, p.gy + ay, dist);
    c.sfx('sword_swing_2', { volume: 0.9 });
    c.invulnerable = true;
    p.faceGrid(ax, ay);
    const pct = x.v('dmg'), stun = x.v('stun') * 1000;
    let k = 0;
    p.dashTo(end.fx, end.fy, 260, () => {
      c.invulnerable = false;
      if (p.dead) return;
      c.vfx.explosion(p.x, p.y - 20, { element: 'physical', radius: 80, power: 1, shake: true });
      c.vfx.shockwave(p.x, p.y, { element: 'holy', radius: 200, duration: 400 });
      for (const e of areaHit(x, p.gx, p.gy, 2.0, pct, 'physical', { knockback: 1.0 })) e.stun(stun);
      c.vfx.hitStop(60);
    }, () => { if (k++ % 2 === 0) afterimage(x, 0xfff0c0); c.vfx.trail(p.x, p.y - 40, 'holy', 1.2); });
    x.lock(420);
  },

  martillo_celestial: (x) => {
    const { c, p } = x;
    const n = Math.floor(x.v('n')), pct = x.v('dmg');
    c.sfx('buff', {});
    c.vfx.shockwave(p.x, p.y, { element: 'holy', radius: 140, duration: 400 });
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      let t = 0;
      c.spawnProjectile({
        owner: 'player', gx: p.gx, gy: p.gy, dx: 1, dy: 0, speed: 0, range: 99, radius: 0.8, element: 'holy', kind: 'hammer', size: 1.5, light: 150, pierce: 99, ghost: true, height: 46,
        steer: (pr, dt) => {
          t += dt / 1000;
          const r = 0.8 + t * 4.2, a = a0 + t * 3.4;
          pr.gx = p.gx + Math.cos(a) * r; pr.gy = p.gy + Math.sin(a) * r;
          if (t > 1.7) { c.vfx.explosion(pr.worldX, pr.worldY, { element: 'holy', radius: 50, power: 0.6, shake: false, decal: false }); pr.destroy(); }
        },
        onHit: (pr, tg) => {
          if (tg && tg !== 'player') {
            c.playerHit(tg, pct, 'physical', { knockback: 0.7, color: '#ffe680', silent: true });
            c.sfx('sword_hit_2', { volume: 0.6 });
            c.vfx.impact(pr.worldX, pr.worldY, 'holy', true);
          }
        },
      });
    }
    x.lock(450);
  },

  // ================================================================ Arcanista
  bola_fuego: (x) => {
    const { c, p } = x;
    const pct = x.v('dmg');
    const burnDps = ((x.d.damageMin + x.d.damageMax) / 2) * (x.v('burn') / 100);
    c.sfx('fireball_cast', {});
    const b = body(p);
    c.vfx.flash(b.x, b.y, { element: 'fire', size: 140, ms: 180 });
    c.spawnProjectile({
      owner: 'player', gx: p.gx, gy: p.gy, dx: x.dx, dy: x.dy, speed: 11, range: x.def.range, radius: 0.5, element: 'fire', size: 1.2, light: 190, height: 46,
      onHit: (pr, tg) => {
        const r = 1.8;
        const w = { x: pr.worldX, y: pr.worldY + 30 };
        c.vfx.explosion(w.x, w.y - 10, { element: 'fire', radius: r * 45, power: 1.2 });
        c.sfx('fire_explosion', { volume: 0.9 });
        void tg;
        for (const e of areaHit(x, pr.gx, pr.gy, r, pct, 'fire', { knockback: 0.8 })) e.burn(burnDps, 3000);
      },
    });
    x.lock(360 / x.d.castSpeed);
  },

  meteoro: (x) => {
    const { c, p } = x;
    const pct = x.v('dmg'), fire = x.v('fire');
    const end = c.clampWalkable(p.gx, p.gy, x.gx, x.gy, x.def.range);
    const gx = end.fx, gy = end.fy;
    const w = gridToWorld(gx, gy);
    const R = 2.5;
    c.sfx('fireball_cast', { volume: 1 });
    const tele = c.vfx.telegraphCircle(gx, gy, R, 1200, 0xff6a2a);
    const circle = c.vfx.groundCircle(w.x, w.y, { scale: R * 0.62, tint: 0xff8a3a, alpha: 0.9, spin: 1500 });
    const rock = p.scene.add.image(w.x + 220, w.y - 620, 'vfx_fire').setTint(0xffb050).setBlendMode(Phaser.BlendModes.ADD).setScale(1.1).setDepth(VFX_DEPTH);
    const core = p.scene.add.image(rock.x, rock.y, 'vfx_flare').setTint(0xfff0c0).setBlendMode(Phaser.BlendModes.ADD).setScale(0.8).setDepth(VFX_DEPTH + 1);
    c.vfx.glow(core, 0xff7a1e, 6);
    const light = c.vfx.addLight(rock.x, rock.y, 260, 1);
    let t = 0;
    c.addUpdater((dt) => {
      t += dt;
      const k = Math.min(1, t / 1200), e = k * k;
      rock.setPosition(w.x + 220 * (1 - e), w.y - 620 * (1 - e)); core.setPosition(rock.x, rock.y);
      if (light) { light.x = rock.x; light.y = rock.y; }
      c.vfx.trail(rock.x, rock.y, 'fire', 2.2);
      if (k < 1) return true;
      rock.destroy(); core.destroy(); circle?.destroy(); tele.destroy();
      if (light) light.dead = true;
      c.vfx.explosion(w.x, w.y - 10, { element: 'fire', radius: R * 60, power: 2.2 });
      c.vfx.shockwave(w.x, w.y, { element: 'fire', radius: R * 110, duration: 600 });
      c.vfx.screenShake(0.012, 350);
      c.vfx.hitStop(80);
      c.sfx('fire_explosion', {});
      areaHit(x, gx, gy, R, pct, 'fire', { knockback: 1.2 });
      // burning ground
      const gl = c.vfx.addLight(w.x, w.y - 10, 220, 0.9);
      let acc = 0, left = 4000;
      c.addUpdater((d2) => {
        left -= d2; acc += d2;
        if (acc >= 500) {
          acc = 0;
          c.vfx.emit('fire', w.x + rnd(-100, 100), w.y + rnd(-30, 30), 6, { tint: 0xff7a1e, scale: 0.6, scaleEnd: 0.1, speed: [10, 50], life: 600 });
          c.vfx.emit('smoke', w.x + rnd(-80, 80), w.y - 10, 1, { tint: 0x2a2220, scale: 0.4, scaleEnd: 0.9, alpha: 0.3, life: 900 });
          for (const en of c.enemiesInCircle(gx, gy, R)) c.playerHit(en, fire, 'fire', { knockback: 0, silent: true, dot: true });
        }
        if (gl) gl.strength = Math.min(1, left / 1200);
        if (left <= 0) { if (gl) gl.dead = true; return false; }
        return true;
      });
      return false;
    });
    x.lock(500 / x.d.castSpeed);
  },

  nova_hielo: (x) => {
    const { c, p } = x;
    const pct = x.v('dmg'), slow = 1 - x.v('slow') / 100, dur = x.v('dur') * 1000;
    const R = x.def.range;
    c.sfx('ice_cast', {});
    c.vfx.explosion(p.x, p.y - 20, { element: 'ice', radius: 80, power: 1.2, shake: true, decal: false });
    c.vfx.shockwave(p.x, p.y, { element: 'ice', radius: R * 90, duration: 520, thick: true });
    c.vfx.shockwave(p.x, p.y, { element: 'ice', radius: R * 60, duration: 380 });
    c.vfx.decal('magic_circle', p.x, p.y, { scale: R * 0.5, tint: 0x8fdcff, duration: 900, blend: 'ADD', spin: 90, alpha: 0.7 });
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      c.vfx.emit('stars', p.x + Math.cos(a) * 30, p.y - 20 + Math.sin(a) * 15, 1, { tint: 0xcff2ff, scale: 0.26, speed: [R * 90, R * 110], life: 520 });
    }
    for (const e of c.enemiesInCircle(p.gx, p.gy, R)) {
      const d = p.distanceTo(e);
      c.after((d / R) * 350, () => {
        if (e.dead) return;
        c.playerHit(e, pct, 'cold', { knockback: 0.6, from: p });
        e.slow(slow, dur);
        c.vfx.emit('stars', e.x, e.y - 40, 6, { tint: 0xcff2ff, scale: 0.18, speed: [30, 120], life: 600 });
      });
    }
    c.sfx('ice_shatter', { volume: 0.7 });
    x.lock(380 / x.d.castSpeed);
  },

  armadura_escarcha: (x) => {
    const { c, p } = x;
    c.armorBonus = x.v('armor') * (1 + GameState.profile.level * 0.04);
    c.armorUntil = c.now + x.v('dur') * 1000;
    c.frostArmor = true;
    c.sfx('ice_cast', {});
    const aura = c.vfx.aura(p, { element: 'ice', tex: 'star', height: 50, rate: 80, scale: 0.2 });
    const circle = c.vfx.groundCircle(p.x, p.y, { scale: 0.5, tint: 0x8fdcff, alpha: 0.7, spin: 5000 });
    const end = c.armorUntil;
    c.vfx.explosion(p.x, p.y - 40, { element: 'ice', radius: 60, power: 0.8, shake: false, decal: false });
    c.vfx.floatingText('Armadura de Escarcha', p.x, p.y - 130, { color: '#8fdcff', size: 18 });
    c.addUpdater(() => {
      circle?.setPosition(p.x, p.y);
      if (c.now > end || c.armorBonus <= 0 || p.dead) { aura.destroy(); circle?.destroy(); c.vfx.emit('stars', p.x, p.y - 40, 8, { tint: 0xcff2ff, scale: 0.16, speed: [40, 120] }); return false; }
      return true;
    });
    x.lock(350);
  },

  rayo_encadenado: (x) => {
    const { c, p } = x;
    const pct = x.v('dmg'), n = Math.floor(x.v('n'));
    let cur = x.target && !x.target.dead ? x.target : c.nearestHostile(x.gx, x.gy, 3.5);
    if (cur && p.distanceTo(cur) > x.def.range) cur = null;
    c.sfx('lightning', {});
    const hand = body(p);
    if (!cur) {
      const ex = p.gx + x.dx * 7, ey = p.gy + x.dy * 7;
      const w = gridToWorld(ex, ey);
      c.vfx.bolt(hand.x, hand.y, w.x, w.y - 40, { element: 'lightning', width: 4 });
      x.lock(300 / x.d.castSpeed);
      return;
    }
    const skip = new Set<string>();
    let prev = { x: hand.x, y: hand.y };
    for (let i = 0; i <= n && cur; i++) {
      const e: Enemy = cur;
      skip.add(e.id);
      const from = prev;
      const to = { x: e.center.x, y: e.center.y };
      c.after(i * 85, () => {
        c.vfx.bolt(from.x, from.y, to.x, to.y, { element: 'lightning', width: 4, ms: 240 });
        c.vfx.lightPulse(to.x, to.y, 160, 260, 0.9);
        if (!e.dead) c.playerHit(e, pct * Math.pow(0.92, i), 'lightning', { knockback: 0.2, silent: i > 0 });
        c.sfx('lightning', { volume: 0.5 });
      });
      prev = to;
      cur = c.nearestHostile(e.gx, e.gy, 5, skip);
    }
    x.lock(320 / x.d.castSpeed);
  },

  teletransporte: (x) => {
    const { c, p } = x;
    const end = c.clampWalkable(p.gx, p.gy, x.gx, x.gy, x.v('dist'));
    if (Math.hypot(end.fx - p.gx, end.fy - p.gy) < 1.2) return false;
    c.sfx('portal', { volume: 0.7 });
    c.vfx.explosion(p.x, p.y - 40, { element: 'arcane', radius: 70, power: 1, shake: false, decal: false });
    c.vfx.decal('magic_circle', p.x, p.y, { scale: 0.5, tint: 0xc060ff, duration: 700, blend: 'ADD', spin: 180 });
    p.warp(end.fx, end.fy);
    c.vfx.explosion(p.x, p.y - 40, { element: 'arcane', radius: 70, power: 1, shake: false, decal: false });
    c.vfx.decal('magic_circle', p.x, p.y, { scale: 0.5, tint: 0xc060ff, duration: 700, blend: 'ADD', spin: -180 });
    c.vfx.flash(p.x, p.y - 45, { element: 'arcane', size: 220, ms: 220 });
    p.sprite.setAlpha(0.2);
    p.scene.tweens.add({ targets: p.sprite, alpha: 1, duration: 260 });
    x.lock(120);
  },

  // ================================================================ Trovador Arquero
  flecha_multiple: (x) => {
    const { c, p } = x;
    const n = Math.floor(x.v('n')), pct = x.v('dmg');
    const spread = Math.min(0.9, 0.2 * (n - 1));
    c.sfx('arrow_shoot', {});
    for (let i = 0; i < n; i++) {
      const a = x.angle + (n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1));
      const r = rollPlayerDamage(x.d, pct);
      c.spawnProjectile({
        owner: 'player', gx: p.gx, gy: p.gy, dx: Math.cos(a), dy: Math.sin(a), speed: 19, range: x.def.range, radius: 0.35, element: 'physical', kind: 'arrow', height: 46,
        onHit: (pr, t) => {
          if (t && t !== 'player') { c.damageEnemy(t, { amount: r.amount, type: 'physical', crit: r.crit, from: p, knockback: 0.3, silent: true }); c.sfx('arrow_hit', { volume: 0.5 }); }
          else c.vfx.impact(pr.worldX, pr.worldY, 'physical', false);
        },
      });
    }
    x.lock(320 / x.d.attackSpeed);
  },

  lluvia_flechas: (x) => {
    const { c, p } = x;
    const pct = x.v('dmg'), dur = x.v('dur') * 1000;
    const end = c.clampWalkable(p.gx, p.gy, x.gx, x.gy, x.def.range);
    const R = 3.2;
    const w = gridToWorld(end.fx, end.fy);
    c.sfx('arrow_shoot', {});
    const tele = c.vfx.telegraphCircle(end.fx, end.fy, R, dur + 350, 0x9ad0ff);
    c.vfx.shockwave(w.x, w.y, { element: 'physical', radius: R * 90, duration: 500 });
    c.every(dur, 70, () => {
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * R;
      const tgx = end.fx + Math.cos(a) * rr, tgy = end.fy + Math.sin(a) * rr;
      const tw = gridToWorld(tgx, tgy);
      const img = p.scene.add.image(tw.x - 40, tw.y - 420, 'fx_arrow').setRotation(Math.atan2(420, 40)).setScale(1.1).setTint(0xe8d8b0).setDepth(VFX_DEPTH - 2);
      p.scene.tweens.add({
        targets: img, x: tw.x, y: tw.y, duration: 240, ease: 'Quad.easeIn',
        onComplete: () => {
          img.destroy();
          c.vfx.impact(tw.x, tw.y, 'physical', false);
          c.vfx.emit('smoke', tw.x, tw.y, 1, { tint: 0x6a5a48, scale: 0.12, scaleEnd: 0.3, alpha: 0.4, life: 400, speed: [0, 20] });
          for (const e of c.enemiesInCircle(tgx, tgy, 0.9)) c.playerHit(e, pct, 'physical', { knockback: 0.15, silent: true });
        },
      });
    }, () => tele.destroy());
    x.lock(420 / x.d.attackSpeed);
  },

  flecha_explosiva: (x) => {
    const { c, p } = x;
    const pct = x.v('dmg'), R = x.v('r');
    c.sfx('arrow_shoot', {});
    c.spawnProjectile({
      owner: 'player', gx: p.gx, gy: p.gy, dx: x.dx, dy: x.dy, speed: 17, range: x.def.range, radius: 0.4, element: 'fire', kind: 'arrow', size: 1.1, light: 140, height: 46,
      onHit: (pr) => {
        c.vfx.explosion(pr.worldX, pr.worldY + 30, { element: 'fire', radius: R * 45, power: 1.1 });
        c.sfx('fire_explosion', { volume: 0.8 });
        areaHit(x, pr.gx, pr.gy, R, pct, 'fire', { knockback: 0.7 });
      },
    });
    x.lock(340 / x.d.attackSpeed);
  },

  trampa_espinas: (x) => {
    const { c, p } = x;
    const end = c.clampWalkable(p.gx, p.gy, x.gx, x.gy, x.def.range);
    const w = gridToWorld(end.fx, end.fy);
    const list = TRAPS.get(c) ?? [];
    TRAPS.set(c, list);
    const pct = x.v('dmg'), root = x.v('root') * 1000;
    while (list.filter((t) => !t.dead).length >= 3) {
      const old = list.find((t) => !t.dead);
      if (old) { old.dead = true; old.fx.forEach((f) => f.destroy()); if (old.light) old.light.dead = true; }
    }
    const circle = c.vfx.groundCircle(w.x, w.y, { scale: 0.32, tint: 0x6cd05a, alpha: 0.85 });
    const thorn = p.scene.add.image(w.x, w.y - 6, 'vfx_star').setTint(0x9aff7a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.22, 0.14).setDepth(VFX_DEPTH - 5);
    const light = c.vfx.addLight(w.x, w.y, 90, 0.5);
    const trap = { gx: end.fx, gy: end.fy, armedAt: c.now + 500, until: c.now + 30000, fx: [circle, thorn].filter(Boolean) as Phaser.GameObjects.Image[], light, dead: false };
    list.push(trap);
    c.vfx.impact(w.x, w.y, 'nature', false);
    c.sfx('buff', { volume: 0.5 });
    c.addUpdater(() => {
      if (trap.dead) return false;
      thorn.setAlpha(c.now < trap.armedAt ? 0.4 : 0.7 + Math.sin(c.now / 200) * 0.2);
      if (c.now > trap.until) { trap.dead = true; trap.fx.forEach((f) => f.destroy()); if (trap.light) trap.light.dead = true; return false; }
      if (c.now < trap.armedAt) return true;
      if (!c.hostiles().some((e) => Math.hypot(e.gx - trap.gx, e.gy - trap.gy) < 1.0 + e.radius * 0.3)) return true;
      trap.dead = true; trap.fx.forEach((f) => f.destroy()); if (trap.light) trap.light.dead = true;
      c.vfx.explosion(w.x, w.y - 10, { element: 'nature', radius: 90, power: 1.2, shake: true, decal: false });
      c.vfx.emit('stars', w.x, w.y - 20, 14, { tint: 0x9aff7a, scale: 0.22, speed: [60, 260], life: 600 });
      c.vfx.emit('sparks', w.x, w.y - 30, 14, { tint: 0xd0ff90, scale: 0.18, speed: [100, 340], life: 600 });
      c.sfx('arrow_hit', { volume: 0.8 });
      for (const e of c.enemiesInCircle(trap.gx, trap.gy, 2.0)) { c.playerHit(e, pct, 'physical', { knockback: 0, color: '#9aff7a' }); e.root(root); }
      return false;
    });
    x.lock(320);
  },

  serenata_encantadora: (x) => {
    const { c, p } = x;
    const n = Math.floor(x.v('n')), dur = x.v('dur') * 1000;
    const near = c.hostiles().filter((e) => !e.def.charmImmune && !e.def.boss && p.distanceTo(e) <= x.def.range)
      .sort((a, b) => p.distanceTo(a) - p.distanceTo(b)).slice(0, n);
    c.sfx('heart_sparkle', { volume: 1 });
    for (let i = 0; i < 3; i++) c.after(i * 220, () => c.vfx.shockwave(p.x, p.y, { element: 'love', radius: x.def.range * 90, duration: 700 }));
    c.vfx.decal('magic_circle', p.x, p.y, { scale: 0.7, tint: 0xff6aae, duration: 1400, blend: 'ADD', spin: 90, alpha: 0.9 });
    c.vfx.hearts(p.x, p.y - 80, 8, 30);
    c.vfx.lightPulse(p.x, p.y - 40, 300, 800, 0.8);
    c.every(900, 140, (i) => c.vfx.emit('stars', p.x + Math.sin(i * 1.7) * 40, p.y - 90 - i * 6, 1, { tint: 0xff9ac8, scale: 0.22, speed: [20, 60], life: 800 }));
    if (!near.length) { c.vfx.floatingText('Nadie a quien enamorar...', p.x, p.y - 130, { size: 16, color: '#ff9ac8' }); }
    for (const e of near) c.after(300, () => e.charm(dur));
    x.lock(500 / x.d.castSpeed);
  },

  paso_ligero: (x) => {
    const { c, p } = x;
    const dist = x.v('dist');
    const end = c.clampWalkable(p.gx, p.gy, p.gx + x.dx * dist, p.gy + x.dy * dist, dist);
    if (Math.hypot(end.fx - p.gx, end.fy - p.gy) < 0.8) return false;
    c.sfx('buff', { volume: 0.6 });
    c.sfx('sword_swing_2', { volume: 0.5 });
    c.invulnerable = true;
    c.hastePlayer(1 + x.v('haste') / 100, 3000);
    let k = 0;
    c.vfx.emit('smoke', p.x, p.y - 10, 5, { tint: 0xd8c8b0, scale: 0.3, scaleEnd: 0.7, alpha: 0.5, life: 500 });
    p.dashTo(end.fx, end.fy, 220, () => { c.invulnerable = false; c.vfx.emit('smoke', p.x, p.y - 10, 4, { tint: 0xd8c8b0, scale: 0.3, scaleEnd: 0.7, alpha: 0.5, life: 500 }); },
      () => { if (k++ % 2 === 0) afterimage(x, 0xff9ac8); c.vfx.trail(p.x, p.y - 40, 'love', 0.8); });
    x.lock(230);
  },
};

void CLASSES; void PALETTE; void ({} as Element);