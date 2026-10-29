import Phaser from 'phaser';
import { BASE_H, BASE_W } from '../constants';
import type { AreaDef } from '../data/areas';
import { DARKNESS_DEPTH } from '../iso/iso';

/**
 * Painterly atmosphere (cheap alternative to Light2D: no per-sprite normal maps, so animated spritesheets, the Darkness RT and the
 * camera post-FX keep working and W1 fights hold 60 fps). Layers, all screen-space and counter-scaled by 1/zoom:
 *   under the darkness RT : depth fog (tints the distant top of the screen), god rays (additive), two parallax fog/mist/ash wisp layers
 *   over the darkness RT  : painted vignette (tint-filled with the area's cool shadow colour) and a subtle paper grain
 * World-space helpers (shadow blobs, light pools) live in WorldRenderer / Ambient and use atmoTex() below.
 * Every texture has a procedural fallback so the game looks right before/without the generated atmosphere art.
 */

type Ctx = CanvasRenderingContext2D;
function radial(c: Ctx, w: number, h: number, dark = false): void {
  const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  const col = dark ? '0,0,0' : '255,255,255';
  g.addColorStop(0, `rgba(${col},${dark ? 0.9 : 1})`); g.addColorStop(0.5, `rgba(${col},${dark ? 0.45 : 0.4})`); g.addColorStop(1, `rgba(${col},0)`);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}
function blobs(c: Ctx, w: number, h: number, n: number, seed: number): void {
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < n; i++) {
    const x = w * (0.15 + 0.7 * r()), y = h * (0.3 + 0.4 * r()), rad = h * (0.25 + 0.3 * r());
    const g = c.createRadialGradient(x, y, 0, x, y, rad * 1.8);
    g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.save(); c.translate(x, y); c.scale(1.8, 0.7); c.translate(-x, -y); c.fillStyle = g; c.beginPath(); c.arc(x, y, rad * 1.8, 0, 6.3); c.fill(); c.restore();
  }
}
const FALLBACK: Record<string, { w: number; h: number; draw: (c: Ctx, w: number, h: number) => void }> = {
  god_rays: { w: 256, h: 512, draw: (c, w, h) => {
    for (let i = 0; i < 4; i++) {
      const x0 = w * (0.1 + i * 0.22), bw = w * (0.08 + 0.05 * (i % 2));
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0 + bw, 0); c.lineTo(x0 + bw + w * 0.2, h); c.lineTo(x0 + w * 0.1, h); c.closePath(); c.fill();
    }
  } },
  fog_wisp_1: { w: 512, h: 256, draw: (c, w, h) => blobs(c, w, h, 7, 11) },
  fog_wisp_2: { w: 512, h: 256, draw: (c, w, h) => blobs(c, w, h, 6, 23) },
  light_pool: { w: 256, h: 256, draw: (c, w, h) => radial(c, w, h) },
  shadow_blob: { w: 256, h: 256, draw: (c, w, h) => radial(c, w, h, true) },
  paint_vignette: { w: 512, h: 288, draw: (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 1.0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.6, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0.95)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  } },
  paper_grain: { w: 128, h: 128, draw: (c, w, h) => {
    const id = c.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const v = 200 + Math.random() * 55; id.data[i * 4] = v; id.data[i * 4 + 1] = v * 0.97; id.data[i * 4 + 2] = v * 0.9; id.data[i * 4 + 3] = 255; }
    c.putImageData(id, 0, 0);
  } },
};

/** Texture key for an atmosphere asset: the generated PNG when loaded, else a cached procedural fallback. */
export function atmoTex(scene: Phaser.Scene, name: string): string {
  const real = `fx_atmo_${name}`;
  if (scene.textures.exists(real)) return real;
  const fb = `atmo_fb_${name}`;
  if (!scene.textures.exists(fb)) {
    const d = FALLBACK[name];
    const t = scene.textures.createCanvas(fb, d.w, d.h);
    if (t) { d.draw(t.getContext(), d.w, d.h); t.refresh(); }
  }
  return fb;
}

interface Wisp { img: Phaser.GameObjects.Image; sx: number; sy: number; vx: number; par: number; base: number; ph: number; w: number; }
interface Ray { img: Phaser.GameObjects.Image; sx: number; vx: number; ph: number; par: number; }

const CX = BASE_W / 2, CY = BASE_H / 2;

export class Atmosphere {
  private all: Phaser.GameObjects.Image[] = [];
  private wisps: Wisp[] = [];
  private rays: Ray[] = [];
  private depth?: Phaser.GameObjects.Image;
  private vig?: Phaser.GameObjects.Image;
  private grain?: Phaser.GameObjects.TileSprite;
  private last?: { x: number; y: number };

  constructor(private scene: Phaser.Scene, private def: AreaDef) {
    const a = def.atmo;
    const add = (o: Phaser.GameObjects.Image, d: number) => { o.setScrollFactor(0).setDepth(DARKNESS_DEPTH + d); this.all.push(o); return o; };
    if (a.depthAlpha > 0) {
      if (!scene.textures.exists('atmo_depthfog2')) {
        const t = scene.textures.createCanvas('atmo_depthfog2', 4, 128);
        if (t) {
          const c = t.getContext(), g = c.createLinearGradient(0, 0, 0, 128);
          g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.28, 'rgba(255,255,255,0.3)'); g.addColorStop(0.55, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          c.fillStyle = g; c.fillRect(0, 0, 4, 128); t.refresh();
        }
      }
      this.depth = add(scene.add.image(CX, 0, 'atmo_depthfog2'), -8).setTint(a.depthColor).setAlpha(a.depthAlpha);
    }
    if (a.rays > 0) {
      const tex = atmoTex(scene, 'god_rays');
      for (let i = 0; i < 4; i++) {
        const img = add(scene.add.image(0, 0, tex).setOrigin(0.5, 0), -7).setBlendMode(Phaser.BlendModes.ADD).setTint(a.rayColor);
        this.rays.push({ img, sx: (i + 0.5) * (BASE_W / 4) + (Math.random() - 0.5) * 120, vx: 5 + Math.random() * 6, ph: Math.random() * 6.28, par: 0.1 + 0.08 * i });
      }
    }
    if (a.fog !== 'none') {
      const t1 = atmoTex(scene, 'fog_wisp_1'), t2 = atmoTex(scene, 'fog_wisp_2');
      for (let layer = 0; layer < 2; layer++) {
        for (let i = 0; i < 5; i++) {
          const img = add(scene.add.image(0, 0, (i + layer) % 2 ? t1 : t2), -6 + layer * 0.1).setTint(a.fogColor);
          const w = (layer ? 1500 : 1100) * (0.8 + Math.random() * 0.5);
          const yBand = a.fog === 'ground' ? 0.62 + 0.35 * Math.random() : a.fog === 'mist' ? 0.25 + 0.6 * Math.random() : Math.random();
          this.wisps.push({ img, w, sx: Math.random() * (BASE_W + w) - w / 2, sy: yBand * BASE_H, vx: (layer ? 26 : 12) * (a.fog === 'ash' ? 1.6 : 1) * (0.8 + Math.random() * 0.4), par: layer ? 0.55 : 0.25, base: a.fogAlpha * (layer ? 0.8 : 1), ph: Math.random() * 6.28 });
        }
      }
    }
    if (a.vignette > 0) this.vig = add(scene.add.image(CX, CY, atmoTex(scene, 'paint_vignette')), 1).setTintFill(a.shadowColor).setAlpha(a.vignette);
    if (a.grain > 0) {
      this.grain = scene.add.tileSprite(CX, CY, BASE_W, BASE_H, atmoTex(scene, 'paper_grain')).setScrollFactor(0).setDepth(DARKNESS_DEPTH + 2).setAlpha(a.grain);
      this.grain.setBlendMode(Phaser.BlendModes.MULTIPLY);
    }
  }

  update(time: number, dtMs: number): void {
    const cam = this.scene.cameras.main, z = cam.zoom, dt = Math.min(dtMs, 50) / 1000;
    const dx = this.last ? cam.scrollX - this.last.x : 0, dy = this.last ? cam.scrollY - this.last.y : 0;
    this.last = { x: cam.scrollX, y: cam.scrollY };
    const put = (img: Phaser.GameObjects.Image, sx: number, sy: number, w: number, h: number) => {
      img.setPosition(CX + (sx - CX) / z, CY + (sy - CY) / z).setDisplaySize(w / z, h / z);
    };
    if (this.depth) { this.depth.setOrigin(0.5, 0); put(this.depth, CX, 0, BASE_W * 1.05, BASE_H * 1.1); this.depth.y = CY - (CY / z); }
    for (const r of this.rays) {
      r.sx += r.vx * dt - dx * z * r.par;
      if (r.sx > BASE_W + 300) r.sx = -300; else if (r.sx < -300) r.sx = BASE_W + 300;
      const pulse = 0.55 + 0.45 * Math.sin(time / 2600 + r.ph) * Math.sin(time / 4100 + r.ph * 2);
      r.img.setAlpha(this.def.atmo.rays * 0.3 * Math.max(0.1, pulse));
      put(r.img, r.sx, -40, 420, BASE_H * 1.25);
      r.img.setRotation(0.38);
    }
    for (const w of this.wisps) {
      w.sx += w.vx * dt - dx * z * w.par;
      const span = BASE_W + w.w;
      if (w.sx > BASE_W + w.w / 2) w.sx -= span; else if (w.sx < -w.w / 2) w.sx += span;
      w.sy -= dy * z * w.par * 0.6;
      if (w.sy < -80) w.sy += BASE_H + 160; else if (w.sy > BASE_H + 80) w.sy -= BASE_H + 160;
      w.img.setAlpha(w.base * (0.7 + 0.3 * Math.sin(time / 3400 + w.ph)));
      put(w.img, w.sx, w.sy, w.w, w.w * 0.5);
    }
    if (this.vig) put(this.vig, CX, CY, BASE_W * 1.02, BASE_H * 1.02);
    if (this.grain) {
      this.grain.setScale(1 / z);
      const k = Math.floor(time / 110);
      this.grain.tilePositionX = (k * 37) % 128; this.grain.tilePositionY = (k * 53) % 128;
    }
  }

  destroy(): void {
    for (const o of this.all) o.destroy();
    this.grain?.destroy();
    this.all = []; this.wisps = []; this.rays = []; this.depth = undefined; this.vig = undefined; this.grain = undefined;
  }
}