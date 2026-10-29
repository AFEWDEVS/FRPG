import Phaser from 'phaser';
import { gridToWorld } from '../iso/iso';
import type { Darkness, DynamicLight } from '../world/Darkness';
import { CombatFx } from './CombatFx';

export interface BurstOptions {
  count?: number;
  tint?: number | number[];
  scale?: { start: number; end: number };
  speed?: { min: number; max: number };
  lifespan?: number;
  gravityY?: number;
  alpha?: { start: number; end: number };
  angle?: { min: number; max: number };
  blend?: 'ADD' | 'NORMAL';
  depth?: number;
}

export interface FloatingTextOptions {
  color?: string;
  size?: number;
  duration?: number;
  rise?: number;
}

export type Element = 'fire' | 'ice' | 'lightning' | 'arcane' | 'holy' | 'nature' | 'love' | 'physical' | 'shadow';

/** core = bright center, mid = body color, dark = smoke / decal. */
export const PALETTE: Record<Element, { core: number; mid: number; dark: number }> = {
  fire: { core: 0xfff0b0, mid: 0xff7a1e, dark: 0x2a1410 },
  ice: { core: 0xf0ffff, mid: 0x5cc8ff, dark: 0x1c3550 },
  lightning: { core: 0xffffff, mid: 0xa8c4ff, dark: 0x303a70 },
  arcane: { core: 0xffe6ff, mid: 0xc060ff, dark: 0x2a1040 },
  holy: { core: 0xffffe8, mid: 0xffd45a, dark: 0x4a3c18 },
  nature: { core: 0xeaffc0, mid: 0x6cd05a, dark: 0x1c3416 },
  love: { core: 0xfff0f8, mid: 0xff6aae, dark: 0x4a1030 },
  physical: { core: 0xffffff, mid: 0xe0d0b0, dark: 0x3a3028 },
  shadow: { core: 0xd0b0ff, mid: 0x6a40a0, dark: 0x100818 },
};

export const VFX_DEPTH = 900_000;
const GROUND_FX_DEPTH = 0.5;
const MAX_TEXTS = 60;

interface LayerSpec {
  tex: string; blend: 'ADD' | 'NORMAL'; life: number; speed: [number, number];
  gravity?: number; angleMin?: number; angleMax?: number; maxAlive: number; rotate?: boolean;
}
interface LayerEmit {
  tint?: number; scale?: number; scaleEnd?: number; life?: number; speed?: [number, number]; alpha?: number; alphaEnd?: number; angle?: [number, number];
}

interface LayerState { speed: [number, number]; life: number; tint: number; s0: number; s1: number; a0: number; a1: number; g0: number; g1: number }

/** Specs for the pooled additive layers (one emitter each, reused forever). */
const LAYERS: Record<string, LayerSpec> = {
  core: { tex: 'flare', blend: 'ADD', life: 260, speed: [0, 0], maxAlive: 60 },
  glow: { tex: 'light', blend: 'ADD', life: 520, speed: [0, 20], maxAlive: 80 },
  sparks: { tex: 'spark', blend: 'ADD', life: 600, speed: [120, 420], gravity: 260, maxAlive: 260, rotate: true },
  stars: { tex: 'star', blend: 'ADD', life: 700, speed: [60, 260], maxAlive: 120, rotate: true },
  smoke: { tex: 'smoke', blend: 'NORMAL', life: 1100, speed: [10, 70], gravity: -30, maxAlive: 140, rotate: true },
  fire: { tex: 'fire', blend: 'ADD', life: 650, speed: [20, 140], gravity: -80, maxAlive: 200 },
  hearts: { tex: 'heart', blend: 'ADD', life: 1300, speed: [10, 60], gravity: -50, maxAlive: 80 },
  swirl: { tex: 'twirl', blend: 'ADD', life: 600, speed: [0, 30], maxAlive: 50, rotate: true },
  dirt: { tex: 'smoke', blend: 'NORMAL', life: 800, speed: [80, 260], gravity: 500, maxAlive: 100 },
};

/**
 * Per-GameScene effects API. Texture keys are the short vfx names ('spark', 'heart', ...).
 * Heavy effects (explosion, shockwave, trail...) reuse pooled emitters; callers never create/destroy emitters per hit.
 */
export class VfxManager {
  private hitStopUntil = 0;
  private layers = new Map<string, { em: Phaser.GameObjects.Particles.ParticleEmitter; spec: LayerSpec; st: LayerState }>();
  private texts: Phaser.GameObjects.Text[] = [];
  private activeTexts = 0;
  private darkness?: Darkness;

  readonly fx: CombatFx;

  constructor(readonly scene: Phaser.Scene) { this.ensureTextures(); this.fx = new CombatFx(this); }

  /** GameScene wires this once the darkness overlay exists, so effects can punch light through it. */
  setDarkness(d: Darkness): void { this.darkness = d; }

  private ensureTextures(): void {
    const tx = this.scene.textures;
    if (!tx.exists('fx_ring')) {
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      for (let i = 0; i < 10; i++) { g.lineStyle(3, 0xffffff, 0.12 + i * 0.09); g.strokeCircle(128, 128, 118 - i * 1.4); }
      g.generateTexture('fx_ring', 256, 256);
      g.destroy();
    }
    if (!tx.exists('fx_arc')) {
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      for (let i = 0; i < 8; i++) { g.lineStyle(26 - i * 3, 0xffffff, 0.12 + i * 0.12); g.beginPath(); g.arc(128, 160, 110 - i * 2, Phaser.Math.DegToRad(-130), Phaser.Math.DegToRad(-50)); g.strokePath(); }
      g.generateTexture('fx_arc', 256, 256);
      g.clear();
      g.fillStyle(0xffffff, 1); g.fillRect(2, 6, 46, 4); g.fillTriangle(46, 1, 62, 8, 46, 15);
      g.fillStyle(0xffffff, 0.6); g.fillTriangle(0, 2, 10, 8, 0, 14);
      g.generateTexture('fx_arrow', 64, 16);
      g.clear();
      g.fillStyle(0xffffff, 1); g.fillEllipse(16, 8, 28, 12);
      g.generateTexture('fx_petal', 32, 16);
      g.clear();
      g.fillStyle(0x8a7a6a, 1); g.fillCircle(24, 24, 20); g.fillStyle(0x5a4a3c, 1); g.fillCircle(30, 28, 10); g.fillStyle(0xb0a090, 1); g.fillCircle(16, 16, 7);
      g.generateTexture('fx_rock', 48, 48);
      g.destroy();
    }
    if (!tx.exists('fx_disc')) {
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      for (let i = 0; i < 14; i++) { g.fillStyle(0xffffff, 0.07); g.fillCircle(128, 128, 120 - i * 3); }
      g.generateTexture('fx_disc', 256, 256);
      g.destroy();
    }
  }

  private has(key: string): boolean { return this.scene.textures.exists(key); }

  /** One-shot particle explosion at world (x, y). Kept for compatibility; prefer `explosion` / `emit`. */
  burst(key: string, x: number, y: number, o: BurstOptions = {}): void {
    const tex = `vfx_${key}`;
    if (!this.has(tex)) return;
    const em = this.scene.add.particles(x, y, tex, {
      emitting: false,
      lifespan: o.lifespan ?? 500,
      speed: o.speed ?? { min: 40, max: 160 },
      scale: o.scale ?? { start: 0.6, end: 0 },
      alpha: o.alpha ?? { start: 1, end: 0 },
      angle: o.angle ?? { min: 0, max: 360 },
      gravityY: o.gravityY ?? 0,
      tint: o.tint ?? 0xffffff,
      blendMode: o.blend === 'NORMAL' ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD,
    });
    em.setDepth(o.depth ?? VFX_DEPTH);
    em.explode(o.count ?? 12);
    this.scene.time.delayedCall((o.lifespan ?? 500) + 100, () => em.destroy());
  }

  // ------------------------------------------------------------ pooled layers

  private layer(name: string) {
    let l = this.layers.get(name);
    if (l) return l;
    const spec = LAYERS[name];
    const tex = `vfx_${spec.tex}`;
    const st: LayerState = { speed: spec.speed, life: spec.life, tint: 0xffffff, s0: 0.4, s1: 0, a0: 1, a1: 0, g0: spec.angleMin ?? 0, g1: spec.angleMax ?? 360 };
    const sMap = new WeakMap<object, [number, number]>(), aMap = new WeakMap<object, [number, number]>();
    const em = this.scene.add.particles(0, 0, this.has(tex) ? tex : '__WHITE', {
      emitting: false,
      lifespan: { onEmit: () => st.life * (0.75 + Math.random() * 0.5) },
      speed: { onEmit: () => st.speed[0] + Math.random() * (st.speed[1] - st.speed[0]) },
      angle: { onEmit: () => st.g0 + Math.random() * (st.g1 - st.g0) },
      gravityY: spec.gravity ?? 0,
      rotate: spec.rotate ? { min: 0, max: 360 } : 0,
      scale: { onEmit: (p?: object) => { if (p) sMap.set(p, [st.s0, st.s1]); return st.s0; }, onUpdate: (p: object, _k: string, t: number) => { const o = sMap.get(p); return o ? o[0] + (o[1] - o[0]) * t : 0; } },
      alpha: { onEmit: (p?: object) => { if (p) aMap.set(p, [st.a0, st.a1]); return st.a0; }, onUpdate: (p: object, _k: string, t: number) => { const o = aMap.get(p); return o ? o[0] + (o[1] - o[0]) * t : 0; } },
      tint: { onEmit: () => st.tint },
      blendMode: spec.blend === 'ADD' ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL,
      maxAliveParticles: spec.maxAlive,
    });
    em.setDepth(VFX_DEPTH);
    l = { em, spec, st };
    this.layers.set(name, l);
    return l;
  }

  /** Emit `count` particles of a pooled layer at world (x, y). `scale` is in texture-fractions (1 = 256px). */
  emit(name: string, x: number, y: number, count: number, o: LayerEmit = {}): void {
    const l = this.layer(name);
    const em = l.em;
    l.st.speed = o.speed ?? l.spec.speed;
    l.st.life = o.life ?? l.spec.life;
    l.st.tint = o.tint ?? 0xffffff; l.st.s0 = o.scale ?? 0.4; l.st.s1 = o.scaleEnd ?? 0; l.st.a0 = o.alpha ?? 1; l.st.a1 = o.alphaEnd ?? 0;
    l.st.g0 = o.angle?.[0] ?? l.spec.angleMin ?? 0; l.st.g1 = o.angle?.[1] ?? l.spec.angleMax ?? 360;
    em.emitParticleAt(x, y, count);
  }

  // ------------------------------------------------------------ composite effects

  /** Layered explosion: flash core + glow + sparks + smoke/embers + ground decal + shockwave + light. `radius` in world px. */
  explosion(x: number, y: number, o: { element?: Element; radius?: number; power?: number; shake?: boolean; decal?: boolean } = {}): void {
    const el = o.element ?? 'fire';
    const p = PALETTE[el];
    const r = o.radius ?? 90;
    const pow = o.power ?? 1;
    const k = r / 100;
    this.emit('core', x, y, 2, { tint: p.core, scale: 1.1 * k * pow, scaleEnd: 0.2, life: 240, alpha: 1 });
    this.emit('glow', x, y, 3, { tint: p.mid, scale: 2.2 * k * pow, scaleEnd: 0.6, life: 520, alpha: 0.8 });
    this.emit('sparks', x, y, Math.round(18 * pow), { tint: p.core, scale: 0.22, speed: [100 * k, 380 * k] });
    this.emit('sparks', x, y, Math.round(10 * pow), { tint: p.mid, scale: 0.3, speed: [60 * k, 260 * k], life: 750 });
    if (el === 'fire') this.emit('fire', x, y, Math.round(16 * pow), { tint: p.mid, scale: 0.7 * k, scaleEnd: 0.1, speed: [30 * k, 200 * k], alpha: 0.9 });
    this.emit('smoke', x, y, Math.round(7 * pow), { tint: el === 'fire' || el === 'physical' ? 0x3a3430 : p.dark, scale: 0.9 * k, scaleEnd: 1.5 * k, alpha: 0.55, life: 1200 });
    if (el === 'holy' || el === 'ice' || el === 'arcane' || el === 'love') this.emit('stars', x, y, Math.round(10 * pow), { tint: p.core, scale: 0.35, speed: [60 * k, 260 * k] });
    this.shockwave(x, y, { element: el, radius: r * 1.5, duration: 420 });
    if (o.decal !== false && (el === 'fire' || el === 'physical' || el === 'arcane')) this.decal('scorch', x, y + 4, { scale: (r / 100) * 0.9 * pow, tint: 0x201410, duration: 4000, alpha: 0.7, blend: 'NORMAL' });
    this.lightPulse(x, y - 10, r * 3.2, 480, 1);
    if (o.shake !== false) this.screenShake(Math.min(0.012, 0.003 * k * pow), 140);
  }

  /** Expanding iso-projected ring on the ground. `radius` = final horizontal radius in px. */
  shockwave(x: number, y: number, o: { element?: Element; color?: number; radius?: number; duration?: number; thick?: boolean } = {}): void {
    if (!this.has('fx_ring')) return;
    const color = o.color ?? PALETTE[o.element ?? 'physical'].mid;
    const R = o.radius ?? 160;
    const img = this.scene.add.image(x, y, 'fx_ring').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(GROUND_FX_DEPTH + 0.1);
    const s0 = 0.08, s1 = R / 118;
    img.setScale(s0, s0 * 0.5).setAlpha(o.thick ? 1 : 0.9);
    this.scene.tweens.add({
      targets: img, scaleX: s1, scaleY: s1 * 0.5, alpha: 0, duration: o.duration ?? 450, ease: 'Cubic.easeOut',
      onComplete: () => img.destroy(),
    });
  }

  /** Flat image on the ground (scorch marks, magic circles). Auto-fades. */
  decal(key: string, x: number, y: number, o: { scale?: number; tint?: number; duration?: number; alpha?: number; blend?: 'ADD' | 'NORMAL'; spin?: number; grow?: number } = {}): Phaser.GameObjects.Image | null {
    const tex = `vfx_${key}`;
    if (!this.has(tex)) return null;
    const sc = o.scale ?? 0.6;
    const img = this.scene.add.image(x, y, tex).setScale(sc, sc * 0.5).setTint(o.tint ?? 0xffffff)
      .setAlpha(o.alpha ?? 0.8).setDepth(GROUND_FX_DEPTH)
      .setBlendMode(o.blend === 'ADD' ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    const dur = o.duration ?? 1500;
    this.scene.tweens.add({
      targets: img, alpha: 0, scaleX: sc * (o.grow ?? 1), scaleY: sc * 0.5 * (o.grow ?? 1), angle: (o.spin ?? 0), duration: dur, ease: 'Quad.easeIn',
      delay: Math.min(500, dur * 0.3), onComplete: () => img.destroy(),
    });
    return img;
  }

  /** Persistent ground circle (magic circle under buffs / meteor target). Caller must destroy. */
  groundCircle(x: number, y: number, o: { scale?: number; tint?: number; alpha?: number; spin?: number } = {}): Phaser.GameObjects.Image | null {
    if (!this.has('vfx_magic_circle')) return null;
    const sc = o.scale ?? 0.8;
    const img = this.scene.add.image(x, y, 'vfx_magic_circle').setScale(sc, sc * 0.5).setTint(o.tint ?? 0xffffff)
      .setAlpha(o.alpha ?? 0.8).setDepth(GROUND_FX_DEPTH + 0.2).setBlendMode(Phaser.BlendModes.ADD);
    if (o.spin) this.scene.tweens.add({ targets: img, angle: 360, duration: o.spin, repeat: -1 });
    return img;
  }

  /** Brief bright flash sprite. */
  flash(x: number, y: number, o: { element?: Element; color?: number; size?: number; ms?: number } = {}): void {
    const color = o.color ?? PALETTE[o.element ?? 'physical'].core;
    const img = this.scene.add.image(x, y, 'vfx_flare').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(VFX_DEPTH + 1);
    const s = (o.size ?? 120) / 256;
    img.setScale(s * 0.4).setAlpha(1);
    this.scene.tweens.add({ targets: img, scale: s, alpha: 0, duration: o.ms ?? 160, ease: 'Quad.easeOut', onComplete: () => img.destroy() });
  }

  /** Light that punches through the darkness overlay and fades out. */
  lightPulse(x: number, y: number, radius: number, ms = 400, strength = 1): DynamicLight | null {
    if (!this.darkness) return null;
    const l: DynamicLight = { x, y, radius, strength };
    this.darkness.addLight(l);
    this.scene.tweens.add({ targets: l, strength: 0, duration: ms, ease: 'Quad.easeIn', onComplete: () => { l.dead = true; } });
    return l;
  }

  /** Persistent light (projectiles, braziers). Caller updates x/y and sets `dead` when finished. */
  addLight(x: number, y: number, radius: number, strength = 1): DynamicLight | null {
    if (!this.darkness) return null;
    return this.darkness.addLight({ x, y, radius, strength });
  }

  /** Glowing trail puff for projectiles. Call every frame or two. */
  trail(x: number, y: number, element: Element, size = 1): void {
    const p = PALETTE[element];
    this.emit('glow', x, y, 1, { tint: p.mid, scale: 0.55 * size, scaleEnd: 0.1, life: 320, alpha: 0.7 });
    this.emit('sparks', x, y, 1, { tint: p.core, scale: 0.12 * size, speed: [10, 50], life: 380 });
    if (element === 'fire') this.emit('fire', x, y, 1, { tint: p.mid, scale: 0.3 * size, scaleEnd: 0.05, life: 400, speed: [5, 30], alpha: 0.8 });
    else if (element === 'shadow' || element === 'physical') this.emit('smoke', x, y, 1, { tint: p.dark, scale: 0.2 * size, scaleEnd: 0.5 * size, alpha: 0.3, life: 500, speed: [0, 12] });
  }

  /** Small impact at a hit point. */
  impact(x: number, y: number, element: Element = 'physical', big = false): void {
    const p = PALETTE[element];
    this.emit('core', x, y, 1, { tint: p.core, scale: big ? 0.7 : 0.4, scaleEnd: 0.1, life: 150 });
    this.emit('sparks', x, y, big ? 14 : 7, { tint: p.core, scale: 0.18, speed: [90, big ? 340 : 240] });
    if (big) this.emit('glow', x, y, 1, { tint: p.mid, scale: 1.4, scaleEnd: 0.4, life: 360, alpha: 0.8 });
  }

  /** Hearts rising from a point. */
  hearts(x: number, y: number, n = 4, spread = 24): void {
    for (let i = 0; i < n; i++) {
      this.emit('hearts', x + (Math.random() - 0.5) * spread * 2, y - Math.random() * 16, 1, { tint: Math.random() < 0.5 ? 0xff6aae : 0xff9ac8, scale: 0.1 + Math.random() * 0.06, scaleEnd: 0.05, life: 1200, alpha: 0.95 });
    }
  }

  /** Slash arc sprite (melee swings): two layered arcs that sweep through the swing. `angle` = screen-space radians. */
  slashArc(x: number, y: number, angle: number, o: { element?: Element; size?: number; ms?: number } = {}): void {
    if (!this.has('fx_arc')) return;
    const p = PALETTE[o.element ?? 'physical'];
    const size = o.size ?? 160, s = size / 256, ms = o.ms ?? 220, base = angle + Math.PI / 2;
    const a = this.scene.add.image(x, y, 'fx_arc').setTint(p.mid).setBlendMode(Phaser.BlendModes.ADD).setDepth(VFX_DEPTH).setScale(s * 0.7).setAlpha(0.9).setRotation(base - 0.75);
    const b = this.scene.add.image(x, y, 'fx_arc').setTint(p.core).setBlendMode(Phaser.BlendModes.ADD).setDepth(VFX_DEPTH + 1).setScale(s * 0.6).setAlpha(1).setRotation(base - 0.75);
    this.scene.tweens.add({ targets: a, rotation: base + 0.75, scale: s * 1.1, alpha: 0, duration: ms, ease: 'Cubic.easeOut', onComplete: () => a.destroy() });
    this.scene.tweens.add({ targets: b, rotation: base + 0.75, scale: s * 0.95, alpha: 0, duration: ms * 0.8, ease: 'Cubic.easeOut', onComplete: () => b.destroy() });
    const tx = x + Math.cos(angle) * size * 0.42, ty = y + Math.sin(angle) * size * 0.3, deg = (angle * 180) / Math.PI;
    this.emit('sparks', tx, ty, 4, { tint: p.core, scale: 0.12, speed: [120, 300], angle: [deg - 50, deg + 50], life: 350 });
  }

  /** Jagged lightning between two world points: branching, 3-frame flicker, glow. */
  bolt(x1: number, y1: number, x2: number, y2: number, o: { element?: Element; width?: number; ms?: number; jag?: number } = {}): void {
    const p = PALETTE[o.element ?? 'lightning'];
    const g = this.scene.add.graphics().setDepth(VFX_DEPTH + 2).setBlendMode(Phaser.BlendModes.ADD);
    const w = o.width ?? 4, jag = o.jag ?? 18;
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len, nx = -uy, ny = ux;
    type Pt = { x: number; y: number };
    const gen = () => {
      const n = Math.max(4, Math.round(len / 22));
      const main: Pt[] = [{ x: x1, y: y1 }];
      for (let i = 1; i < n; i++) {
        const t = i / n, off = (Math.random() - 0.5) * 2 * jag * Math.min(1, Math.sin(t * Math.PI) * 1.6);
        main.push({ x: x1 + ux * len * t + nx * off, y: y1 + uy * len * t + ny * off });
      }
      main.push({ x: x2, y: y2 });
      const branches: Pt[][] = [];
      for (let i = 2; i < main.length - 2; i++) {
        if (Math.random() > 0.3) continue;
        const dir = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.7);
        const ca = Math.cos(dir), sa = Math.sin(dir);
        const bx = ux * ca - uy * sa, by = ux * sa + uy * ca;
        const br: Pt[] = [main[i]];
        const segs = 2 + ((Math.random() * 3) | 0);
        for (let k = 1; k <= segs; k++) br.push({ x: main[i].x + bx * 22 * k + (Math.random() - 0.5) * 10, y: main[i].y + by * 22 * k + (Math.random() - 0.5) * 10 });
        branches.push(br);
      }
      return { main, branches };
    };
    const stroke = (pts: Pt[], wm: number, a: number) => {
      const passes: [number, number, number][] = [[w * 3.5 * wm, p.mid, 0.22 * a], [w * 1.8 * wm, p.mid, 0.6 * a], [w * 0.8 * wm, p.core, a]];
      for (const [lw, col, al] of passes) {
        g.lineStyle(lw, col, al); g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
        g.strokePath();
      }
    };
    const draw = () => { const b = gen(); g.clear(); stroke(b.main, 1, 1); for (const br of b.branches) stroke(br, 0.55, 0.85); };
    draw();
    this.emit('core', x2, y2, 1, { tint: p.core, scale: 0.7, scaleEnd: 0.1, life: 200 });
    this.emit('glow', x2, y2, 1, { tint: p.mid, scale: 1.1, scaleEnd: 0.3, life: 300, alpha: 0.7 });
    this.emit('sparks', x2, y2, 6, { tint: p.core, scale: 0.14, speed: [60, 240], life: 350 });
    const fr = 45;
    this.scene.time.addEvent({ delay: fr, repeat: 1, callback: () => { if (g.active) draw(); } });
    this.scene.tweens.add({ targets: g, alpha: 0, delay: fr * 3, duration: o.ms ?? 160, onComplete: () => g.destroy() });
  }

  /** Persistent aura around an entity (champions, buffs). Returns a handle with destroy(). */
  aura(target: Phaser.GameObjects.Container, o: { element?: Element; height?: number; rate?: number; scale?: number; tex?: 'fire' | 'light' | 'star' | 'smoke' | 'heart' } = {}): { destroy: () => void } {
    const p = PALETTE[o.element ?? 'ice'];
    const tex = `vfx_${o.tex ?? 'light'}`;
    if (!this.has(tex)) return { destroy: () => undefined };
    const em = this.scene.add.particles(0, 0, tex, {
      follow: target, followOffset: { x: 0, y: -(o.height ?? 40) },
      frequency: o.rate ?? 110, lifespan: 800,
      speedY: { min: -40, max: -15 }, speedX: { min: -12, max: 12 },
      scale: { start: (o.scale ?? 0.28), end: 0 }, alpha: { start: 0.7, end: 0 },
      tint: [p.mid, p.core], blendMode: Phaser.BlendModes.ADD,
      emitZone: { type: 'random', source: new Phaser.Geom.Ellipse(0, 0, 70, 90) } as Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig,
      maxAliveParticles: 14,
    });
    em.setDepth(VFX_DEPTH - 1);
    return { destroy: () => em.destroy() };
  }

  /** PostFX glow (WebGL). Safe no-op when unsupported. */
  glow(obj: Phaser.GameObjects.GameObject, color: number, strength = 4): void {
    try {
      (obj as unknown as { postFX?: { addGlow: (c: number, o: number, i: number, k: boolean, q: number, d: number) => unknown } }).postFX?.addGlow(color, strength, 0, false, 0.12, 8);
    } catch { /* renderer without FX */ }
  }

  // ------------------------------------------------------------ telegraphs

  /** Ground warning shape filling in from the center. `pts` are grid offsets from (gx, gy). Returns a handle. */
  telegraphShape(gx: number, gy: number, pts: { gx: number; gy: number }[], ms: number, color = 0xff3a2a): { destroy: () => void } {
    const c = gridToWorld(gx, gy);
    const wp = pts.map((p) => gridToWorld(p.gx, p.gy));
    const outline = this.scene.add.graphics({ x: c.x, y: c.y }).setDepth(GROUND_FX_DEPTH + 0.3);
    outline.fillStyle(color, 0.16); outline.lineStyle(2, color, 0.85);
    outline.beginPath(); outline.moveTo(wp[0].x, wp[0].y); for (const q of wp) outline.lineTo(q.x, q.y); outline.closePath(); outline.fillPath(); outline.strokePath();
    const fill = this.scene.add.graphics({ x: c.x, y: c.y }).setDepth(GROUND_FX_DEPTH + 0.4).setBlendMode(Phaser.BlendModes.ADD);
    fill.fillStyle(color, 0.35);
    fill.beginPath(); fill.moveTo(wp[0].x, wp[0].y); for (const q of wp) fill.lineTo(q.x, q.y); fill.closePath(); fill.fillPath();
    fill.setScale(0.02);
    const tw = this.scene.tweens.add({ targets: fill, scaleX: 1, scaleY: 1, duration: ms, ease: 'Quad.easeIn' });
    let dead = false;
    const destroy = () => {
      if (dead) return; dead = true; tw.stop();
      this.scene.tweens.add({ targets: [outline, fill], alpha: 0, duration: 120, onComplete: () => { outline.destroy(); fill.destroy(); } });
    };
    this.scene.time.delayedCall(ms, destroy);
    return { destroy };
  }

  telegraphCircle(gx: number, gy: number, r: number, ms: number, color = 0xff3a2a): { destroy: () => void } {
    const pts: { gx: number; gy: number }[] = [];
    for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; pts.push({ gx: Math.cos(a) * r, gy: Math.sin(a) * r }); }
    return this.telegraphShape(gx, gy, pts, ms, color);
  }

  /** Cone from (gx,gy) pointing along grid angle `ang` (radians in grid space). */
  telegraphCone(gx: number, gy: number, ang: number, range: number, half: number, ms: number, color = 0xff3a2a): { destroy: () => void } {
    const pts: { gx: number; gy: number }[] = [{ gx: 0, gy: 0 }];
    for (let i = 0; i <= 12; i++) { const a = ang - half + (2 * half * i) / 12; pts.push({ gx: Math.cos(a) * range, gy: Math.sin(a) * range }); }
    return this.telegraphShape(gx, gy, pts, ms, color);
  }

  telegraphLine(gx: number, gy: number, ang: number, len: number, width: number, ms: number, color = 0xff3a2a): { destroy: () => void } {
    const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy * width / 2, ny = ux * width / 2;
    return this.telegraphShape(gx, gy, [{ gx: nx, gy: ny }, { gx: nx + ux * len, gy: ny + uy * len }, { gx: -nx + ux * len, gy: -ny + uy * len }, { gx: -nx, gy: -ny }], ms, color);
  }

  // ------------------------------------------------------------ camera / time

  screenShake(intensity = 0.006, ms = 120): void {
    this.scene.cameras.main.shake(ms, intensity);
  }

  /** Briefly freeze gameplay for impact. GameScene skips entity ticks while `frozen`. */
  hitStop(ms = 60): void { this.hitStopUntil = Math.max(this.hitStopUntil, performance.now() + ms); }
  get frozen(): boolean { return performance.now() < this.hitStopUntil; }

  /** Zoom in then back out (boss intros, big impacts). */
  zoomPunch(zoom = 1.12, inMs = 350, holdMs = 500, outMs = 500): void {
    const cam = this.scene.cameras.main;
    this.scene.tweens.add({
      targets: cam, zoom, duration: inMs, ease: 'Cubic.easeOut',
      onComplete: () => this.scene.tweens.add({ targets: cam, zoom: 1, duration: outMs, delay: holdMs, ease: 'Cubic.easeInOut' }),
    });
  }

  screenFlash(color = 0xffffff, ms = 180, alpha = 0.5): void {
    const cam = this.scene.cameras.main;
    cam.flash(ms, (color >> 16) & 255, (color >> 8) & 255, color & 255, false);
    void alpha;
  }

  // ------------------------------------------------------------ text

  floatingText(text: string, x: number, y: number, o: FloatingTextOptions = {}): void {
    const t = this.scene.add.text(x, y, text, {
      fontFamily: 'Georgia, serif', fontSize: `${o.size ?? 20}px`, color: o.color ?? '#ffffff',
      stroke: '#000000', strokeThickness: 4, align: 'center', wordWrap: { width: 340 },
    }).setOrigin(0.5, 1).setDepth(VFX_DEPTH + 10);
    this.scene.tweens.add({
      targets: t, y: y - (o.rise ?? 50), alpha: { from: 1, to: 0 }, duration: o.duration ?? 1100, ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  /** Pooled RO-style floating number (see CombatFx.number). */
  damageNumber(text: string, x: number, y: number, o: { color?: string; crit?: boolean; small?: boolean; kind?: 'dmg' | 'crit' | 'player' | 'miss' | 'heal' | 'dot' } = {}): void {
    this.fx.number(text, x, y, o);
  }
}