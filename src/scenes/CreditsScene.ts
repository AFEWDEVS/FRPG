import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { BASE_H, BASE_W } from '../constants';
import { CREDITS, CREDITS_JOKE } from '../data/story';
import { coverBackground, textStyle } from '../ui/widgets';

/** Scrolling credits; any key / click speeds out. Returns to the main menu. */
export class CreditsScene extends Phaser.Scene {
  private roll!: Phaser.GameObjects.Container;
  private endY = 0;
  private leaving = false;
  private joked = false;

  constructor() { super('Credits'); }

  create(): void {
    this.leaving = false;
    this.joked = false;
    this.cameras.main.fadeIn(800);
    AudioManager.playMusic('ending');
    const bg = coverBackground(this, 'bg_title', BASE_W, BASE_H);
    this.tweens.add({ targets: bg, scale: bg.scale * 1.12, duration: 60000, ease: 'Sine.easeInOut' });
    this.add.rectangle(BASE_W / 2, 28, BASE_W, 56, 0x000000).setDepth(8);
    this.add.rectangle(BASE_W / 2, BASE_H - 28, BASE_W, 56, 0x000000).setDepth(8);
    this.add.rectangle(BASE_W / 2, BASE_H / 2, BASE_W, BASE_H, 0x000000, 0.72);
    if (this.textures.exists('vfx_heart')) {
      this.add.particles(0, BASE_H + 20, 'vfx_heart', {
        x: { min: 0, max: BASE_W }, lifespan: 7000, speedY: { min: -90, max: -40 }, scale: { start: 0.18, end: 0.04 },
        alpha: { start: 0.6, end: 0 }, frequency: 350, tint: [0xff4f78, 0xff94b0], blendMode: Phaser.BlendModes.ADD,
      });
    }
    this.roll = this.add.container(BASE_W / 2, BASE_H + 40);
    let y = 0;
    CREDITS.forEach((sec, n) => {
      const t = this.add.text(0, y, sec.title, textStyle(n === 0 ? 60 : 34, n === 0 ? '#d8503a' : '#d8b060')).setOrigin(0.5, 0);
      this.roll.add(t);
      y += t.height + 18;
      for (const l of sec.lines) {
        const lt = this.add.text(0, y, l, { ...textStyle(24, '#efe6cf'), wordWrap: { width: 900 }, align: 'center' }).setOrigin(0.5, 0);
        this.roll.add(lt);
        y += lt.height + 8;
      }
      y += 64;
    });
    this.endY = -y - 80;
    this.add.text(BASE_W / 2, BASE_H - 26, 'Clic o Esc para volver', textStyle(16, '#8a7a5a')).setOrigin(0.5).setDepth(5);
    this.input.on('pointerdown', () => this.leave());
    this.input.keyboard?.on('keydown-ESC', () => this.leave());
    this.input.keyboard?.on('keydown-SPACE', () => this.leave());
  }

  update(_t: number, dt: number): void {
    if (this.joked) return;
    this.roll.y -= (dt / 1000) * 52;
    if (this.roll.y < this.endY) this.joke();
  }

  private joke(): void {
    this.joked = true;
    const t = this.add.text(BASE_W / 2, BASE_H / 2, CREDITS_JOKE, { ...textStyle(30, '#ffe0b0'), align: 'center', wordWrap: { width: 900 }, lineSpacing: 10, stroke: '#140a04', strokeThickness: 5 }).setOrigin(0.5).setDepth(10).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 1800 });
    this.time.delayedCall(7500, () => this.leave());
  }

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(700);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MainMenu'));
  }
}