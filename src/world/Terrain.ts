import Phaser from 'phaser';

/**
 * Terrain transitions. Ground tiles are 256x128 diamonds. For a tile whose neighbour is a higher-priority ground type we
 * overlay the texture of that neighbour, masked by a noisy soft gradient (4 edge + 4 corner masks), so borders melt into each
 * other. All masked textures are baked once into canvas textures and cached. Liquids get foam / ember lines; tiles get decals.
 */

const W = 256, H = 128, HW = 128, HH = 64;
const D0 = (HW * HH) / Math.hypot(HW, HH);
const DEPTH = 46;
const N = Math.hypot(HH, HW);
const NORMALS: [number, number][] = [[HH / N, HW / N], [-HH / N, -HW / N], [-HH / N, HW / N], [HH / N, -HW / N]];
const VERTS: [number, number][] = [[0, HH], [0, -HH], [HW, 0], [-HW, 0]];
export const EDGE_DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const CORNER_DIRS: [number, number][] = [[1, 1], [-1, -1], [1, -1], [-1, 1]];

const FAMILY: Record<string, string> = { w1_grass_flowers: 'w1_grass' };
const PRIORITY: Record<string, number> = {
  w1_water: 0, w2_lava: 0, w1_dirt: 1, w2_ash: 1, town_cobble: 1.5, w1_grass: 2, w2_obsidian: 2, w1_forest_floor: 3,
};
export const familyOf = (k: string): string => FAMILY[k] ?? k;
export const priorityOf = (k: string): number => PRIORITY[familyOf(k)] ?? -1;
export const isLiquid = (k: string): boolean => k.includes('water') || k.includes('lava');
export const LIT: Record<string, { mul: number; add: [number, number, number] }> = { w2_obsidian: { mul: 1.9, add: [10, 6, 26] } };

const hash = (x: number, y: number, s: number): number => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const sstep = (t: number): number => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); };

const noiseCache: Float32Array[] = [];
function noiseField(variant: number): Float32Array {
  let f = noiseCache[variant];
  if (f) return f;
  f = new Float32Array(W * H);
  const vn = (x: number, y: number, cell: number, s: number) => {
    const gx = x / cell, gy = y / cell, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = sstep(gx - x0), fy = sstep(gy - y0);
    const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) f[y * W + x] = vn(x, y, 22, variant * 7 + 1) * 0.6 + vn(x, y, 8, variant * 7 + 2) * 0.3 + vn(x, y, 3, variant * 7 + 3) * 0.1;
  noiseCache[variant] = f;
  return f;
}

type Ctx = CanvasRenderingContext2D;
const srcOf = (scene: Phaser.Scene, key: string): CanvasImageSource | undefined => scene.textures.exists(key) ? (scene.textures.get(key).getSourceImage() as CanvasImageSource) : undefined;

export class Terrain {
  private made = new Set<string>();
  constructor(private scene: Phaser.Scene) {}

  /** Ground texture key to draw for a ground key (brightened variant for near-black tiles). */
  groundTexture(key: string): string {
    const lit = LIT[key];
    if (!lit) return key;
    const k = key + '_lit';
    if (this.scene.textures.exists(k)) return k;
    const src = srcOf(this.scene, key);
    if (!src) return key;
    const t = this.scene.textures.createCanvas(k, W, H);
    if (!t) return key;
    const ctx = t.getContext() as Ctx;
    ctx.drawImage(src, 0, 0, W, H);
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.min(255, d[i] * lit.mul + lit.add[0]); d[i + 1] = Math.min(255, d[i + 1] * lit.mul + lit.add[1]); d[i + 2] = Math.min(255, d[i + 2] * lit.mul + lit.add[2]);
    }
    ctx.putImageData(img, 0, 0);
    t.refresh();
    return k;
  }

  /** Masked copy of src for edge dir 0..3 or corner 4..7. */
  blendKey(src: string, kind: number, variant: number): string {
    const key = 'bl_' + src + '_' + kind + '_' + variant;
    if (this.made.has(key) || this.scene.textures.exists(key)) return key;
    this.made.add(key);
    const img = srcOf(this.scene, this.groundTexture(src));
    if (!img) return src;
    const t = this.scene.textures.createCanvas(key, W, H);
    if (!t) return src;
    const ctx = t.getContext() as Ctx;
    ctx.drawImage(img, 0, 0, W, H);
    const id = ctx.getImageData(0, 0, W, H), d = id.data, nf = noiseField(variant);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px = x - HW + 0.5, py = y - HH + 0.5, nz = nf[y * W + x] - 0.5;
      let a: number;
      if (kind < 4) {
        const n = NORMALS[kind];
        a = sstep((px * n[0] + py * n[1] - (D0 - DEPTH)) / DEPTH + nz * 0.95);
      } else {
        const v = VERTS[kind - 4];
        const dist = Math.hypot((px - v[0]) * 0.5, py - v[1]);
        a = sstep(1 - dist / 40 + nz * 0.8);
      }
      d[(y * W + x) * 4 + 3] *= a;
    }
    ctx.putImageData(id, 0, 0);
    t.refresh();
    return key;
  }

  /** Foam (water) / ember (lava) line along an edge, drawn on the liquid tile. */
  foamKey(kind: number, variant: number, lava: boolean): string {
    const key = 'foam_' + (lava ? 'l' : 'w') + '_' + kind + '_' + variant;
    if (this.made.has(key) || this.scene.textures.exists(key)) return key;
    this.made.add(key);
    const t = this.scene.textures.createCanvas(key, W, H);
    if (!t) return key;
    const ctx = t.getContext() as Ctx;
    const id = ctx.createImageData(W, H), d = id.data, nf = noiseField(variant + 2), n = NORMALS[kind];
    const s0 = D0 - DEPTH * 0.42;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px = x - HW + 0.5, py = y - HH + 0.5, nz = nf[y * W + x];
      const proj = px * n[0] + py * n[1];
      const s = proj - s0 + (nz - 0.5) * 26;
      const band = Math.exp(-(s * s) / (2 * 6 * 6)) * (0.2 + 1.1 * nz * nz);
      const edge = sstep((D0 - proj) / 6);
      const a = Math.min(1, band) * edge * (lava ? 0.8 : 0.6);
      const o = (y * W + x) * 4;
      d[o] = lava ? 255 : 250; d[o + 1] = lava ? 150 : 253; d[o + 2] = lava ? 40 : 255; d[o + 3] = a * 255;
    }
    ctx.putImageData(id, 0, 0);
    t.refresh();
    return key;
  }

  /** Small procedural decals, created once. */
  decalKeys(): Record<string, string[]> {
    if (!this.made.has('decals')) {
      this.made.add('decals');
      const mk = (name: string, w: number, h: number, draw: (c: Ctx) => void) => {
        if (this.scene.textures.exists(name)) return;
        const t = this.scene.textures.createCanvas(name, w, h);
        if (!t) return;
        draw(t.getContext() as Ctx);
        t.refresh();
      };
      const blade = (c: Ctx, x: number, y: number, hh: number, lean: number, col: string) => { c.strokeStyle = col; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + lean * 0.3, y - hh * 0.6, x + lean, y - hh); c.stroke(); };
      for (let v = 0; v < 3; v++) {
        mk('decal_tuft_' + v, 28, 20, (c) => { const cols = ['#4f8a2e', '#6aa63a', '#3f7424']; for (let i = 0; i < 5 + v; i++) blade(c, 5 + i * 3.4, 19, 9 + hash(i, v, 1) * 8, (hash(i, v, 2) - 0.5) * 10, cols[i % 3]); });
        mk('decal_pebble_' + v, 20, 12, (c) => { for (let i = 0; i < 2 + v; i++) { const x = 4 + hash(i, v, 3) * 12, y = 4 + hash(i, v, 4) * 5, r = 1.8 + hash(i, v, 5) * 2; c.fillStyle = 'rgba(0,0,0,0.27)'; c.beginPath(); c.ellipse(x + 1, y + 1.5, r * 1.2, r * 0.7, 0, 0, 7); c.fill(); c.fillStyle = ['#8f8a80', '#a39d90', '#76716a'][i % 3]; c.beginPath(); c.ellipse(x, y, r, r * 0.75, 0, 0, 7); c.fill(); } });
        mk('decal_flower_' + v, 22, 22, (c) => { const cols = ['#ffe680', '#ff9ac8', '#ffffff']; blade(c, 11, 21, 12, 0, '#4f8a2e'); c.fillStyle = cols[v]; for (let k = 0; k < 5; k++) { const a = (k / 5) * 6.283; c.beginPath(); c.arc(11 + Math.cos(a) * 3.2, 8 + Math.sin(a) * 3.2, 2.4, 0, 7); c.fill(); } c.fillStyle = '#e8a020'; c.beginPath(); c.arc(11, 8, 1.8, 0, 7); c.fill(); });
        mk('decal_crack_' + v, 34, 16, (c) => { c.strokeStyle = 'rgba(26,12,8,0.8)'; c.lineWidth = 1.6; c.beginPath(); let x = 3, y = 8; c.moveTo(x, y); for (let i = 0; i < 6; i++) { x += 4 + hash(i, v, 6) * 3; y += (hash(i, v, 7) - 0.5) * 7; c.lineTo(x, y); } c.stroke(); c.strokeStyle = 'rgba(255,106,32,0.4)'; c.lineWidth = 0.9; c.stroke(); });
      }
    }
    const names = (p: string) => [0, 1, 2].map((v) => p + '_' + v);
    return { tuft: names('decal_tuft'), pebble: names('decal_pebble'), flower: names('decal_flower'), crack: names('decal_crack') };
  }
}
