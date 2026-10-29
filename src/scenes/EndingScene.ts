import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { BASE_H, BASE_W } from '../constants';
import { EventBus, type GameEvents } from '../core/EventBus';
import { GameState } from '../core/GameState';
import { ENDING_EPILOGUE, ENDING_LINES, ENDING_UI } from '../data/story';
import { DialogueManager } from '../dialogue/DialogueManager';
import { DialogueBox } from '../ui/DialogueBox';
import type { UiHost } from '../ui/Panel';
import { RichText } from '../ui/RichText';
import { coverBackground, textStyle } from '../ui/widgets';

const BAR = 56;

/** Romantic comic finale: Ken Burns bg_ending, letterbox, fireworks and hearts, a branching talk with Amaranta, then the credits. */
export class EndingScene extends Phaser.Scene {
  private box!: DialogueBox;
  private unsub: (() => void)[] = [];
  private finished = false;
  private leaving = false;

  constructor() { super('Ending'); }

  consumeClick(): void { /* DialogueBox host contract */ }

  create(): void {
    this.finished = false;
    this.leaving = false;
    GameState.flags.gameCompleted = true;
    GameState.flags.endingSeen = true;
    GameState.save();
    DialogueManager.reset();
    DialogueManager.init();
    this.cameras.main.fadeIn(1400, 255, 255, 255);
    AudioManager.playMusic('ending');
    const bg = coverBackground(this, 'bg_ending', BASE_W, BASE_H);
    const s0 = bg.scale;
    bg.setScale(s0 * 1.12);
    this.tweens.add({ targets: bg, scale: s0 * 1.02, x: BASE_W / 2 - 24, y: BASE_H / 2 + 8, duration: 40000, ease: 'Sine.easeInOut' });
    this.add.rectangle(BASE_W / 2, BASE_H / 2, BASE_W, BASE_H, 0x10040c, 0.16).setDepth(1);
    const top = this.add.rectangle(BASE_W / 2, -BAR / 2, BASE_W, BAR, 0x000000).setDepth(8);
    const bot = this.add.rectangle(BASE_W / 2, BASE_H + BAR / 2, BASE_W, BAR, 0x000000).setDepth(8);
    this.tweens.add({ targets: top, y: BAR / 2, duration: 1000, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: bot, y: BASE_H - BAR / 2, duration: 1000, ease: 'Cubic.easeOut' });
    this.celebrate();

    this.box = new DialogueBox(this as unknown as Phaser.Scene & UiHost, { bottom: BAR + 14 });
    this.unsub.push(
      EventBus.on('dialogue:show', (p: GameEvents['dialogue:show']) => this.box.show(p)),
      EventBus.on('dialogue:hide', () => this.box.hide()),
    );
    this.input.keyboard?.on('keydown-ESC', () => this.toCredits());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.unsub.forEach((f) => f()); this.unsub = []; });
    this.add.text(BASE_W - 14, BASE_H - 18, 'Esc: saltar', textStyle(13, '#a89a78')).setOrigin(1, 0.5).setDepth(11);
    this.time.delayedCall(1800, () => DialogueManager.play(ENDING_LINES, { onDone: () => this.showFin() }));
  }

  update(_t: number, dt: number): void { this.box?.update(dt); }

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
        const x = Phaser.Math.Between(120, BASE_W - 120), y = Phaser.Math.Between(90, 300);
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

  private showFin(): void {
    if (this.finished) return;
    this.finished = true;
    const choice = String(GameState.flags.endingChoice ?? 'default');
    const sub = ENDING_EPILOGUE[choice] ?? ENDING_UI.subtitle;
    const veil = this.add.rectangle(BASE_W / 2, BASE_H / 2, BASE_W, BASE_H, 0x10040c, 0).setDepth(18);
    this.tweens.add({ targets: veil, fillAlpha: 0.55, duration: 1200 });
    const fin = this.add.text(BASE_W / 2, 230, ENDING_UI.title, { ...textStyle(130, '#ffb0c8'), stroke: '#40101c', strokeThickness: 10 }).setOrigin(0.5).setDepth(20).setAlpha(0);
    const txt = new RichText(this, (BASE_W - 900) / 2, 340, { size: 26, color: '#fff2e0', width: 900, align: 'center', stroke: '#140a04', strokeW: 4, lineSpacing: 8 }, true);
    txt.set(sub);
    txt.c.setDepth(20);
    this.tweens.add({ targets: fin, alpha: 1, scale: { from: 0.6, to: 1 }, duration: 1400, ease: 'Back.easeOut' });
    let n = 0;
    this.time.delayedCall(1400, () => {
      this.time.addEvent({ delay: 35, repeat: txt.length, callback: () => { n++; txt.reveal(n); } });
    });
    AudioManager.sfx('quest_complete');
    this.time.delayedCall(9000 + sub.length * 30, () => this.toCredits());
    this.input.once('pointerdown', () => this.time.delayedCall(2500, () => this.toCredits()));
  }

  private toCredits(): void {
    if (this.leaving) return;
    this.leaving = true;
    DialogueManager.reset();
    this.cameras.main.fadeOut(900);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Credits'));
  }
}