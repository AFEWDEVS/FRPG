import Phaser from 'phaser';
import { BASE_H, BASE_W } from '../constants';
import { NO_TILE, type TileMap } from '../world/TileMap';

export interface GameLike { map?: TileMap; player?: { gx: number; gy: number } }

const MARK_COLOR: Record<string, number> = {
  stairs_down: 0xffd24a, stairs_up: 0xffd24a, portal: 0x60e0ff, waypoint: 0x60e0ff, dungeon_entrance: 0xc070ff,
};

/** D2-style automap: tracks explored cells of the current TileMap and draws them isometrically. */
export class AutoMap {
  private map: TileMap | null = null;
  private explored = new Uint8Array(0);
  private list: number[] = [];
  private lastCell = -1;
  private gOverlay: Phaser.GameObjects.Graphics;
  private gPanel: Phaser.GameObjects.Graphics;
  overlayOn = false;
  private acc = 0;

  constructor(scene: Phaser.Scene) {
    this.gOverlay = scene.add.graphics().setDepth(40).setVisible(false);
    this.gPanel = scene.add.graphics().setDepth(110).setVisible(false);
  }

  /** Reveal cells around the hero; call every frame. */
  track(game: GameLike | undefined): boolean {
    if (!game?.map || !game.player) return false;
    const m = game.map;
    if (m !== this.map) {
      this.map = m;
      this.explored = new Uint8Array(m.width * m.height);
      this.list = [];
      this.lastCell = -1;
    }
    const pi = Math.floor(game.player.gx), pj = Math.floor(game.player.gy);
    const cell = pj * m.width + pi;
    if (cell === this.lastCell) return false;
    this.lastCell = cell;
    const R = 11;
    for (let j = pj - R; j <= pj + R; j++) for (let i = pi - R; i <= pi + R; i++) {
      if (!m.inBounds(i, j) || (i - pi) ** 2 + (j - pj) ** 2 > R * R) continue;
      const n = j * m.width + i;
      if (this.explored[n]) continue;
      if (m.ground[n] === NO_TILE && !m.wall[n]) continue;
      this.explored[n] = 1;
      this.list.push(n);
    }
    return true;
  }

  private cellColor(m: TileMap, i: number, j: number, n: number): [number, number] {
    if (m.wall[n]) return [0xc8b078, 0.85];
    if (m.isWalkable(i, j)) return [0x7a8ab0, 0.4];
    return [0x3a5a3a, 0.45];
  }

  private diamond(g: Phaser.GameObjects.Graphics, x: number, y: number, u: number): void {
    g.fillTriangle(x, y - u / 2, x + u, y, x, y + u / 2).fillTriangle(x, y - u / 2, x - u, y, x, y + u / 2);
  }

  update(dtMs: number, game: GameLike | undefined): boolean {
    const moved = this.track(game);
    this.acc += dtMs;
    if (this.overlayOn && (moved || this.acc > 90)) { this.acc = 0; this.drawOverlay(game); }
    return moved;
  }

  setOverlay(on: boolean): void {
    this.overlayOn = on;
    this.gOverlay.setVisible(on);
    if (!on) this.gOverlay.clear();
  }

  private drawOverlay(game: GameLike | undefined): void {
    const g = this.gOverlay.clear();
    const m = this.map;
    if (!m || !game?.player) return;
    const u = 6, cx = BASE_W / 2, cy = BASE_H / 2 - 40;
    const px = game.player.gx, py = game.player.gy;
    for (const n of this.list) {
      const i = n % m.width, j = (n / m.width) | 0;
      const x = cx + ((i + 0.5 - px) - (j + 0.5 - py)) * u;
      const y = cy + ((i + 0.5 - px) + (j + 0.5 - py)) * u / 2;
      if (x < -20 || x > BASE_W + 20 || y < -20 || y > BASE_H + 20) continue;
      const [c, a] = this.cellColor(m, i, j, n);
      g.fillStyle(c, a);
      this.diamond(g, x, y, u);
    }
    this.markers(g, m, (i, j) => ({ x: cx + ((i + 0.5 - px) - (j + 0.5 - py)) * u, y: cy + ((i + 0.5 - px) + (j + 0.5 - py)) * u / 2 }), 4);
    g.fillStyle(0xffffff, 1);
    this.diamond(g, cx, cy, 6);
  }

  private markers(g: Phaser.GameObjects.Graphics, m: TileMap, proj: (i: number, j: number) => { x: number; y: number }, r: number): void {
    for (const mk of m.markers) {
      const c = MARK_COLOR[mk.type];
      if (c === undefined || !this.explored[mk.gy * m.width + mk.gx]) continue;
      const p = proj(mk.gx, mk.gy);
      g.fillStyle(c, 1).fillCircle(p.x, p.y, r).lineStyle(1, 0x000000, 0.8).strokeCircle(p.x, p.y, r);
    }
  }

  /** Whole explored level fitted into the rect (screen coords). */
  drawPanel(game: GameLike | undefined, rx: number, ry: number, rw: number, rh: number): void {
    const g = this.gPanel.clear().setVisible(true);
    const m = this.map;
    if (!m || !this.list.length) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of this.list) {
      const i = n % m.width, j = (n / m.width) | 0;
      const x = i - j, y = i + j;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const spanX = maxX - minX + 2, spanY = (maxY - minY + 2) / 2;
    const u = Math.max(1.5, Math.min(rw / spanX, rh / spanY, 12));
    const ox = rx + rw / 2 - ((minX + maxX) / 2) * u, oy = ry + rh / 2 - ((minY + maxY) / 2) * u / 2;
    const proj = (i: number, j: number) => ({ x: ox + (i - j) * u, y: oy + (i + j) * u / 2 });
    for (const n of this.list) {
      const i = n % m.width, j = (n / m.width) | 0;
      const p = proj(i + 0.5, j + 0.5);
      const [c, a] = this.cellColor(m, i, j, n);
      g.fillStyle(c, Math.min(1, a + 0.2));
      this.diamond(g, p.x, p.y, u);
    }
    this.markers(g, m, (i, j) => proj(i + 0.5, j + 0.5), Math.max(3, u * 0.6));
    if (game?.player) {
      const p = proj(game.player.gx, game.player.gy);
      g.fillStyle(0xffffff, 1);
      this.diamond(g, p.x, p.y, Math.max(3, u * 0.9));
    }
  }

  hidePanel(): void { this.gPanel.clear().setVisible(false); }
}