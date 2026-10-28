import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';

export const FONT = 'Georgia, "Palatino Linotype", serif';

export function textStyle(size: number, color = '#e8d9a0'): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#1a0c08', strokeThickness: Math.max(2, size / 8) };
}

/** Diablo-ish stone button using the ui_button texture. */
export function makeButton(
  scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void, w = 300, h = 58, enabled = true,
): Phaser.GameObjects.Container {
  const bg = scene.add.image(0, 0, 'ui_button').setDisplaySize(w, h);
  const txt = scene.add.text(0, 0, label, textStyle(24, enabled ? '#e8d9a0' : '#6a6050')).setOrigin(0.5);
  const c = scene.add.container(x, y, [bg, txt]);
  c.setSize(w, h);
  if (enabled) {
    c.setInteractive({ useHandCursor: true });
    c.on('pointerover', () => { bg.setTint(0xffe0b0); txt.setColor('#ffffff'); AudioManager.sfx('ui_hover', { volume: 0.4, pitchVar: 60 }); });
    c.on('pointerout', () => { bg.clearTint(); txt.setColor('#e8d9a0'); });
    c.on('pointerdown', () => { AudioManager.sfx('ui_click'); onClick(); });
  } else {
    bg.setTint(0x777777);
  }
  return c;
}

/** Cover-fit a background image to the 1280x720 canvas. */
export function coverBackground(scene: Phaser.Scene, key: string, w: number, h: number): Phaser.GameObjects.Image {
  const img = scene.add.image(w / 2, h / 2, key);
  const s = Math.max(w / img.width, h / img.height);
  return img.setScale(s);
}