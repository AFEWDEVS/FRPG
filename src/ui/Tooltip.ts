import Phaser from 'phaser';
import { BASE_H, BASE_W } from '../constants';
import type { TipLine } from '../items/format';
import { FONT } from './widgets';

/** Single shared tooltip box (D2 style: dark translucent box, coloured lines). */
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
    let y = 6, w = 0;
    this.pool.forEach((t) => t.setVisible(false));
    lines.forEach((l, i) => {
      let t = this.pool[i];
      if (!t) { t = this.scene.add.text(0, 0, '', {}); this.c.add(t); this.pool[i] = t; }
      t.setStyle({
        fontFamily: FONT, fontSize: `${l.size ?? 14}px`, color: l.color ?? '#e8d9a0', stroke: '#000', strokeThickness: 2,
        fontStyle: l.italic ? 'italic' : 'normal', wordWrap: { width: 300 }, align: 'center',
      });
      t.setText(l.text).setOrigin(0.5, 0).setVisible(true);
      t.setPosition(0, y);
      y += t.height + 3;
      w = Math.max(w, t.width);
    });
    const bw = w + 24, bh = y + 8;
    this.pool.slice(0, lines.length).forEach((t) => t.setX(bw / 2));
    this.bg.clear().fillStyle(0x07050a, 0.94).fillRect(0, 0, bw, bh).lineStyle(2, 0x6a5a40, 1).strokeRect(1, 1, bw - 2, bh - 2);
    let x = px + 18, ty = py + 14;
    if (x + bw > BASE_W - 4) x = px - bw - 14;
    if (ty + bh > BASE_H - 4) ty = BASE_H - bh - 4;
    if (x < 4) x = 4;
    if (ty < 4) ty = 4;
    this.c.setPosition(x, ty).setVisible(true);
  }

  hide(): void { this.c.setVisible(false); }
}