import Phaser from 'phaser';
import { BASE_H, BASE_W } from '../constants';
import type { TipLine } from '../items/format';
import { DISPLAY } from './theme';

/** Single shared tooltip: dark vellum, rarity-coloured title + hairline border, divider under the title. */
export class Tooltip {
  private c: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private pool: Phaser.GameObjects.Text[] = [];

  constructor(private scene: Phaser.Scene) {
    this.bg = scene.add.graphics();
    this.c = scene.add.container(0, 0, [this.bg]).setDepth(50000).setVisible(false);
  }

  get visible(): boolean { return this.c.visible; }

  show(lines: TipLine[], px: number, py: number): void {
    if (!lines.length) { this.hide(); return; }
    let y = 9, w = 0, divY = -1;
    this.pool.forEach((t) => t.setVisible(false));
    lines.forEach((l, i) => {
      let t = this.pool[i];
      if (!t) { t = this.scene.add.text(0, 0, '', {}); this.c.add(t); this.pool[i] = t; }
      const title = i === 0 && lines.length > 1;
      t.setStyle({
        fontFamily: title ? DISPLAY : 'Georgia, serif', fontSize: `${l.size ?? 14}px`, color: l.color ?? '#e8d9a0', stroke: '#000', strokeThickness: 2,
        fontStyle: l.italic ? 'italic' : 'normal', wordWrap: { width: 300 }, align: 'center',
      });
      t.setText(l.text).setOrigin(0.5, 0).setVisible(true).setPosition(0, y);
      y += t.height + 3;
      w = Math.max(w, t.width);
      if (title) { divY = y + 3; y += 9; }
    });
    const bw = Math.max(110, w + 32), bh = y + 8;
    this.pool.slice(0, lines.length).forEach((t) => t.setX(bw / 2));
    const edge = Phaser.Display.Color.HexStringToColor(lines[0].color ?? '#9a7e50').color;
    this.bg.clear().fillStyle(0x000000, 0.35).fillRoundedRect(1, 3, bw, bh, 8)
      .fillStyle(0x0b0807, 0.95).fillRoundedRect(0, 0, bw, bh, 7)
      .lineStyle(1.5, edge, 0.75).strokeRoundedRect(0.75, 0.75, bw - 1.5, bh - 1.5, 7);
    if (divY > 0) {
      this.bg.fillGradientStyle(edge, edge, edge, edge, 0, 0.8, 0, 0.8).fillRect(14, divY, bw / 2 - 20, 1)
        .fillGradientStyle(edge, edge, edge, edge, 0.8, 0, 0.8, 0).fillRect(bw / 2 + 6, divY, bw / 2 - 20, 1)
        .fillStyle(edge, 0.9).fillTriangle(bw / 2, divY - 3, bw / 2 + 4, divY + 0.5, bw / 2, divY + 4).fillTriangle(bw / 2, divY - 3, bw / 2 - 4, divY + 0.5, bw / 2, divY + 4);
    }
    let x = px + 18, ty = py + 14;
    if (x + bw > BASE_W - 4) x = px - bw - 14;
    if (ty + bh > BASE_H - 4) ty = BASE_H - bh - 4;
    if (x < 4) x = 4;
    if (ty < 4) ty = 4;
    this.c.setPosition(x, ty).setVisible(true);
  }

  hide(): void { this.c.setVisible(false); }
}