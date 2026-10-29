import Phaser from 'phaser';
import { BASE_W } from '../constants';
import { FONT } from './widgets';

/** Short stacked messages ('ui:toast'). */
export class Toasts {
  private items: Phaser.GameObjects.Text[] = [];
  constructor(private scene: Phaser.Scene) {}

  push(text: string, color = '#f0e0b0'): void {
    const t = this.scene.add.text(BASE_W / 2, 150, text, {
      fontFamily: FONT, fontSize: '17px', color, stroke: '#000000', strokeThickness: 3, backgroundColor: '#0b0807b8', padding: { x: 14, y: 5 }, align: 'center',
    }).setOrigin(0.5).setDepth(800).setAlpha(0);
    this.items.unshift(t);
    if (this.items.length > 5) this.items.pop()?.destroy();
    this.layout();
    this.scene.tweens.add({ targets: t, alpha: 1, duration: 150 });
    this.scene.tweens.add({
      targets: t, alpha: 0, delay: 2600, duration: 600,
      onComplete: () => { this.items = this.items.filter((i) => i !== t); t.destroy(); this.layout(); },
    });
  }

  private layout(): void {
    this.items.forEach((t, i) => t.setY(150 + i * 32));
  }
}