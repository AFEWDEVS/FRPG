import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { BASE_H, BASE_W } from '../constants';
import { GameState } from '../core/GameState';
import { INTRO_PANELS, INTRO_UI } from '../data/story';
import { RichText } from '../ui/RichText';
import { coverBackground, textStyle } from '../ui/widgets';

const BAR = 74;
/** panel index -> music cue */
const MUSIC = ['title', 'title', 'dungeon2', 'dungeon2', 'town'];

/** Cinematic intro: Ken Burns backgrounds, letterbox bars, rich typewriter text, click / Esc to skip. */
export class IntroScene extends Phaser.Scene {
  private idx = 0;
  private bg?: Phaser.GameObjects.Image;
  private rich?: RichText;
  private revealed = 0;
  private acc = 0;
  private t = 0;
  private hint!: Phaser.GameObjects.Text;
  private band!: Phaser.GameObjects.Graphics;
  private leaving = false;
  private nextData: object = { areaId: 'town', entry: 'start' };

  constructor() { super('Intro'); }

  init(data?: object): void {
    this.nextData = data && Object.keys(data).length ? data : { areaId: 'town', entry: 'start' };
    this.idx = 0;
    this.leaving = false;
    this.rich = undefined;
    this.bg = undefined;
  }

  create(): void {
    this.cameras.main.fadeIn(900);
    this.add.rectangle(BASE_W / 2, BASE_H / 2, BASE_W, BASE_H, 0x000000);
    // darkening band for the text + vignette
    this.band = this.add.graphics().setDepth(4);
    for (let i = 0; i < 24; i++) this.band.fillStyle(0x000000, (i / 24) * 0.78).fillRect(0, 380 + i * 12, BASE_W, 13);
    this.band.fillStyle(0x000000, 0.78).fillRect(0, 668, BASE_W, 60);
    const vg = this.add.graphics().setDepth(4);
    for (let i = 0; i < 8; i++) vg.lineStyle(40, 0x000000, 0.06 + i * 0.01).strokeRect(-20 + i * 14, -20 + i * 14, BASE_W + 40 - i * 28, BASE_H + 40 - i * 28);
    // letterbox bars slide in
    const top = this.add.rectangle(BASE_W / 2, -BAR / 2, BASE_W, BAR, 0x000000).setDepth(10);
    const bot = this.add.rectangle(BASE_W / 2, BASE_H + BAR / 2, BASE_W, BAR, 0x000000).setDepth(10);
    this.tweens.add({ targets: top, y: BAR / 2, duration: 900, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: bot, y: BASE_H - BAR / 2, duration: 900, ease: 'Cubic.easeOut' });
    this.hint = this.add.text(BASE_W / 2, BASE_H - BAR / 2, INTRO_UI.skip, textStyle(16, '#a89a78')).setOrigin(0.5).setDepth(11);
    this.tweens.add({ targets: this.hint, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 });

    this.input.on('pointerdown', () => this.advance());
    this.input.keyboard?.on('keydown-ESC', () => this.finish());
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.showPanel();
  }

  private showPanel(): void {
    const p = INTRO_PANELS[this.idx];
    AudioManager.playMusic(MUSIC[this.idx] ?? 'title', 1600);
    const old = this.bg;
    const img = coverBackground(this, p.bg, BASE_W, BASE_H).setAlpha(0).setDepth(1);
    const base = img.scale;
    img.setScale(base * p.from.z).setPosition(BASE_W / 2 + p.from.x, BASE_H / 2 + p.from.y);
    if (p.tint) img.setTint(p.tint);
    this.bg = img;
    this.tweens.add({ targets: img, alpha: 1, duration: 800 });
    this.tweens.add({ targets: img, scale: base * p.to.z, x: BASE_W / 2 + p.to.x, y: BASE_H / 2 + p.to.y, duration: 11000, ease: 'Sine.easeInOut' });
    if (old) this.tweens.add({ targets: old, alpha: 0, duration: 800, onComplete: () => old.destroy() });
    this.rich?.destroy();
    const name = GameState.profile?.name ?? 'Héroe';
    this.rich = new RichText(this, (BASE_W - 940) / 2, 470, { size: 27, color: '#f6ecd0', width: 940, align: 'center', stroke: '#140a04', strokeW: 5, lineSpacing: 10 }, true);
    this.rich.set(p.text.replace(/\{hero\}/g, name));
    this.rich.c.setDepth(6);
    this.revealed = 0;
    this.acc = 0;
    // title card on the first panel
    if (this.idx === 0) {
      const tt = this.add.text(BASE_W / 2, 250, 'Corazones y Calabozos', { ...textStyle(64, '#ffd9a0'), stroke: '#2a0a10', strokeThickness: 8 }).setOrigin(0.5).setDepth(7).setAlpha(0).setScale(0.8);
      this.tweens.add({ targets: tt, alpha: 1, scale: 1, duration: 1400, ease: 'Back.easeOut' });
      this.tweens.add({ targets: tt, alpha: 0, delay: 3600, duration: 900, onComplete: () => tt.destroy() });
    }
  }

  update(_t: number, dt: number): void {
    const r = this.rich;
    if (!r) return;
    this.t += dt;
    r.update(this.t);
    if (this.revealed >= r.length) return;
    this.acc += dt;
    while (this.revealed < r.length) {
      const ch = r.chars[this.revealed].ch;
      const d = ch === ',' ? 150 : '.!?:'.includes(ch) ? 320 : ch === ' ' ? 8 : 30;
      if (this.acc < d) break;
      this.acc -= d;
      this.revealed++;
      if (ch !== ' ' && this.revealed % 4 === 0) AudioManager.sfx('ui_hover', { volume: 0.06, pitchVar: 200, detune: -200 });
    }
    r.reveal(this.revealed);
  }

  private advance(): void {
    if (this.leaving) return;
    const r = this.rich;
    if (r && this.revealed < r.length) { this.revealed = r.length; r.reveal(r.length); return; }
    AudioManager.sfx('ui_click', { volume: 0.5 });
    this.idx++;
    if (this.idx >= INTRO_PANELS.length) this.finish();
    else this.showPanel();
  }

  private finish(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(600);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', this.nextData));
  }
}