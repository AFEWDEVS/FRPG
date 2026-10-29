import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { BASE_H, BASE_W } from '../constants';
import { EventBus, type GameEvents } from '../core/EventBus';
import { NPC_COLORS } from '../data/npcs';
import type { UiHost } from './Panel';
import { RichText } from './RichText';
import { FONT } from './widgets';
import { paintedPanel } from './theme';

const W = 1000, H = 190;
const PORT = 200;

interface Voice { detune: number; speed: number; vol: number; }
/** Per-speaker voice blip (pitch in cents, speed multiplier of the typewriter). */
const VOICES: Record<string, Voice> = {
  hero: { detune: 0, speed: 1, vol: 0.1 }, elder: { detune: -550, speed: 1.35, vol: 0.12 }, bard: { detune: 450, speed: 0.75, vol: 0.1 },
  merchant: { detune: 180, speed: 0.9, vol: 0.1 }, healer: { detune: 300, speed: 1.1, vol: 0.09 }, amaranta: { detune: 650, speed: 1, vol: 0.1 },
  malvarron: { detune: -300, speed: 0.95, vol: 0.12 }, ogre: { detune: -950, speed: 1.5, vol: 0.14 }, thorn: { detune: 120, speed: 1, vol: 0.1 },
  gargoyle: { detune: -650, speed: 1.2, vol: 0.12 },
};

export interface DialogueBoxOpts { bottom?: number; }

/** Dialogue: painted dark frame, nameplate, sliding portrait, rich typewriter, choice buttons. */
export class DialogueBox {
  private c: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Container;
  private choiceC: Phaser.GameObjects.Container;
  private portC!: Phaser.GameObjects.Container;
  private rich?: RichText;
  private revealed = 0;
  private acc = 0;
  private t = 0;
  private blipAt = 0;
  private blipCount = 0;
  private lastWho = '';
  private voice: Voice = VOICES.hero;
  private choices: { id: string; text: string }[] = [];
  private choiceObjs: { hit: () => void }[] = [];
  private choicesShown = false;
  private X: number;
  private Y: number;
  private cur?: GameEvents['dialogue:show'];
  visible = false;

  constructor(private scene: Phaser.Scene & UiHost, opts: DialogueBoxOpts = {}) {
    this.X = (BASE_W - W) / 2;
    this.Y = BASE_H - (opts.bottom ?? 28) - H - 6;
    this.c = scene.add.container(this.X, this.Y).setDepth(900).setVisible(false);
    this.drawFrame();
    this.body = scene.add.container(0, 0);
    this.choiceC = scene.add.container(0, 0);
    this.c.add([this.body, this.choiceC]);
    const z = scene.add.zone(W / 2, H / 2, W, H).setInteractive();
    z.on('pointerdown', () => { scene.consumeClick(); this.advance(); });
    this.c.addAt(z, 0);
    const kb = scene.input.keyboard;
    const onKey = (e: KeyboardEvent) => {
      if (!this.visible) return;
      if (e.key === 'Enter' || e.key === ' ') { this.advance(true); return; }
      const n = Number(e.key);
      if (n >= 1 && n <= 3 && this.choicesShown && this.choiceObjs[n - 1]) this.choiceObjs[n - 1].hit();
    };
    kb?.on('keydown', onKey);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb?.off('keydown', onKey));
  }

  private drawFrame(): void {
    this.c.add(paintedPanel(this.scene, W, H, 0.9));
  }
  covers(px: number, py: number): boolean {
    return this.visible && px >= this.X && px <= this.X + W && py >= this.Y - 150 && py <= this.Y + H;
  }

  show(p: GameEvents['dialogue:show']): void {
    this.cur = p;
    const s = this.scene;
    this.body.removeAll(true);
    this.choiceC.removeAll(true);
    this.choiceObjs = [];
    this.choicesShown = false;
    this.rich?.destroy();
    const who = p.who ?? 'hero';
    this.voice = VOICES[who] ?? VOICES.hero;
    const color = NPC_COLORS[who] ?? '#d8b060';
    const colNum = Phaser.Display.Color.HexStringToColor(color).color;

    // nameplate
    const nameT = s.add.text(0, 0, p.speaker, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color, stroke: '#1a0c08', strokeThickness: 4 }).setOrigin(0, 0.5);
    const pw = Math.max(150, nameT.width + 44);
    const plate = s.add.graphics();
    plate.fillStyle(0x1a100a, 1).fillRoundedRect(0, -16, pw, 34, 8).lineStyle(1.5, colNum, 0.9).strokeRoundedRect(0, -16, pw, 34, 8);
    plate.fillStyle(colNum, 1).fillCircle(14, 1, 4);
    nameT.setPosition(26, 1);
    const plateC = s.add.container(250, -6, [plate, nameT]);
    this.body.add(plateC);

    // portrait
    const pk = s.textures.exists(p.portrait) ? p.portrait : `portrait_${p.portrait}`;
    const px = 20 + PORT / 2, py = H / 2 - 30;
    this.portC = s.add.container(px, py);
    const pf = s.add.graphics();
    pf.fillStyle(0x000000, 0.4).fillRoundedRect(-PORT / 2 + 5, -PORT / 2 + 7, PORT, PORT, 14);
    pf.fillStyle(0x1a1008, 1).fillRoundedRect(-PORT / 2, -PORT / 2, PORT, PORT, 14);
    this.portC.add(pf);
    if (s.textures.exists(pk)) {
      const im = s.add.image(0, 0, pk);
      im.setScale(Math.min((PORT - 8) / im.width, (PORT - 8) / im.height));
      this.portC.add(im);
    }
    const pb = s.add.graphics();
    pb.lineStyle(2.5, colNum, 0.9).strokeRoundedRect(-PORT / 2, -PORT / 2, PORT, PORT, 14);
    this.portC.add(pb);
    this.body.add(this.portC);
    if (who !== this.lastWho || !this.visible) {
      this.portC.x = px - 120; this.portC.setAlpha(0);
      s.tweens.add({ targets: this.portC, x: px, alpha: 1, duration: 260, ease: 'Back.easeOut' });
      plateC.setAlpha(0).x = 220;
      s.tweens.add({ targets: plateC, x: 250, alpha: 1, duration: 240, ease: 'Cubic.easeOut' });
    }
    if (p.emphasis) {
      this.portC.setScale(1.14);
      s.tweens.add({ targets: this.portC, scale: 1, duration: 360, ease: 'Back.easeOut' });
    }
    this.lastWho = who;

    // text
    this.rich = new RichText(s, 250, 36, { size: 21, color: '#efe3c6', width: W - 290, lineSpacing: 5 });
    this.rich.set(p.text);
    this.body.add(this.rich.c);
    this.revealed = 0;
    this.acc = 0;
    this.blipCount = 0;
    this.choices = p.choices ?? [];
    const wasVisible = this.visible;
    this.visible = true;
    this.c.setVisible(true);
    if (!wasVisible) {
      this.c.y = this.Y + 24; this.c.setAlpha(0);
      s.tweens.add({ targets: this.c, y: this.Y, alpha: 1, duration: 220, ease: 'Cubic.easeOut' });
      AudioManager.sfx('ui_open', { volume: 0.5 });
    }
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.lastWho = '';
    this.c.setVisible(false);
    this.body.removeAll(true);
    this.choiceC.removeAll(true);
    this.rich?.destroy();
    this.rich = undefined;
    this.cur = undefined;
  }

  private pick(id: string): void {
    this.scene.consumeClick();
    AudioManager.sfx('ui_click');
    this.hide();
    EventBus.emit('dialogue:choice', { id });
  }

  private showChoices(): void {
    if (this.choicesShown) return;
    this.choicesShown = true;
    const s = this.scene;
    if (!this.choices.length) return;
    const multi = this.choices.length > 1;
    if (!multi) {
      const hint = s.add.text(W - 40, H - 30, this.choices[0].id === '__end' ? 'Cerrar  ▸' : 'Continuar  ▾', { fontFamily: FONT, fontSize: '15px', color: '#b89a68', fontStyle: 'italic' }).setOrigin(1, 0.5);
      this.body.add(hint);
      s.tweens.add({ targets: hint, alpha: 0.35, yoyo: true, repeat: -1, duration: 600 });
      return;
    }
    const n = this.choices.length;
    const bh = 38, bw = 600, gap = 6;
    this.choices.forEach((ch, i) => {
      const y = -(n - i) * (bh + gap) - 34;
      const g = s.add.graphics();
      const glow = s.add.graphics().setAlpha(0);
      glow.fillStyle(0xffd070, 0.35).fillRoundedRect(-4, -4, bw + 8, bh + 8, 12);
      const draw = (h: boolean) => g.clear()
        .fillStyle(h ? 0x6a4624 : 0x2a1a10, 0.97).fillRoundedRect(0, 0, bw, bh, 8)
        .lineStyle(2, h ? 0xffd070 : 0x9a7a44, 1).strokeRoundedRect(1, 1, bw - 2, bh - 2, 8);
      draw(false);
      const num = s.add.text(16, bh / 2, String(i + 1), { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffd070', stroke: '#1a0c08', strokeThickness: 3 }).setOrigin(0.5);
      const t = s.add.text(36, bh / 2, ch.text, { fontFamily: FONT, fontSize: '18px', color: '#f4e6bc', wordWrap: { width: bw - 56 } }).setOrigin(0, 0.5);
      const z = s.add.zone(bw / 2, bh / 2, bw, bh).setInteractive({ useHandCursor: true });
      const cont = s.add.container(W - bw - 24, y, [glow, g, num, t, z]).setAlpha(0);
      s.tweens.add({ targets: cont, alpha: 1, x: W - bw - 24, duration: 200, delay: i * 70, ease: 'Cubic.easeOut' });
      cont.x += 30;
      z.on('pointerover', () => { draw(true); glow.setAlpha(1); t.setColor('#ffffff'); AudioManager.sfx('ui_hover', { volume: 0.4, pitchVar: 60 }); });
      z.on('pointerout', () => { draw(false); glow.setAlpha(0); t.setColor('#f4e6bc'); });
      z.on('pointerdown', () => this.pick(ch.id));
      this.choiceC.add(cont);
      this.choiceObjs.push({ hit: () => this.pick(ch.id) });
    });
  }

  /** Click / Enter: finish typing, or continue (no choices). */
  advance(key = false): void {
    if (!this.visible) return;
    const rt = this.rich;
    if (rt && this.revealed < rt.length) { this.revealed = rt.length; rt.reveal(rt.length); this.showChoices(); return; }
    if (this.choices.length === 1) {
      void key;
      const id = this.choices[0].id;
      this.hide();
      EventBus.emit('dialogue:choice', { id });
    }
  }

  update(dtMs: number): void {
    if (!this.visible || !this.rich) return;
    this.t += dtMs;
    this.rich.update(this.t);
    this.portC.y = (H / 2 - 30) + Math.sin(this.t / 520) * 3;
    const rt = this.rich;
    if (this.revealed >= rt.length) { this.showChoices(); return; }
    this.acc += dtMs;
    while (this.revealed < rt.length) {
      const ch = rt.chars[this.revealed].ch;
      let d = 24 * this.voice.speed;
      if (ch === ',' || ch === ';' || ch === ':') d = 130;
      else if (ch === '.' || ch === '!' || ch === '?' || ch === '…') d = 240;
      else if (ch === ' ') d = 6;
      if (this.acc < d) break;
      this.acc -= d;
      this.revealed++;
      if (ch !== ' ' && ++this.blipCount % 3 === 0 && this.t - this.blipAt > 50) {
        this.blipAt = this.t;
        AudioManager.sfx('ui_hover', { volume: this.voice.vol, pitchVar: 120, detune: this.voice.detune });
      }
    }
    rt.reveal(this.revealed);
    if (this.revealed >= rt.length) this.showChoices();
  }
}