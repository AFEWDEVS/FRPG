import Phaser from 'phaser';
import { BASE_W } from '../constants';
import { DISPLAY } from './theme';

const BW = 520, BH = 8, PW = 360, PH = 3;

/** Slim top-centre boss bar: name in the display face, health with a trailing chip, poise line beneath, taunt bubbles. */
export class BossBar {
  private c: Phaser.GameObjects.Container;
  private g: Phaser.GameObjects.Graphics;
  private name: Phaser.GameObjects.Text;
  private taunt: Phaser.GameObjects.Text;
  private frac = 1; private lag = 1; private poise = 1; private poiseMax = 0;
  active = false;
  private defeated = false;

  constructor(private scene: Phaser.Scene) {
    this.g = scene.add.graphics();
    this.name = scene.add.text(0, -4, '', { fontFamily: DISPLAY, fontSize: '21px', color: '#ecd29a', stroke: '#14080a', strokeThickness: 4 }).setOrigin(0.5, 1).setLetterSpacing(3);
    this.taunt = scene.add.text(0, 40, '', { fontFamily: DISPLAY, fontSize: '18px', color: '#f4ead2', fontStyle: 'italic', stroke: '#200808', strokeThickness: 4, align: 'center', wordWrap: { width: 620 } }).setOrigin(0.5, 0).setAlpha(0);
    this.c = scene.add.container(BASE_W / 2, 44, [this.g, this.name, this.taunt]).setDepth(300).setVisible(false);
  }

  engage(name: string): void {
    this.active = true; this.defeated = false;
    this.name.setText(name.toUpperCase());
    this.frac = this.lag = 1; this.poise = 1; this.poiseMax = 0;
    this.c.setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: this.c, alpha: 1, duration: 500 });
    this.draw();
  }

  setHp(hp: number, max: number): void { this.frac = Phaser.Math.Clamp(hp / Math.max(1, max), 0, 1); }
  setPoise(value: number, max: number): void { this.poiseMax = max; this.poise = Phaser.Math.Clamp(value / Math.max(1, max), 0, 1); }

  defeat(): void {
    if (!this.active) return;
    this.defeated = true;
    this.frac = 0;
    this.name.setText(`${this.name.text} — DERROTADO`);
    this.scene.tweens.add({ targets: this.c, alpha: 0, delay: 2200, duration: 800, onComplete: () => { this.c.setVisible(false); this.active = false; } });
  }

  say(text: string): void {
    this.c.setVisible(true);
    if (!this.active) this.c.setAlpha(1);
    this.taunt.setText(`"${text}"`).setAlpha(1);
    this.scene.tweens.killTweensOf(this.taunt);
    this.scene.tweens.add({ targets: this.taunt, alpha: 0, delay: 3200, duration: 700, onComplete: () => { if (!this.active) this.c.setVisible(false); } });
  }

  update(dtMs: number): void {
    if (!this.c.visible || !this.active) return;
    this.lag += (this.frac - this.lag) * Math.min(1, dtMs * 0.003);
    if (this.lag < this.frac) this.lag = this.frac;
    this.draw();
  }

  private draw(): void {
    const g = this.g.clear(), x = -BW / 2, y = 8, r = BH / 2;
    g.fillStyle(0x000000, 0.5).fillRoundedRect(x - 1, y - 1, BW + 2, BH + 2, r + 1);
    if (this.lag > this.frac) g.fillStyle(0xf0dcc0, 0.85).fillRoundedRect(x, y, Math.max(BH, BW * this.lag), BH, r);
    if (this.frac > 0.003) {
      const w = Math.max(BH, BW * this.frac);
      g.fillStyle(this.defeated ? 0x606060 : 0xa81818, 1).fillRoundedRect(x, y, w, BH, r);
      g.fillStyle(0xff7060, 0.45).fillRoundedRect(x + 1, y + 1, w - 2, BH * 0.38, r);
    }
    g.lineStyle(1, 0xc8a46a, 0.7).strokeRoundedRect(x - 0.5, y - 0.5, BW + 1, BH + 1, r + 1);
    // ornament: diamonds at both ends
    g.fillStyle(0xc8a46a, 0.95);
    for (const sx of [x - 10, -x + 10]) g.fillTriangle(sx, y + r - 5, sx + 5, y + r, sx, y + r + 5).fillTriangle(sx, y + r - 5, sx - 5, y + r, sx, y + r + 5);
    // poise
    if (this.poiseMax > 0) {
      const px = -PW / 2, py = y + BH + 6;
      g.fillStyle(0x000000, 0.4).fillRect(px, py, PW, PH);
      g.fillStyle(this.poise < 0.25 ? 0xffffff : 0xd8b860, 0.95).fillRect(px, py, PW * this.poise, PH);
    }
  }
}