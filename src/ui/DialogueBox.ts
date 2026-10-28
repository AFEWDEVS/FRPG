import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { BASE_H, BASE_W } from '../constants';
import { EventBus, type GameEvents } from '../core/EventBus';
import type { UiHost } from './Panel';
import { FONT } from './widgets';

const W = 900, H = 200;
const X = (BASE_W - W) / 2, Y = BASE_H - 118 - H - 6;

/** D2-style parchment dialogue with portrait, typewriter text and choice buttons. */
export class DialogueBox {
  private c: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Container;
  private textObj!: Phaser.GameObjects.Text;
  private full = '';
  private shown = 0;
  private choices: { id: string; text: string }[] = [];
  private choiceObjs: Phaser.GameObjects.Container[] = [];
  private cur?: GameEvents['dialogue:show'];
  visible = false;

  constructor(private scene: Phaser.Scene & UiHost) {
    this.c = scene.add.container(X, Y).setDepth(900).setVisible(false);
    if (scene.textures.exists('ui_parchment')) this.c.add(scene.add.image(W / 2, H / 2, 'ui_parchment').setDisplaySize(W, H));
    const g = scene.add.graphics();
    g.fillStyle(0xd8c49a, 0.35).fillRect(0, 0, W, H).lineStyle(5, 0x4a3420, 1).strokeRect(2, 2, W - 4, H - 4).lineStyle(1, 0x8a6a3a, 1).strokeRect(9, 9, W - 18, H - 18);
    this.c.add(g);
    this.body = scene.add.container(0, 0);
    this.c.add(this.body);
    const z = scene.add.zone(W / 2, H / 2, W, H).setInteractive();
    z.on('pointerdown', () => { scene.consumeClick(); this.advance(); });
    this.c.addAt(z, 0);
    scene.input.keyboard?.on('keydown-ENTER', () => { if (this.visible) this.advance(true); });
  }

  covers(px: number, py: number): boolean { return this.visible && px >= X && px <= X + W && py >= Y && py <= Y + H; }

  show(p: GameEvents['dialogue:show']): void {
    this.cur = p;
    this.body.removeAll(true);
    this.choiceObjs = [];
    const s = this.scene;
    const pk = s.textures.exists(p.portrait) ? p.portrait : `portrait_${p.portrait}`;
    const pg = s.add.graphics();
    pg.fillStyle(0x1a1008, 1).fillRect(22, 22, 156, 156).lineStyle(3, 0x4a3420, 1).strokeRect(22, 22, 156, 156);
    this.body.add(pg);
    if (s.textures.exists(pk)) this.body.add(s.add.image(100, 100, pk).setDisplaySize(150, 150));
    this.body.add(s.add.text(200, 20, p.speaker, { fontFamily: FONT, fontSize: '22px', color: '#5a1a10', fontStyle: 'bold' }));
    this.textObj = s.add.text(200, 54, '', { fontFamily: FONT, fontSize: '19px', color: '#2a1608', wordWrap: { width: W - 230 }, lineSpacing: 4 });
    this.body.add(this.textObj);
    this.full = p.text;
    this.shown = 0;
    this.choices = p.choices ?? [];
    this.visible = true;
    this.c.setVisible(true);
    AudioManager.sfx('ui_open', { volume: 0.5 });
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.c.setVisible(false);
    this.body.removeAll(true);
    this.cur = undefined;
  }

  private showChoices(): void {
    if (!this.choices.length) {
      const hint = this.scene.add.text(W - 24, H - 22, 'Clic para continuar ▸', { fontFamily: FONT, fontSize: '14px', color: '#6a4a2a', fontStyle: 'italic' }).setOrigin(1, 0.5);
      this.body.add(hint);
      this.scene.tweens.add({ targets: hint, alpha: 0.3, yoyo: true, repeat: -1, duration: 600 });
      return;
    }
    const s = this.scene;
    const n = this.choices.length;
    const bh = n > 3 ? 26 : 30;
    const y0 = H - 18 - n * (bh + 4);
    this.choices.forEach((ch, i) => {
      const y = y0 + i * (bh + 4), w = W - 240;
      const g = s.add.graphics();
      const draw = (h: boolean) => g.clear().fillStyle(h ? 0x6a4a2a : 0x3a2616, 0.95).fillRect(0, 0, w, bh).lineStyle(2, h ? 0xe8c070 : 0x8a6a3a, 1).strokeRect(1, 1, w - 2, bh - 2);
      draw(false);
      const t = s.add.text(12, bh / 2, ch.text, { fontFamily: FONT, fontSize: '17px', color: '#f0e0b0' }).setOrigin(0, 0.5);
      const z = s.add.zone(w / 2, bh / 2, w, bh).setInteractive({ useHandCursor: true });
      const cont = s.add.container(200, y, [g, t, z]);
      z.on('pointerover', () => { draw(true); AudioManager.sfx('ui_hover', { volume: 0.4, pitchVar: 60 }); });
      z.on('pointerout', () => draw(false));
      z.on('pointerdown', () => { s.consumeClick(); AudioManager.sfx('ui_click'); this.hide(); EventBus.emit('dialogue:choice', { id: ch.id }); });
      this.body.add(cont);
      this.choiceObjs.push(cont);
    });
  }

  /** Click / Enter: finish typing, or continue (no choices). */
  advance(key = false): void {
    if (!this.visible) return;
    if (this.shown < this.full.length) { this.shown = this.full.length; this.textObj.setText(this.full); this.showChoices(); return; }
    // Enter picks the only choice (Continuar / Cerrar); with several choices the player must click one.
    if (key && this.choices.length === 1) { const id = this.choices[0].id; this.hide(); EventBus.emit('dialogue:choice', { id }); return; }
    if (!this.choices.length) {
      this.hide();
      EventBus.emit('dialogue:choice', { id: 'continue' });
    }
  }

  update(dtMs: number): void {
    if (!this.visible || this.shown >= this.full.length) return;
    const before = this.shown;
    this.shown = Math.min(this.full.length, this.shown + dtMs * 0.045);
    this.textObj.setText(this.full.slice(0, Math.floor(this.shown)));
    if (Math.floor(before / 4) !== Math.floor(this.shown / 4)) AudioManager.sfx('ui_hover', { volume: 0.12, pitchVar: 300 });
    if (this.shown >= this.full.length) this.showChoices();
  }
}