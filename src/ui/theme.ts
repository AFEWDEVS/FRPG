import Phaser from 'phaser';
import { RARITY_HEX } from '../data/items';
import type { Item } from '../items/types';
import { FONT } from './widgets';

export const CELL = 36;
export const COL = {
  gold: '#d8b060', text: '#e8d9a0', dim: '#8a7a60', red: '#ff6050', good: '#80ff80', blue: '#8f8fff',
  stone: 0x120c0a, edge: 0x6a5a40, edgeLight: 0xa88a58,
};

export function tx(parent: Phaser.GameObjects.Container | null, scene: Phaser.Scene, x: number, y: number, str: string, size = 15, color: string = COL.text, ox = 0, oy = 0): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#1a0c08', strokeThickness: Math.max(2, size / 8) }).setOrigin(ox, oy);
  parent?.add(t);
  return t;
}

/** Item icon fitted (aspect-preserving) in a box centred at (cx, cy). */
export function itemIcon(scene: Phaser.Scene, item: Item, cx: number, cy: number, w: number, h: number): Phaser.GameObjects.Image {
  const key = scene.textures.exists(item.icon) ? item.icon : 'icon_item_sword';
  const img = scene.add.image(cx, cy, key);
  const s = Math.min(w, h) - 4;
  img.setDisplaySize(s, s);
  if (item.rarity === 'unique') img.setTint(0xffeec0);
  return img;
}

/** Background for an occupied item box (rarity-tinted like D2). */
export function itemBox(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, item: Item, x: number, y: number, w: number, h: number): void {
  const c = RARITY_HEX[item.rarity];
  g.fillStyle(item.rarity === 'normal' ? 0x2a2420 : c, item.rarity === 'normal' ? 0.5 : 0.22).fillRect(x + 1, y + 1, w - 2, h - 2);
  g.lineStyle(1, item.rarity === 'normal' ? 0x4a4036 : c, 0.7).strokeRect(x + 1, y + 1, w - 2, h - 2);
}

export function slotBg(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number): void {
  const key = scene.textures.exists('ui_slot') ? 'ui_slot' : '';
  if (key) parent.add(scene.add.image(x + w / 2, y + h / 2, key).setDisplaySize(w, h).setAlpha(0.9));
  const g = scene.add.graphics();
  g.fillStyle(0x0a0706, 0.55).fillRect(x, y, w, h).lineStyle(1, 0x5a4a34, 1).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  parent.add(g);
}