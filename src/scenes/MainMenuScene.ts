import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { BASE_H, BASE_W } from '../constants';
import { GameState } from '../core/GameState';
import { SaveManager } from '../core/SaveManager';
import { S } from '../data/strings';
import { coverBackground, makeButton, textStyle } from '../ui/widgets';

export class MainMenuScene extends Phaser.Scene {
  private options?: Phaser.GameObjects.Container;
  constructor() { super('MainMenu'); }

  create(): void {
    this.cameras.main.fadeIn(500);
    coverBackground(this, 'bg_title', BASE_W, BASE_H);
    this.add.rectangle(BASE_W / 2, BASE_H / 2, BASE_W, BASE_H, 0x000000, 0.35);
    this.add.text(BASE_W / 2, 150, S.gameTitle, textStyle(78, '#d8503a')).setOrigin(0.5).setShadow(0, 6, '#000', 12, true, true);
    this.add.text(BASE_W / 2, 215, S.tagline, textStyle(26, '#f0c8c0')).setOrigin(0.5);
    AudioManager.playMusic('title');

    const cx = BASE_W / 2;
    makeButton(this, cx, 360, S.menu.new, () => this.scene.start('CharacterCreate'));
    makeButton(this, cx, 435, S.menu.continue, () => {
      if (GameState.load()) this.scene.start('Game', { areaId: 'town', entry: 'start' });
    }, 300, 58, SaveManager.hasSave());
    makeButton(this, cx, 510, S.menu.options, () => this.toggleOptions());
  }

  private toggleOptions(): void {
    if (this.options) { this.options.destroy(); this.options = undefined; return; }
    const c = this.add.container(BASE_W / 2, BASE_H / 2);
    c.add(this.add.rectangle(0, 0, 520, 340, 0x120c0a, 0.96).setStrokeStyle(4, 0x6a5a40));
    const row = (y: number, label: string, get: () => number, set: (v: number) => void) => {
      const t = this.add.text(-150, y, '', textStyle(26)).setOrigin(0, 0.5);
      const refresh = () => t.setText(`${label}: ${Math.round(get() * 100)}%`);
      refresh();
      c.add(t);
      c.add(makeButton(this, 140, y, '-', () => { set(get() - 0.1); refresh(); }, 56, 48));
      c.add(makeButton(this, 205, y, '+', () => { set(get() + 0.1); refresh(); }, 56, 48));
    };
    row(-70, S.menu.music, () => AudioManager.musicVolume, (v) => AudioManager.setVolumes(v, undefined));
    row(10, S.menu.sfx, () => AudioManager.sfxVolume, (v) => AudioManager.setVolumes(undefined, v));
    c.add(makeButton(this, 0, 110, S.menu.back, () => this.toggleOptions(), 240, 52));
    this.options = c;
  }
}