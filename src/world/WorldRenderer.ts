import Phaser from 'phaser';
import { ISO, PROP_H, tileScale } from '../constants';
import type { AtmoDef } from '../data/areas';
import { atmoTex } from '../fx/Atmosphere';
import { cellCenterWorld, GROUND_DEPTH, gridToWorld, worldToGrid } from '../iso/iso';
import { CORNER_DIRS, EDGE_DIRS, familyOf, isLiquid, priorityOf, Terrain } from './Terrain';
import { NO_TILE, type PropInst, type TileMap } from './TileMap';

type Img = Phaser.GameObjects.Image;

/** Wind sway amplitude (radians) per prop key. Bottom-origin rotation so the roots stay planted. */
const SWAY: Record<string, number> = {
  tree_oak_1: 0.016, tree_oak_2: 0.016, tree_pine: 0.012, bush: 0.035, flowers: 0.06, mushrooms: 0.015, dead_tree: 0.008, banner: 0.05,
};

/** Cells drawn beyond the playable map so no void is ever visible, even at min zoom. */
const BORDER = 36;
const NO_SHADOW = new Set(['bridge_wood', 'banner_festival', 'lantern_string', 'chains_hanging', 'cobweb_corner', 'ruin_arch', 'torch', 'brazier', 'waypoint']);
const hash2 = (i: number, j: number): number => { let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const BORDER_PROPS_W1 = ['tree_oak_1', 'tree_oak_2', 'tree_pine', 'tree_pine', 'bush', 'rock_1'];
const BORDER_PROPS_W2 = ['dead_tree', 'obsidian_spire', 'ruins_pillar', 'lava_rock', 'rock_1', 'crystal'];

interface Fluid { img: Img; i: number; j: number; y0: number; lava: boolean; }

/** Draws a TileMap lazily, creating sprites only for cells near the camera and hiding the rest. Culls against camera.worldView (zoom-aware). */
export class WorldRenderer {
  private ground = new Map<number, Img>();
  private walls = new Map<number, Img>();
  private propSprites = new Map<PropInst, Img>();
  private propsByCell = new Map<number, PropInst[]>();
  private fluids = new Map<Img, Fluid>();
  private visible: Img[] = [];
  private visFluids: Fluid[] = [];
  private visSway: { s: Img; p: PropInst; amp: number }[] = [];
  private focus?: { x: number; y: number };
  private terrain: Terrain;
  private decor = new Map<number, Img[]>();
  private decals: Record<string, string[]>;
  private bGround = new Map<number, Img>();
  private bProps = new Map<number, Img>();
  private readonly wallMass: boolean;
  private readonly bProto: string[];
  private readonly bGroundKey: string;
  private shadows = new Map<object, Img>();
  private scaleCache = new Map<string, number>();
  private blotches = new Map<number, Img>();
  private camMid = { x: 0, y: 0 };

  constructor(private scene: Phaser.Scene, private map: TileMap, private atmo?: AtmoDef) {
    this.terrain = new Terrain(scene);
    this.decals = this.terrain.decalKeys();
    this.prebake();
    this.wallMass = !!map.wallKey && !map.wallKey.startsWith('town');
    const g0 = map.groundKeys.find((k) => !k.includes('water') && !k.includes('lava')) ?? map.groundKeys[0];
    this.bGroundKey = g0;
    this.bProto = g0.startsWith('w2') ? BORDER_PROPS_W2 : BORDER_PROPS_W1;
    for (const p of map.props) {
      const n = map.idx(Math.min(p.gx + p.w - 1, map.width - 1), Math.min(p.gy + p.h - 1, map.height - 1));
      const arr = this.propsByCell.get(n);
      if (arr) arr.push(p); else this.propsByCell.set(n, [p]);
    }
  }

  /** Anchor point (bottom-center) of a prop in world space. */
  static propAnchor(p: PropInst): { x: number; y: number } {
    const c = gridToWorld(p.gx + p.w / 2, p.gy + p.h / 2);
    const half = ((p.w + p.h) * ISO.TILE_H) / 4;
    return { x: c.x, y: c.y + half * 0.5 };
  }

  /** World scale for a prop so it ends up PROP_H[key] px tall whatever the texture resolution (falls back to 0.5x for unknown keys). */
  private propScale(key: string): number {
    let k = this.scaleCache.get(key);
    if (k === undefined) {
      const h = this.scene.textures.exists(key) ? this.scene.textures.get(key).getSourceImage().height : 256;
      k = (PROP_H[key] ?? h * ISO.ART_SCALE) / h;
      this.scaleCache.set(key, k);
    }
    return k;
  }
  private wallScale(): number {
    const k = this.map.wallKey;
    return tileScale(this.scene.textures.exists(k) ? this.scene.textures.get(k).getSourceImage().width : 256);
  }

  /** Painted multiply shadow blob on the ground (static; pooled through the visible list). */
  private blob(owner: object, x: number, y: number, w: number, h: number, alpha: number): Img | undefined {
    if (!this.atmo) return undefined;
    let b = this.shadows.get(owner);
    if (!b) {
      b = this.scene.add.image(x, y, atmoTex(this.scene, 'shadow_blob')).setDisplaySize(w, h).setDepth(GROUND_DEPTH + 0.5)
        .setBlendMode(Phaser.BlendModes.MULTIPLY).setTintFill(this.atmo.shadowColor === 0 ? 0x101018 : 0x1a2038).setAlpha(alpha);
      this.shadows.set(owner, b);
    }
    b.setVisible(true);
    this.visible.push(b);
    return b;
  }

  spriteFor(p: PropInst): Img | undefined { return this.propSprites.get(p); }

  update(cam: Phaser.Cameras.Scene2D.Camera, focus?: { x: number; y: number }): void {
    this.focus = focus;
    this.camMid = { x: cam.midPoint.x, y: cam.midPoint.y };
    for (const s of this.visible) s.setVisible(false);
    this.visible.length = 0;
    this.visFluids.length = 0;
    this.visSway.length = 0;
    const v = cam.worldView;
    const pad = 220;
    // Screen rect (world px) a cell must touch to be drawn; tall props extend far above their cell.
    const rl = v.x - pad, rr = v.right + pad, rt = v.y - pad - 120, rb = v.bottom + pad + 260;
    const corners = [
      worldToGrid(rl, rt), worldToGrid(rr, rt), worldToGrid(rl, rb), worldToGrid(rr, rb),
    ];
    const m = this.map;
    const i0 = Math.max(-BORDER, Math.floor(Math.min(...corners.map((c) => c.gx))));
    const i1 = Math.min(m.width - 1 + BORDER, Math.ceil(Math.max(...corners.map((c) => c.gx))));
    const j0 = Math.max(-BORDER, Math.floor(Math.min(...corners.map((c) => c.gy))));
    const j1 = Math.min(m.height - 1 + BORDER, Math.ceil(Math.max(...corners.map((c) => c.gy))));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const cx = (i - j) * (ISO.TILE_W / 2), cy = (i + j + 1) * (ISO.TILE_H / 2);
        if (cx < rl || cx > rr || cy < rt || cy > rb) continue;
        if (i < 0 || j < 0 || i >= m.width || j >= m.height) { this.showBorder(i, j); continue; }
        const n = m.idx(i, j);
        if (m.wall[n]) {
          this.show(this.walls, n, () => this.makeWall(i, j));
          if (this.atmo) { const c = cellCenterWorld(i, j); this.blob(this.walls.get(n)!, c.x, c.y + 10, ISO.TILE_W * 2.1, ISO.TILE_H * 1.7, 0.5 * this.atmo.shadowAlpha); }
        }
        else if (m.ground[n] !== NO_TILE) {
          this.show(this.ground, n, () => this.makeGround(i, j, n));
          if (!this.wallMass && i % 5 === 0 && j % 5 === 0) this.blotch(i, j);
          const dc = this.decor.get(n);
          if (dc) for (const o of dc) { o.setVisible(true); this.visible.push(o); }
        }
        else if (this.wallMass) this.showBorder(i, j); // solid rock between dungeon rooms instead of black void
        const props = this.propsByCell.get(n);
        if (props) for (const p of props) this.showProp(p);
      }
    }
    this.animate(this.scene.time.now);
  }

  /** Themed filler outside the map: ground + dense trees/rocks (overworld) or a solid wall mass (dungeon), fading to dark with distance. */
  private showBorder(i: number, j: number): void {
    const m = this.map;
    const inMap = i >= 0 && j >= 0 && i < m.width && j < m.height;
    const d = Math.max(1, -i, -j, i - m.width + 1, j - m.height + 1); // cells beyond the edge (>=1)
    const k = (j + BORDER) * (m.width + 2 * BORDER) + (i + BORDER);
    const fog = Math.max(0.28, 1 - d / (BORDER * 0.9));
    let g = inMap ? undefined : this.bGround.get(k);
    if (!inMap && !g) {
      const c = cellCenterWorld(i, j);
      g = this.scene.add.image(c.x, c.y, this.bGroundKey).setDisplaySize(ISO.TILE_W + 2, ISO.TILE_H + 1).setDepth(GROUND_DEPTH);
      const sh = Math.round(255 * fog * (this.wallMass ? 0.6 : 0.85));
      g.setTint(Phaser.Display.Color.GetColor(sh, sh, sh));
      this.bGround.set(k, g);
    }
    if (g) { g.setVisible(true); this.visible.push(g); }
    const r = hash2(i, j);
    if (this.wallMass) {
      let w = this.bProps.get(k);
      if (!w) {
        const c = cellCenterWorld(i, j), y = c.y + ISO.TILE_H / 2;
        w = this.scene.add.image(c.x, y, m.wallKey).setOrigin(0.5, 1).setScale(this.wallScale()).setDepth(y);
        const sh = Math.round(255 * Math.max(0.2, fog * 0.8));
        w.setTint(Phaser.Display.Color.GetColor(sh, sh, sh));
        this.bProps.set(k, w);
      }
      w.setVisible(true); this.visible.push(w);
      return;
    }
    if (r > 0.72 && d > 3) return; // a few clearings far out
    let s = this.bProps.get(k);
    if (!s) {
      const key = d <= 2 ? this.bProto[(r * 3) | 0] : this.bProto[(r * this.bProto.length) | 0];
      const a = WorldRenderer.propAnchor({ key, gx: i, gy: j, w: 1, h: 1, blocks: true });
      s = this.scene.add.image(a.x + (hash2(j, i) - 0.5) * 30, a.y, key).setOrigin(0.5, 1)
        .setScale(this.propScale(key) * (0.9 + hash2(i + 7, j) * 0.4)).setDepth(a.y);
      if (hash2(i, j + 3) < 0.5) s.setFlipX(true);
      const sh = Math.round(255 * Math.max(0.3, fog));
      s.setTint(Phaser.Display.Color.GetColor(sh, sh, sh));
      this.bProps.set(k, s);
    }
    s.setVisible(true); this.visible.push(s);
  }

  private animate(t: number): void {
    for (const f of this.visFluids) {
      const a = Math.sin(t * 0.0021 + (f.i * 0.55 + f.j * 0.35)), b = Math.sin(t * 0.0013 - f.i * 0.4 + f.j * 0.7);
      if (f.lava) {
        const k = 0.5 + 0.5 * a;
        f.img.setTint(Phaser.Display.Color.GetColor(255, 170 + 70 * k, 110 + 60 * k));
      } else {
        const k = 0.5 + 0.5 * a;
        f.img.setTint(Phaser.Display.Color.GetColor(205 + 50 * k, 225 + 30 * k, 255));
      }
      f.img.y = f.y0 + b * 1.2;
    }
    for (const w of this.visSway) {
      const ph = w.p.gx * 0.71 + w.p.gy * 1.13;
      const gust = Math.sin(t * 0.0011 + ph) + 0.5 * Math.sin(t * 0.0027 + ph * 1.7);
      w.s.setRotation(gust * w.amp * (w.p.flipX ? -1 : 1) * 0.8);
    }
  }

  private show(store: Map<number, Img>, n: number, make: () => Img): void {
    let s = store.get(n);
    if (!s) { s = make(); store.set(n, s); }
    s.setVisible(true);
    this.visible.push(s);
    const f = this.fluids.get(s);
    if (f) this.visFluids.push(f);
  }

  private showProp(p: PropInst): void {
    let s = this.propSprites.get(p);
    if (!s) {
      if (!this.scene.textures.exists(p.key)) return; // art not available (yet): draw nothing rather than a placeholder box
      const a = WorldRenderer.propAnchor(p);
      s = this.scene.add.image(a.x, a.y - (p.lift ?? 0), p.key).setOrigin(0.5, 1).setScale(this.propScale(p.key) * (p.scale ?? 1)).setDepth(a.y);
      if (p.flipX) s.setFlipX(true);
      if (p.tint !== undefined) s.setTint(p.tint);
      this.propSprites.set(p, s);
    }
    const focus = this.focus;
    if (focus) {
      // Fade tall props standing in front of the hero so he never disappears behind canopies.
      const b = s.getBounds();
      const hide = s.depth > focus.y && s.displayHeight > 90 && focus.x > b.x + b.width * 0.15 && focus.x < b.right - b.width * 0.15 && focus.y - 90 > b.y && focus.y - 90 < b.bottom;
      const a = hide ? 0.4 : 1;
      if (s.alpha !== a) s.setAlpha(Phaser.Math.Linear(s.alpha, a, 0.25));
    }
    s.setVisible(true);
    this.visible.push(s);
    const a = WorldRenderer.propAnchor(p), ph = PROP_H[p.key] ?? 0;
    if (this.atmo && ph >= 90 && !NO_SHADOW.has(p.key)) {
      const d = this.atmo.shadowDir, w = Math.max(p.w * ISO.TILE_W * 0.9, s.displayWidth * 0.75);
      this.blob(p, a.x + d[0] * ph * 0.28, a.y - 6 + d[1] * ph * 0.14, w * 1.25, w * 0.62, this.atmo.shadowAlpha);
    }
    // subtle foreground parallax: tall props in the lower half of the view drift a touch outward from the view centre (camera-tilt feel)
    if (ph >= 150 && !p.lift) {
      const f = Phaser.Math.Clamp((a.y - this.camMid.y) / 260, 0, 1);
      s.x = a.x + (a.x - this.camMid.x) * 0.04 * f;
    }
    const amp = SWAY[p.key];
    if (amp) this.visSway.push({ s, p, amp });
  }

  private makeGround(i: number, j: number, n: number): Img {
    const c = cellCenterWorld(i, j);
    const key = this.map.groundKeys[this.map.ground[n]];
    const img = this.scene.add.image(c.x, c.y, this.terrain.groundTexture(key)).setDisplaySize(ISO.TILE_W + 2, ISO.TILE_H + 1).setDepth(GROUND_DEPTH);
    // Break the tile grid: random flips (the diamond is symmetric), per-tile jitter and low-frequency colour drift.
    const r = hash2(i + 101, j + 57);
    img.setFlip(r < 0.5, hash2(i + 7, j + 211) < 0.5);
    const lf = this.lowNoise(i, j), jit = (hash2(i * 5 + 9, j * 3 + 4) - 0.5) * 0.08;
    const shade = Math.round(Phaser.Math.Clamp(252 * (1 + (lf - 0.5) * 0.22 + jit), 150, 255));
    const tr = Math.min(255, Math.round(shade * (1 + (lf - 0.5) * 0.10))), tb = Math.min(255, Math.round(shade * (1 - (lf - 0.5) * 0.10)));
    img.setTint(Phaser.Display.Color.GetColor(tr, shade, tb));
    if (key.includes('water') || key.includes('lava')) this.fluids.set(img, { img, i, j, y0: c.y, lava: key.includes('lava') });
    this.decor.set(n, this.makeDecor(i, j, key, c, shade));
    return img;
  }

  /** Smooth value noise in 0..1 (features ~7 cells wide). */
  private lowNoise(i: number, j: number): number {
    const f = 1 / 7, x = i * f, y = j * f, x0 = Math.floor(x), y0 = Math.floor(y);
    const u = x - x0, v = y - y0, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const a = hash2(x0, y0), b = hash2(x0 + 1, y0), c = hash2(x0, y0 + 1), d = hash2(x0 + 1, y0 + 1);
    return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
  }

  /** Big soft colour blotch laid over the ground so terrain reads as one continuous painted surface. */
  private blotch(i: number, j: number): void {
    const k = (j + 1000) * 4096 + i + 1000;
    let b = this.blotches.get(k);
    if (!b) {
      const c = cellCenterWorld(i, j), r = hash2(i + 5, j + 9), r2 = hash2(i + 15, j + 3);
      const cols = [0x6a7a30, 0x3a5a2a, 0x8a7440, 0x2c4a3c, 0x9a8a3a];
      const w = 800 + r * 700;
      b = this.scene.add.image(c.x + (r2 - 0.5) * 300, c.y + (r - 0.5) * 150, 'light_mask').setDisplaySize(w, w * 0.55).setDepth(GROUND_DEPTH + 0.4)
        .setBlendMode(Phaser.BlendModes.MULTIPLY).setTint(cols[(r * 77 | 0) % cols.length]).setAlpha(0.16 + r2 * 0.14);
      this.blotches.set(k, b);
    }
    b.setVisible(true); this.visible.push(b);
  }

  /** Ground type at a cell, or undefined for void/wall. */
  private keyAt(i: number, j: number): string | undefined {
    const m = this.map;
    if (!m.inBounds(i, j)) return undefined;
    const n = m.idx(i, j);
    return m.ground[n] === NO_TILE ? undefined : m.groundKeys[m.ground[n]];
  }

  /** Pre-create every masked texture the map can need (canvas work happens once, during the scene fade-in). */
  private prebake(): void {
    const keys = this.map.groundKeys, T = this.terrain;
    for (const k of keys) T.groundTexture(k);
    for (let a = 0; a < keys.length; a++) for (let b = 0; b < keys.length; b++) {
      if (familyOf(keys[a]) === familyOf(keys[b]) || priorityOf(keys[b]) <= priorityOf(keys[a]) || priorityOf(keys[a]) < 0) continue;
      for (let kind = 0; kind < 8; kind++) for (let v = 0; v < 2; v++) T.blendKey(familyOf(keys[b]), kind, v);
    }
    for (const k of keys) if (isLiquid(k)) for (let kind = 0; kind < 4; kind++) for (let v = 0; v < 2; v++) T.foamKey(kind, v, k.includes('lava'));
  }

  /** Border blend overlays + scattered decals for one ground cell (static, created once). */
  private makeDecor(i: number, j: number, key: string, c: { x: number; y: number }, shade: number): Img[] {
    const out: Img[] = [];
    const T = this.terrain, sc = this.scene;
    const pa = priorityOf(key), fam = familyOf(key);
    if (pa < 0) return out;
    const tint = Phaser.Display.Color.GetColor(shade, shade, shade);
    const add = (tex: string, depth: number, tn = tint, x = c.x, y = c.y, size = true): Img => {
      const im = sc.add.image(x, y, tex).setDepth(depth).setTint(tn);
      if (size) im.setDisplaySize(ISO.TILE_W + 2, ISO.TILE_H + 1);
      out.push(im);
      return im;
    };
    const v = hash2(i, j + 11) < 0.5 ? 0 : 1;
    const liquid = isLiquid(key), lava = key.includes('lava');
    let border = false;
    for (let e = 0; e < 4; e++) {
      const nk = this.keyAt(i + EDGE_DIRS[e][0], j + EDGE_DIRS[e][1]);
      if (!nk || familyOf(nk) === fam) continue;
      border = true;
      if (priorityOf(nk) > pa) {
        add(T.blendKey(familyOf(nk), e, v), GROUND_DEPTH + 0.1);
        if (liquid) add(T.foamKey(e, v, lava), GROUND_DEPTH + 0.2, lava ? 0xffffff : tint);
      }
    }
    // Corners: only when neither adjacent edge already blends that neighbour.
    for (let q = 0; q < 4; q++) {
      const [dx, dy] = CORNER_DIRS[q];
      const nk = this.keyAt(i + dx, j + dy);
      if (!nk || familyOf(nk) === fam || priorityOf(nk) <= pa) continue;
      const e1 = this.keyAt(i + dx, j), e2 = this.keyAt(i, j + dy);
      if ((e1 && familyOf(e1) === familyOf(nk)) || (e2 && familyOf(e2) === familyOf(nk))) continue;
      border = true;
      add(T.blendKey(familyOf(nk), 4 + q, v), GROUND_DEPTH + 0.1);
    }
    if (liquid) return out;
    const D = this.decals;
    const r0 = hash2(i * 3 + 1, j * 5 + 2), r1 = hash2(i * 7 + 3, j * 11 + 5);
    if (r0 < (border ? 0.55 : 0.15)) {
      let list: string[] | undefined;
      if (fam === 'w1_grass') list = r1 < 0.45 ? D.tuft : r1 < 0.7 ? D.flower : D.pebble;
      else if (fam === 'w1_forest_floor') list = r1 < 0.7 ? D.tuft : D.pebble;
      else if (fam === 'w1_dirt') list = D.pebble;
      else if (fam === 'w2_ash') list = r1 < 0.5 ? D.pebble : D.crack;
      else if (fam === 'w2_obsidian') list = D.crack;
      if (list) {
        const nn = border && r1 > 0.3 ? 2 : 1;
        for (let k = 0; k < nn; k++) {
          const ox = (hash2(i + k * 13, j + 17) - 0.5) * 70, oy = (hash2(i + 19, j + k * 23) - 0.5) * 30;
          const im = add(list[(hash2(i + k, j + 29) * list.length) | 0], GROUND_DEPTH + 0.3, tint, c.x + ox, c.y + oy, false);
          im.setOrigin(0.5, 0.85);
          if (hash2(i + 31, j + k) < 0.5) im.setFlipX(true);
        }
      }
    }
    return out;
  }

  private makeWall(i: number, j: number): Img {
    const c = cellCenterWorld(i, j);
    const y = c.y + ISO.TILE_H / 2;
    return this.scene.add.image(c.x, y, this.map.wallKey).setOrigin(0.5, 1).setScale(this.wallScale()).setDepth(y);
  }

  destroy(): void {
    for (const s of this.blotches.values()) s.destroy();
    this.blotches.clear();
    for (const s of this.shadows.values()) s.destroy();
    this.shadows.clear();
    for (const s of [...this.ground.values(), ...this.walls.values(), ...this.propSprites.values(), ...this.bGround.values(), ...this.bProps.values()]) s.destroy();
    for (const a of this.decor.values()) for (const o of a) o.destroy();
    this.decor.clear();
    this.bGround.clear(); this.bProps.clear();
    this.ground.clear(); this.walls.clear(); this.propSprites.clear(); this.fluids.clear(); this.visible.length = 0;
  }
}