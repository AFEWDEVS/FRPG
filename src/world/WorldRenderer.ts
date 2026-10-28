import Phaser from 'phaser';
import { ISO } from '../constants';
import { cellCenterWorld, GROUND_DEPTH, gridToWorld, worldToGrid } from '../iso/iso';
import { NO_TILE, type PropInst, type TileMap } from './TileMap';

type Img = Phaser.GameObjects.Image;

/** Draws a TileMap lazily, creating sprites only for cells near the camera and hiding the rest. */
export class WorldRenderer {
  private ground = new Map<number, Img>();
  private walls = new Map<number, Img>();
  private propSprites = new Map<PropInst, Img>();
  private propsByCell = new Map<number, PropInst[]>();
  private visible: Img[] = [];

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

  update(cam: Phaser.Cameras.Scene2D.Camera): void {
    for (const s of this.visible) s.setVisible(false);
    this.visible.length = 0;
    const v = cam.worldView;
    const pad = 220;
    const corners = [
      worldToGrid(v.x - pad, v.y - pad), worldToGrid(v.right + pad, v.y - pad),
      worldToGrid(v.x - pad, v.bottom + pad + 200), worldToGrid(v.right + pad, v.bottom + pad + 200),
    ];
    const m = this.map;
    const i0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.gx))));
    const i1 = Math.min(m.width - 1, Math.ceil(Math.max(...corners.map((c) => c.gx))));
    const j0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.gy))));
    const j1 = Math.min(m.height - 1, Math.ceil(Math.max(...corners.map((c) => c.gy))));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const n = m.idx(i, j);
        if (m.wall[n]) this.show(this.walls, n, () => this.makeWall(i, j));
        else if (m.ground[n] !== NO_TILE) this.show(this.ground, n, () => this.makeGround(i, j, n));
        const props = this.propsByCell.get(n);
        if (props) for (const p of props) this.showProp(p);
      }
    }
  }

  private show(store: Map<number, Img>, n: number, make: () => Img): void {
    let s = store.get(n);
    if (!s) { s = make(); store.set(n, s); }
    s.setVisible(true);
    this.visible.push(s);
  }

  private showProp(p: PropInst): void {
    let s = this.propSprites.get(p);
    if (!s) {
      const a = WorldRenderer.propAnchor(p);
      s = this.scene.add.image(a.x, a.y, p.key).setOrigin(0.5, 1).setScale(ISO.ART_SCALE * (p.scale ?? 1)).setDepth(a.y);
      if (p.flipX) s.setFlipX(true);
      if (p.tint !== undefined) s.setTint(p.tint);
      this.propSprites.set(p, s);
    }
    s.setVisible(true);
    this.visible.push(s);
  }

  private makeGround(i: number, j: number, n: number): Img {
    const c = cellCenterWorld(i, j);
    const key = this.map.groundKeys[this.map.ground[n]];
    const img = this.scene.add.image(c.x, c.y, key).setDisplaySize(ISO.TILE_W + 2, ISO.TILE_H + 1).setDepth(GROUND_DEPTH);
    const shade = 225 + ((i * 7 + j * 13) % 5) * 7;
    img.setTint(Phaser.Display.Color.GetColor(shade, shade, shade));
    return img;
  }

  private makeWall(i: number, j: number): Img {
    const c = cellCenterWorld(i, j);
    const y = c.y + ISO.TILE_H / 2;
    return this.scene.add.image(c.x, y, this.map.wallKey).setOrigin(0.5, 1).setScale(ISO.ART_SCALE).setDepth(y);
  }

  destroy(): void {
    for (const s of [...this.ground.values(), ...this.walls.values(), ...this.propSprites.values()]) s.destroy();
    this.ground.clear(); this.walls.clear(); this.propSprites.clear(); this.visible.length = 0;
  }
}