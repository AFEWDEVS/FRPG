import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { BASE_H, BASE_W } from '../constants';
import { GameState } from '../core/GameState';
import { INTRO_PANELS, INTRO_UI } from '../data/story';
import { typewriter, type Typer } from '../dialogue/typewriter';
import { coverBackground, textStyle } from '../ui/widgets';

/** Storybook intro shown after CharacterCreate: parchment panels, typewriter text, click / Esc to skip. */
export class IntroScene extends Phaser.Scene {
  private idx = 0;
  private typer?: Typer;
  private bg?: Phaser.GameObjects.Image;
  private text!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private leaving = false;
  private nextData: object = { areaId: 'town', entry: 'start' };

  constructor() { super('Intro'); }

  init(data?: object): void {
    this.nextData = data && Object.keys(data).length ? data : { areaId: 'town', entry: 'start' };
    this.idx = 0;
    this.leaving = false;
  }

  create(): void {
    this.cameras.main.fadeIn(600);
    AudioManager.playMusic('title');
    this.add.rectangle(BASE_W / 2, BASE_H / 2, BASE_W, BASE_H, 0x000000);
    const parchment = this.add.image(BASE_W / 2, 520, 'ui_parchment').setDisplaySize(1020, 330);
    parchment.setDepth(5);
    this.text = this.add.text(BASE_W / 2, 500, '', {
      fontFamily: 'Georgia, serif', fontSize: '27px', color: '#2a1a0a', align: 'center', wordWrap: { width: 880 }, lineSpacing: 8,
    }).setOrigin(0.5).setDepth(6);
    this.hint = this.add.text(BASE_W / 2, 668, INTRO_UI.skip, textStyle(17, '#8a7a5a')).setOrigin(0.5).setDepth(6);
    this.tweens.add({ targets: this.hint, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 });

    this.input.on('pointerdown', () => this.advance());
    this.input.keyboard?.on('keydown-ESC', () => this.finish());
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.showPanel();
  }

  private showPanel(): void {
    const p = INTRO_PANELS[this.idx];
    const old = this.bg;
    const img = coverBackground(this, p.bg, BASE_W, BASE_H).setAlpha(0).setDepth(1);
    img.setScale(img.scale * 1.05);
    this.bg = img;
    this.tweens.add({ targets: img, alpha: 0.85, duration: 700 });
    this.tweens.add({ targets: img, scale: img.scale * 1.08, duration: 9000, ease: 'Sine.easeOut' });
    if (old) this.tweens.add({ targets: old, alpha: 0, duration: 700, onComplete: () => old.destroy() });
    const full = p.text.replace(/\{hero\}/g, GameState.profile?.name ?? 'Héroe');
    this.typer = typewriter(this, this.text, full, 22);
  }

  private advance(): void {
    if (this.leaving) return;
    if (this.typer && !this.typer.done) { this.typer.complete(); return; }
    AudioManager.sfx('ui_click', { volume: 0.5 });
    this.idx++;
    if (this.idx >= INTRO_PANELS.length) this.finish();
    else this.showPanel();
  }

  private finish(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.typer?.stop();
    this.cameras.main.fadeOut(500);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', this.nextData));
  }
}