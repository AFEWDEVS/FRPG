import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { BASE_H, BASE_W } from '../constants';
import { GameState } from '../core/GameState';
import type { ClassId } from '../core/types';
import { CLASS_LIST } from '../data/classes';
import { S } from '../data/strings';
import { coverBackground, makeButton, textStyle } from '../ui/widgets';

export class CharacterCreateScene extends Phaser.Scene {
  private selected: ClassId = 'knight';
  private frames = new Map<ClassId, Phaser.GameObjects.Rectangle>();
  private input_?: Phaser.GameObjects.DOMElement;
  constructor() { super('CharacterCreate'); }

  create(): void {
    this.cameras.main.fadeIn(400);
    coverBackground(this, 'bg_charselect', BASE_W, BASE_H);
    this.add.rectangle(BASE_W / 2, BASE_H / 2, BASE_W, BASE_H, 0x000000, 0.45);
    this.add.text(BASE_W / 2, 60, S.create.title, textStyle(52, '#d8b060')).setOrigin(0.5);

    const el = document.createElement('input');
    el.type = 'text';
    el.maxLength = 16;
    el.placeholder = S.create.namePlaceholder;
    el.value = S.create.defaultName;
    el.style.cssText = 'width:320px;padding:10px 14px;font:26px Georgia,serif;text-align:center;color:#e8d9a0;background:#14100c;border:3px solid #6a5a40;outline:none;';
    this.input_ = this.add.dom(BASE_W / 2, 140, el);
    el.addEventListener('keydown', (e) => e.stopPropagation());

    this.add.text(BASE_W / 2, 205, S.create.chooseClass, textStyle(26)).setOrigin(0.5);
    CLASS_LIST.forEach((c, i) => {
      const x = BASE_W / 2 + (i - 1) * 390, y = 430;
      const frame = this.add.rectangle(x, y, 360, 400, 0x120c0a, 0.9).setStrokeStyle(4, 0x4a3c2c);
      frame.setInteractive({ useHandCursor: true }).on('pointerdown', () => { AudioManager.sfx('ui_click'); this.select(c.id); });
      this.frames.set(c.id, frame);
      this.add.image(x, y - 100, c.portraitKey).setDisplaySize(190, 190);
      this.add.text(x, y + 20, c.name, textStyle(28, '#e8d9a0')).setOrigin(0.5);
      this.add.text(x, y + 56, c.tagline, textStyle(20, '#b8a070')).setOrigin(0.5);
      this.add.text(x, y + 130, c.description, { ...textStyle(18, '#d8c8a8'), wordWrap: { width: 320 }, align: 'center' }).setOrigin(0.5);
    });
    this.select('knight');

    makeButton(this, BASE_W / 2 + 160, 670, S.create.start, () => this.begin(), 300, 56);
    makeButton(this, BASE_W / 2 - 200, 670, S.menu.back, () => this.leave('MainMenu'), 200, 56);
    AudioManager.playMusic('title');
  }

  private select(id: ClassId): void {
    this.selected = id;
    for (const [k, f] of this.frames) f.setStrokeStyle(4, k === id ? 0xd8503a : 0x4a3c2c);
  }

  private begin(): void {
    const name = (this.input_?.node as HTMLInputElement | undefined)?.value ?? '';
    GameState.newGame(name, this.selected);
    this.leave('Game', { areaId: 'town', entry: 'start' });
  }

  private leave(scene: string, data?: object): void {
    this.input_?.destroy();
    this.cameras.main.fadeOut(300);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(scene, data));
  }
}
