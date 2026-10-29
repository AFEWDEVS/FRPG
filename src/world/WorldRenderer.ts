import Phaser from 'phaser';
import { ISO, PROP_SCALE } from '../constants';
import { cellCenterWorld, GROUND_DEPTH, gridToWorld, worldToGrid } from '../iso/iso';
import { NO_TILE, type PropInst, type TileMap } from './TileMap';

type Img = Phaser.GameObjects.Image;

/** Wind sway amplitude (radians) per prop key. Bottom-origin rotation so the roots stay planted. */
const SWAY: Record<string, number> = {
  tree_oak_1: 0.016, tree_oak_2: 0.016, tree_pine: 0.012, bush: 0.035, flowers: 0.06, mushrooms: 0.015, dead_tree: 0.008, banner: 0.05,
};

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

  constructor(private scene: Phaser.Scene, private map: TileMap) {
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

  spriteFor(p: PropInst): Img | undefined { return this.propSprites.get(p); }

  update(cam: Phaser.Cameras.Scene2D.Camera, focus?: { x: number; y: number }): void {
    this.focus = focus;
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
    const i0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.gx))));
    const i1 = Math.min(m.width - 1, Math.ceil(Math.max(...corners.map((c) => c.gx))));
    const j0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.gy))));
    const j1 = Math.min(m.height - 1, Math.ceil(Math.max(...corners.map((c) => c.gy))));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const cx = (i - j) * (ISO.TILE_W / 2), cy = (i + j + 1) * (ISO.TILE_H / 2);
        if (cx < rl || cx > rr || cy < rt || cy > rb) continue;
        const n = m.idx(i, j);
        if (m.wall[n]) this.show(this.walls, n, () => this.makeWall(i, j));
        else if (m.ground[n] !== NO_TILE) this.show(this.ground, n, () => this.makeGround(i, j, n));
        const props = this.propsByCell.get(n);
        if (props) for (const p of props) this.showProp(p);
      }
    }
    this.animate(this.scene.time.now);
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
      const a = WorldRenderer.propAnchor(p);
      s = this.scene.add.image(a.x, a.y, p.key).setOrigin(0.5, 1).setScale(ISO.ART_SCALE * (PROP_SCALE[p.key] ?? 1) * (p.scale ?? 1)).setDepth(a.y);
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
    const amp = SWAY[p.key];
    if (amp) this.visSway.push({ s, p, amp });
  }

  private makeGround(i: number, j: number, n: number): Img {
    const c = cellCenterWorld(i, j);
    const key = this.map.groundKeys[this.map.ground[n]];
    const img = this.scene.add.image(c.x, c.y, key).setDisplaySize(ISO.TILE_W + 2, ISO.TILE_H + 1).setDepth(GROUND_DEPTH);
    const shade = 225 + ((i * 7 + j * 13) % 5) * 7;
    img.setTint(Phaser.Display.Color.GetColor(shade, shade, shade));
    if (key.includes('water') || key.includes('lava')) this.fluids.set(img, { img, i, j, y0: c.y, lava: key.includes('lava') });
    return img;
  }

  private makeWall(i: number, j: number): Img {
    const c = cellCenterWorld(i, j);
    const y = c.y + ISO.TILE_H / 2;
    return this.scene.add.image(c.x, y, this.map.wallKey).setOrigin(0.5, 1).setScale(ISO.ART_SCALE).setDepth(y);
  }

  destroy(): void {
    for (const s of [...this.ground.values(), ...this.walls.values(), ...this.propSprites.values()]) s.destroy();
    this.ground.clear(); this.walls.clear(); this.propSprites.clear(); this.fluids.clear(); this.visible.length = 0;
  }
}