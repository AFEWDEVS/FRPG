import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { BASE_W } from '../constants';
import type { Item } from '../items/types';
import { COL, tx } from './theme';
import type { Tooltip } from './Tooltip';

/** What panels need from the UI scene (avoids a circular import). */
export interface UiHost extends Phaser.Scene {
  held: Item | null;
  tooltip: Tooltip;
  setHeld(item: Item | null): void;
  shopIsOpen(): boolean;
  /** Last pointer position in UI coords. */
  pointerPos(): { x: number; y: number };
  /** Marks the current click as consumed by UI (world must not react). */
  consumeClick(): void;
}

export type PanelSide = 'left' | 'right';

/** Base for the stone panels. Subclasses fill `body` in build(); refresh() rebuilds it. */
export abstract class Panel {
  readonly c: Phaser.GameObjects.Container;
  protected body: Phaser.GameObjects.Container;
  readonly x: number;
  readonly y = 24;
  isOpen = false;

  constructor(protected host: UiHost, readonly id: string, readonly w: number, readonly h: number, readonly side: PanelSide, protected title: string) {
    this.x = side === 'left' ? 16 : BASE_W - 16 - w;
    const s = host;
    this.c = s.add.container(this.x, this.y).setDepth(100).setVisible(false);
    if (s.textures.exists('ui_panel_stone')) this.c.add(s.add.image(w / 2, h / 2, 'ui_panel_stone').setDisplaySize(w, h).setTint(0x8a7a6a));
    const g = s.add.graphics();
    g.fillStyle(0x0e0908, 0.9).fillRect(0, 0, w, h);
    g.lineStyle(4, 0x6a5a40, 1).strokeRect(2, 2, w - 4, h - 4);
    g.lineStyle(1, 0xa88a58, 0.8).strokeRect(8, 8, w - 16, h - 16);
    g.lineStyle(1, 0x5a4a34, 1).lineBetween(16, 42, w - 16, 42);
    this.c.add(g);
    this.c.add(tx(null, s, w / 2, 24, title, 22, COL.gold, 0.5, 0.5));
    // close button
    const cb = s.add.text(w - 24, 22, 'X', { fontFamily: 'Georgia, serif', fontSize: '20px', color: '#c8a870', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
    const hit = s.add.zone(w - 24, 22, 34, 34).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => { cb.setColor('#ffffff'); AudioManager.sfx('ui_hover', { volume: 0.4, pitchVar: 60 }); });
    hit.on('pointerout', () => cb.setColor('#c8a870'));
    hit.on('pointerdown', () => { host.consumeClick(); this.close(); });
    this.c.add([cb, hit]);
    this.body = s.add.container(0, 0);
    this.c.add(this.body);
  }

  contains(px: number, py: number): boolean {
    return this.isOpen && px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.c.setVisible(true);
    this.refresh();
    AudioManager.sfx('ui_open');
    this.onOpen();
  }
  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.c.setVisible(false);
    this.host.tooltip.hide();
    AudioManager.sfx('ui_close');
    this.onClose();
  }
  toggle(): void { if (this.isOpen) this.close(); else this.open(); }

  refresh(): void {
    if (!this.isOpen) return;
    this.body.removeAll(true);
    this.build();
  }

  protected onOpen(): void { /* hook */ }
  protected onClose(): void { /* hook */ }
  protected abstract build(): void;
  /** Pointer press inside the panel (coords in screen space). Return true when handled. */
  pointerDown(_x: number, _y: number, _right: boolean): boolean { return true; }
  pointerMove(_x: number, _y: number): void { /* hook */ }
  /** Number key 1-6 pressed while the pointer is over the panel. */
  numberKey(_n: number, _x: number, _y: number): void { /* hook */ }
  wheel(_dy: number): void { /* hook */ }

  protected add<T extends Phaser.GameObjects.GameObject>(o: T): T { this.body.add(o); return o; }
  protected text(x: number, y: number, str: string, size = 15, color: string = COL.text, ox = 0, oy = 0): Phaser.GameObjects.Text {
    return tx(this.body, this.host, x, y, str, size, color, ox, oy);
  }
  /** Small stone button inside the panel body. */
  protected button(x: number, y: number, w: number, h: number, label: string, onClick: () => void, enabled = true, size = 15): Phaser.GameObjects.Container {
    const s = this.host;
    const g = s.add.graphics();
    const draw = (hover: boolean) => {
      g.clear().fillStyle(enabled ? (hover ? 0x4a3a28 : 0x2a2018) : 0x1a1614, 1).fillRect(0, 0, w, h)
        .lineStyle(2, enabled ? (hover ? 0xd8b060 : 0x8a7048) : 0x3a3228, 1).strokeRect(1, 1, w - 2, h - 2);
    };
    draw(false);
    const t = tx(null, s, w / 2, h / 2, label, size, enabled ? COL.text : '#5a5040', 0.5, 0.5);
    const c = s.add.container(x, y, [g, t]);
    if (enabled) {
      const z = s.add.zone(w / 2, h / 2, w, h).setInteractive({ useHandCursor: true });
      c.add(z);
      z.on('pointerover', () => { draw(true); AudioManager.sfx('ui_hover', { volume: 0.4, pitchVar: 60 }); });
      z.on('pointerout', () => draw(false));
      z.on('pointerdown', () => { this.host.consumeClick(); AudioManager.sfx('ui_click'); onClick(); });
    }
    this.body.add(c);
    return c;
  }
}