import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { BASE_H, BASE_W } from '../constants';
import { GameState } from '../core/GameState';
import { ENDING_LINES, ENDING_UI } from '../data/story';
import { fmt, speakerOf } from '../dialogue/DialogueManager';
import { typewriter, type Typer } from '../dialogue/typewriter';
import { coverBackground, textStyle } from '../ui/widgets';

/** Romantic comic finale: bg_ending, fireworks and hearts, a talk with Amaranta, then the credits. */
export class EndingScene extends Phaser.Scene {
  private idx = 0;
  private typer?: Typer;
  private box!: Phaser.GameObjects.Container;
  private portrait!: Phaser.GameObjects.Image;
  private nameTxt!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.Text;
  private finished = false;
  private leaving = false;

  constructor() { super('Ending'); }

  create(): void {
    this.idx = 0;
    this.finished = false;
    this.leaving = false;
    GameState.flags.gameCompleted = true;
    GameState.flags.endingSeen = true;
    GameState.save();
    this.cameras.main.fadeIn(1200, 255, 255, 255);
    AudioManager.playMusic('ending');
    coverBackground(this, 'bg_ending', BASE_W, BASE_H);
    this.add.rectangle(BASE_W / 2, BASE_H / 2, BASE_W, BASE_H, 0x10040c, 0.18);
    this.celebrate();

    this.box = this.add.container(0, 0).setDepth(10);
    const panel = this.add.rectangle(BASE_W / 2, 600, 1120, 190, 0x120c0a, 0.92).setStrokeStyle(4, 0x6a5a40);
    this.portrait = this.add.image(190, 600, 'portrait_amaranta').setDisplaySize(160, 160);
    this.nameTxt = this.add.text(300, 523, '', textStyle(24, '#ffb0c8')).setOrigin(0, 0.5);
    this.body = this.add.text(300, 550, '', { ...textStyle(23, '#f0e6cc'), wordWrap: { width: 800 }, lineSpacing: 6, strokeThickness: 2 });
    const hint = this.add.text(BASE_W - 100, 676, '▼', textStyle(22, '#d8b060')).setOrigin(0.5);
    this.tweens.add({ targets: hint, y: 684, duration: 500, yoyo: true, repeat: -1 });
    this.box.add([panel, this.portrait, this.nameTxt, this.body, hint]);

    this.input.on('pointerdown', () => this.advance());
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.keyboard?.on('keydown-ESC', () => this.toCredits());
    this.time.delayedCall(1400, () => this.showLine());
  }

  private celebrate(): void {
    if (this.textures.exists('vfx_heart')) {
      this.add.particles(0, BASE_H + 30, 'vfx_heart', {
        x: { min: 0, max: BASE_W }, lifespan: 6000, speedY: { min: -120, max: -60 }, speedX: { min: -25, max: 25 },
        scale: { start: 0.22, end: 0.05 }, alpha: { start: 0.9, end: 0 }, frequency: 240,
        tint: [0xff4f78, 0xff94b0, 0xffd0dc, 0xffffff], blendMode: Phaser.BlendModes.ADD,
      }).setDepth(5);
    }
    this.time.addEvent({
      delay: 650, loop: true,
      callback: () => {
        const x = Phaser.Math.Between(120, BASE_W - 120), y = Phaser.Math.Between(70, 330);
        const keys = ['vfx_spark', 'vfx_star', 'vfx_heart'].filter((k) => this.textures.exists(k));
        if (!keys.length) return;
        const key = Phaser.Utils.Array.GetRandom(keys);
        const tint = Phaser.Utils.Array.GetRandom([0xff5577, 0xffd24a, 0x7fd6ff, 0xc89bff, 0xffffff]);
        const em = this.add.particles(x, y, key, {
          emitting: false, lifespan: 1100, speed: { min: 90, max: 260 }, scale: { start: 0.45, end: 0 }, alpha: { start: 1, end: 0 },
          gravityY: 120, tint, blendMode: Phaser.BlendModes.ADD,
        }).setDepth(4);
        em.explode(Phaser.Math.Between(28, 48));
        AudioManager.sfx('fire_explosion', { volume: 0.18, pitchVar: 300 });
        this.time.delayedCall(1400, () => em.destroy());
      },
    });
  }

  private showLine(): void {
    const l = ENDING_LINES[this.idx];
    const sp = speakerOf(l.who);
    this.nameTxt.setText(sp.name);
    if (this.textures.exists(sp.portrait)) this.portrait.setTexture(sp.portrait).setDisplaySize(160, 160);
    if (l.who === 'amaranta') AudioManager.sfx('heart_sparkle', { volume: 0.5 });
    this.typer = typewriter(this, this.body, fmt(l.text), 24);
  }

  private advance(): void {
    if (this.finished || !this.typer) return;
    if (!this.typer.done) { this.typer.complete(); return; }
    this.idx++;
    if (this.idx >= ENDING_LINES.length) this.showFin();
    else this.showLine();
  }

  private showFin(): void {
    this.finished = true;
    this.box.destroy();
    const fin = this.add.text(BASE_W / 2, 250, ENDING_UI.title, textStyle(120, '#ffb0c8')).setOrigin(0.5).setDepth(20).setAlpha(0);
    const sub = this.add.text(BASE_W / 2, 360, ENDING_UI.subtitle, { ...textStyle(26, '#fff2e0'), wordWrap: { width: 900 }, align: 'center' })
      .setOrigin(0.5, 0).setDepth(20).setAlpha(0);
    this.tweens.add({ targets: fin, alpha: 1, scale: { from: 0.6, to: 1 }, duration: 1400, ease: 'Back.easeOut' });
    this.tweens.add({ targets: sub, alpha: 1, duration: 1800, delay: 900 });
    AudioManager.sfx('quest_complete');
    this.time.delayedCall(7000, () => this.toCredits());
    this.input.once('pointerdown', () => this.time.delayedCall(2500, () => this.toCredits()));
  }

  private toCredits(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.typer?.stop();
    this.cameras.main.fadeOut(900);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Credits'));
  }
}