import Phaser from 'phaser';
import type { FxKind } from '../data/areas';

type R = [number, number];
interface Emitter {
  tex: string; n: number; size: R; tint: number[]; add?: boolean; alpha: number;
  vx: R; vy: R; life: R; wobble?: number; spin?: number; pulse?: boolean; squash?: number;
}
interface P { img: Phaser.GameObjects.Image; e: Emitter; x: number; y: number; vx: number; vy: number; age: number; life: number; ph: number; sz: number; }

const E: Record<FxKind, Emitter[]> = {
  town: [
    { tex: 'vfx_heart', n: 22, size: [10, 16], tint: [0xffb7d5, 0xffffff, 0xffd9e8, 0xffe08a], alpha: 0.9, vx: [-34, -8], vy: [16, 36], life: [6000, 10000], wobble: 22, spin: 2.2 },
    { tex: 'vfx_star', n: 12, size: [6, 10], tint: [0xff8ad0, 0x8ad0ff, 0xffe66a, 0xa0ff9a], alpha: 0.85, vx: [-30, -6], vy: [14, 30], life: [6000, 10000], wobble: 18, spin: 3 },
    { tex: 'vfx_flare', n: 14, size: [8, 14], tint: [0xfff0b0], add: true, alpha: 0.5, vx: [-6, 6], vy: [-8, 2], life: [5000, 9000], wobble: 10, pulse: true },
  ],
  forest: [
    { tex: 'vfx_spark', n: 18, size: [10, 16], tint: [0x7cc84a, 0xa8d85a, 0xe0c050, 0xd08a3a], alpha: 0.9, vx: [-30, -8], vy: [14, 34], life: [6000, 10000], wobble: 26, spin: 2.6, squash: 0.55 },
    { tex: 'vfx_flare', n: 14, size: [14, 22], tint: [0xd8ff6a, 0xb8ff8a], add: true, alpha: 0.9, vx: [-12, 12], vy: [-10, 10], life: [5000, 9000], wobble: 30, pulse: true },
    { tex: 'vfx_flare', n: 20, size: [6, 10], tint: [0xfff3b0], add: true, alpha: 0.55, vx: [10, 22], vy: [-4, 4], life: [6000, 10000], wobble: 8 },
  ],
  ember: [
    { tex: 'vfx_flare', n: 32, size: [8, 14], tint: [0xff7a1c, 0xffa030, 0xff5a10], add: true, alpha: 0.9, vx: [8, 28], vy: [-90, -30], life: [2000, 4000], wobble: 14 },
    { tex: 'vfx_smoke', n: 14, size: [10, 18], tint: [0x4a423c, 0x36302c], alpha: 0.4, vx: [14, 30], vy: [8, 20], life: [5000, 9000], wobble: 12 },
    { tex: 'vfx_smoke', n: 5, size: [140, 220], tint: [0xff9040], add: true, alpha: 0.06, vx: [-4, 4], vy: [-12, -4], life: [4000, 7000], wobble: 20 },
  ],
  cave: [
    { tex: 'vfx_flare', n: 24, size: [5, 9], tint: [0xbfd0ff, 0xe0e8ff], add: true, alpha: 0.5, vx: [-5, 5], vy: [-5, -1], life: [6000, 10000], wobble: 8, pulse: true },
    { tex: 'vfx_spark', n: 3, size: [5, 7], tint: [0x9fd8ff], alpha: 0.8, vx: [0, 0], vy: [260, 340], life: [500, 900], squash: 2.2 },
  ],
  tower: [
    { tex: 'vfx_flare', n: 22, size: [5, 9], tint: [0xc9a0ff, 0xe8d0ff], add: true, alpha: 0.55, vx: [-5, 5], vy: [-6, -1], life: [6000, 10000], wobble: 8, pulse: true },
    { tex: 'vfx_flare', n: 8, size: [30, 50], tint: [0x9a50ff], add: true, alpha: 0.18, vx: [-6, 6], vy: [-20, -8], life: [4000, 7000], wobble: 14 },
  ],
};

export interface FireSpot { x: number; y: number; key: string; }
const FLAME_H: Record<string, number> = { torch: 72, brazier: 58, campfire: 26 };
const D = 800000;

/** Pooled, view-culled ambient life: weather-ish particles, flame particles + glows for fire props, drifting cloud shadows. */
export class Ambient {
  private ps: P[] = [];
  private flames: { img: Phaser.GameObjects.Image; x: number; y: number; vy: number; age: number; life: number; sz: number; ph: number; on: boolean }[] = [];
  private fires: { spot: FireSpot; glow: Phaser.GameObjects.Image; acc: number }[] = [];
  private clouds: { img: Phaser.GameObjects.Image; x: number; y: number; w: number }[] = [];
  private seeded = false;

  constructor(private scene: Phaser.Scene, kind: FxKind, spots: FireSpot[]) {
    for (const e of E[kind]) {
      for (let i = 0; i < e.n; i++) {
        const img = scene.add.image(0, 0, e.tex).setDepth(D).setVisible(false);
        if (e.add) img.setBlendMode(Phaser.BlendModes.ADD);
        this.ps.push({ img, e, x: 0, y: 0, vx: 0, vy: 0, age: 1e9, life: 1, ph: Math.random() * 6.28, sz: 1 });
      }
    }
    for (const s of spots) {
      const glow = scene.add.image(s.x, s.y, 'light_mask').setDepth(D - 10).setBlendMode(Phaser.BlendModes.ADD).setTint(0xff9a3a).setVisible(false);
      glow.setScale(260 / glow.width);
      this.fires.push({ spot: s, glow, acc: Math.random() });
    }
    if (spots.length) for (let i = 0; i < 40; i++) this.flames.push({ img: scene.add.image(0, 0, 'vfx_flare').setDepth(D - 5).setBlendMode(Phaser.BlendModes.ADD).setVisible(false), x: 0, y: 0, vy: 0, age: 0, life: 1, sz: 1, ph: 0, on: false });
    if (kind === 'town' || kind === 'forest' || kind === 'ember') {
      for (let i = 0; i < 5; i++) {
        const img = scene.add.image(0, 0, 'light_mask').setDepth(D - 100).setTint(0x000000).setAlpha(kind === 'ember' ? 0.12 : 0.09);
        const w = 900 + Math.random() * 600;
        img.setScale(w / 512, (w * 0.55) / 512);
        this.clouds.push({ img, x: 0, y: 0, w });
      }
    }
  }

  private rnd(r: R): number { return r[0] + Math.random() * (r[1] - r[0]); }

  private place(p: P, v: Phaser.Geom.Rectangle, fresh: boolean): void {
    const e = p.e, pad = 40;
    p.x = v.x - pad + Math.random() * (v.width + pad * 2);
    p.y = v.y - pad + Math.random() * (v.height + pad * 2);
    p.vx = this.rnd(e.vx); p.vy = this.rnd(e.vy);
    p.life = this.rnd(e.life);
    p.age = fresh ? Math.random() * p.life : 0;
    p.sz = this.rnd(e.size);
    const tint = e.tint[Math.floor(Math.random() * e.tint.length)];
    p.img.setTint(tint).setScale(p.sz / p.img.width);
    if (e.squash) p.img.scaleY = p.img.scaleX * e.squash;
  }

  update(time: number, dtMs: number): void {
    const cam = this.scene.cameras.main;
    const v = cam.worldView;
    const dt = Math.min(dtMs, 50) / 1000;
    const pad = 80;
    const left = v.x - pad, right = v.right + pad, top = v.y - pad, bot = v.bottom + pad;
    const first = !this.seeded;
    this.seeded = true;
    for (const p of this.ps) {
      if (p.age >= p.life || first) this.place(p, v, first);
      p.age += dtMs;
      const e = p.e;
      const w = e.wobble ? Math.sin(time / 600 + p.ph) * e.wobble : 0;
      p.x += (p.vx + w) * dt; p.y += p.vy * dt + (e.wobble ? Math.cos(time / 500 + p.ph) * e.wobble * 0.3 * dt : 0);
      if (p.x < left || p.x > right || p.y < top || p.y > bot) {
        // respawn on the leading edge when drifting out so density holds while the camera moves
        if (Math.random() < 0.5) this.place(p, v, false); else p.age = p.life;
      }
      const f = Math.sin(Math.PI * Math.min(1, p.age / p.life));
      const pulse = e.pulse ? 0.55 + 0.45 * Math.sin(time / 260 + p.ph * 3) : 1;
      p.img.setPosition(p.x, p.y).setAlpha(e.alpha * Math.min(1, f * 2.5) * pulse).setVisible(true);
      if (e.spin) p.img.rotation += e.spin * dt;
    }
    for (const c of this.clouds) {
      if (!c.x && !c.y) { c.x = v.x + Math.random() * v.width; c.y = v.y + Math.random() * v.height; }
      c.x += 16 * dt; c.y += 8 * dt;
      if (c.x - c.w > v.right || c.y - c.w > v.bottom) { c.x = v.x - c.w * 0.8; c.y = v.y + Math.random() * v.height; }
      else if (c.x + c.w < v.x - 600) { c.x = v.right + c.w * 0.5; }
      c.img.setPosition(c.x, c.y);
    }
    // fire glows + flame particles
    let live = 0;
    for (const f of this.fires) {
      const s = f.spot;
      const inView = s.x > left && s.x < right && s.y > top && s.y < bot + 120;
      f.glow.setVisible(inView);
      if (!inView) continue;
      const fl = 0.8 + Math.sin(time / 90 + s.x) * 0.1 + Math.sin(time / 37 + s.y) * 0.1;
      f.glow.setPosition(s.x, s.y + 20).setAlpha(0.3 * fl).setScale((240 + 40 * fl) / f.glow.width);
      f.acc += dt * 18;
      while (f.acc >= 1) {
        f.acc -= 1;
        const q = this.flames.find((x) => !x.on);
        if (!q) break;
        q.on = true; q.age = 0; q.life = 450 + Math.random() * 350; q.vy = -(50 + Math.random() * 40);
        q.x = s.x + (Math.random() - 0.5) * 12; q.y = s.y + 30 - (FLAME_H[s.key] ?? 40) + 36 + (Math.random() - 0.5) * 4;
        q.sz = 20 + Math.random() * 14; q.ph = Math.random() * 6;
      }
    }
    for (const q of this.flames) {
      if (!q.on) continue;
      q.age += dtMs; live++;
      const t = q.age / q.life;
      if (t >= 1) { q.on = false; q.img.setVisible(false); continue; }
      q.y += q.vy * dt; q.x += Math.sin(time / 120 + q.ph) * 12 * dt;
      q.img.setPosition(q.x, q.y).setScale((q.sz * (1 - t * 0.8)) / q.img.width).setAlpha(0.85 * (1 - t)).setTint(t < 0.4 ? 0xffd070 : 0xff6a20).setVisible(true);
    }
    void live;
  }

  destroy(): void {
    for (const p of this.ps) p.img.destroy();
    for (const f of this.fires) f.glow.destroy();
    for (const q of this.flames) q.img.destroy();
    for (const c of this.clouds) c.img.destroy();
    this.ps = []; this.fires = []; this.flames = []; this.clouds = [];
  }
}