import Phaser from 'phaser';
import { RARITY_HEX } from '../data/items';
import type { Item } from '../items/types';
import { FONT } from './widgets';

export const CELL = 36;
export const COL = {
  gold: '#d8b060', text: '#e8d9a0', dim: '#8a7a60', red: '#ff6050', good: '#80ff80', blue: '#8f8fff',
  stone: 0x120c0a, edge: 0x6a5a40, edgeLight: 0xa88a58,
};
/** Serif display face for titles (falls back to Georgia). */
export const DISPLAY = '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif';

/** True when an (optional) painted UI2 texture finished loading. */
export const has = (scene: Phaser.Scene, key: string): boolean => scene.textures.exists(key);

export function tx(parent: Phaser.GameObjects.Container | null, scene: Phaser.Scene, x: number, y: number, str: string, size = 15, color: string = COL.text, ox = 0, oy = 0): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#1a0c08', strokeThickness: Math.max(2, size / 8) }).setOrigin(ox, oy);
  parent?.add(t);
  return t;
}

/**
 * Painted panel background (container at 0,0 sized w x h). Uses the 9-slice art `ui2_panel_painted` when loaded,
 * otherwise a procedural dark vellum with a double gold hairline.
 */
export function paintedPanel(scene: Phaser.Scene, w: number, h: number, alpha = 0.94): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.34).fillRoundedRect(-3, 5, w + 6, h + 4, 14);
  if (has(scene, 'ui2_panel_painted')) {
    g.fillStyle(0x0e0a08, 0.82).fillRoundedRect(4, 4, w - 8, h - 8, 10);
    c.add(g);
    c.add(scene.add.nineslice(0, 0, 'ui2_panel_painted', undefined, w, h, 48, 48, 48, 48).setOrigin(0, 0));
    return c;
  }
  g.fillStyle(0x130e0b, alpha).fillRoundedRect(0, 0, w, h, 10);
  g.fillGradientStyle(0x3c2c1e, 0x3c2c1e, 0x130e0b, 0x130e0b, 0.55, 0.55, 0, 0).fillRect(3, 3, w - 6, Math.min(h * 0.3, 120));
  g.lineStyle(1.5, 0x9a7a4a, 0.9).strokeRoundedRect(0.75, 0.75, w - 1.5, h - 1.5, 10);
  g.lineStyle(1, 0x4a3a26, 0.9).strokeRoundedRect(6, 6, w - 12, h - 12, 7);
  g.fillStyle(0xc8a46a, 0.9);
  for (const [x, y] of [[6, 6], [w - 6, 6], [6, h - 6], [w - 6, h - 6]]) g.fillTriangle(x, y - 3.5, x + 3.5, y, x, y + 3.5).fillTriangle(x, y - 3.5, x - 3.5, y, x, y + 3.5);
  c.add(g);
  return c;
}

/** Thin ornamental divider centred on cx (uses ui2_divider art when loaded). */
export function divider(scene: Phaser.Scene, cx: number, y: number, w: number, alpha = 0.9): Phaser.GameObjects.GameObject {
  if (has(scene, 'ui2_divider')) return scene.add.image(cx, y, 'ui2_divider').setDisplaySize(w, w / 16).setAlpha(alpha);
  const g = scene.add.graphics();
  g.fillGradientStyle(0xc8a46a, 0xc8a46a, 0xc8a46a, 0xc8a46a, 0, alpha, 0, alpha).fillRect(cx - w / 2, y, w / 2 - 8, 1);
  g.fillGradientStyle(0xc8a46a, 0xc8a46a, 0xc8a46a, 0xc8a46a, alpha, 0, alpha, 0).fillRect(cx + 8, y, w / 2 - 8, 1);
  g.fillStyle(0xd8b878, alpha).fillTriangle(cx, y - 4, cx + 5, y + 0.5, cx, y + 5).fillTriangle(cx, y - 4, cx - 5, y + 0.5, cx, y + 5);
  return g;
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

/** Background for an occupied item box (rarity-tinted). */
export function itemBox(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, item: Item, x: number, y: number, w: number, h: number): void {
  const c = RARITY_HEX[item.rarity];
  g.fillStyle(item.rarity === 'normal' ? 0x2a2420 : c, item.rarity === 'normal' ? 0.5 : 0.22).fillRoundedRect(x + 1, y + 1, w - 2, h - 2, 4);
  g.lineStyle(1, item.rarity === 'normal' ? 0x4a4036 : c, 0.7).strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, 4);
}

export function slotBg(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number): void {
  const g = scene.add.graphics();
  g.fillStyle(0x0a0706, 0.55).fillRoundedRect(x, y, w, h, 5).lineStyle(1, 0x5a4a34, 0.9).strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 5);
  parent.add(g);
}