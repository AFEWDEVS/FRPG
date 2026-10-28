import Phaser from 'phaser';
import { BASE_W } from '../constants';
import { FONT } from './widgets';

const BW = 560, BH = 18;

/** Top-centre boss health bar with name, lagging damage trail and taunt bubbles. */
export class BossBar {
  private c: Phaser.GameObjects.Container;
  private g: Phaser.GameObjects.Graphics;
  private name: Phaser.GameObjects.Text;
  private taunt: Phaser.GameObjects.Text;
  private hp = 1; private max = 1; private lag = 1; private frac = 1;
  active = false;
  private defeated = false;

  constructor(private scene: Phaser.Scene) {
    this.g = scene.add.graphics();
    this.name = scene.add.text(0, -8, '', { fontFamily: FONT, fontSize: '24px', color: '#e8c070', stroke: '#1a0408', strokeThickness: 5 }).setOrigin(0.5, 1);
    this.taunt = scene.add.text(0, 40, '', { fontFamily: FONT, fontSize: '20px', color: '#ffffff', fontStyle: 'italic', stroke: '#300808', strokeThickness: 5, align: 'center', wordWrap: { width: 620 } }).setOrigin(0.5, 0).setAlpha(0);
    this.c = scene.add.container(BASE_W / 2, 84, [this.g, this.name, this.taunt]).setDepth(300).setVisible(false);
  }

  engage(name: string): void {
    this.active = true; this.defeated = false;
    this.name.setText(name);
    this.hp = this.max = this.lag = this.frac = 1;
    this.c.setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: this.c, alpha: 1, duration: 500 });
    this.draw();
  }

  setHp(hp: number, max: number): void { this.hp = hp; this.max = max; this.frac = Phaser.Math.Clamp(hp / Math.max(1, max), 0, 1); }

  defeat(): void {
    if (!this.active) return;
    this.defeated = true;
    this.frac = 0;
    this.name.setText(`${this.name.text} - ¡Derrotado!`);
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
    const g = this.g.clear(), x = -BW / 2;
    g.fillStyle(0x000000, 0.55).fillRect(x - 10, -4, BW + 20, BH + 8);
    g.fillStyle(0x1a0606, 1).fillRect(x, 0, BW, BH);
    g.fillStyle(0xe8c8a0, 0.85).fillRect(x, 0, BW * this.lag, BH);
    g.fillStyle(this.defeated ? 0x505050 : 0xb01818, 1).fillRect(x, 0, BW * this.frac, BH);
    g.fillStyle(0xff6050, 0.5).fillRect(x, 0, BW * this.frac, BH / 3);
    g.lineStyle(3, 0x8a7048, 1).strokeRect(x - 1, -1, BW + 2, BH + 2);
    g.lineStyle(1, 0x2a1e12, 1).strokeRect(x - 5, -5, BW + 10, BH + 10);
    // ornaments
    for (const sx of [x - 12, -x + 12]) {
      g.fillStyle(0xa88a58, 1).fillTriangle(sx, BH / 2 - 11, sx + 9, BH / 2, sx, BH / 2 + 11).fillTriangle(sx, BH / 2 - 11, sx - 9, BH / 2, sx, BH / 2 + 11);
      g.fillStyle(0x7a1010, 1).fillCircle(sx, BH / 2, 4);
    }
  }
}