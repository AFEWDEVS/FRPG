import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { BASE_W } from '../constants';
import type { Item } from '../items/types';
import { COL, DISPLAY, divider, paintedPanel, tx } from './theme';
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

/** Base for the painted panels. Subclasses fill `body` in build(); refresh() rebuilds it. */
export abstract class Panel {
  readonly c: Phaser.GameObjects.Container;
  protected body: Phaser.GameObjects.Container;
  readonly x: number;
  readonly y = 60;
  isOpen = false;

  constructor(protected host: UiHost, readonly id: string, readonly w: number, readonly h: number, readonly side: PanelSide, protected title: string) {
    this.x = side === 'left' ? 16 : BASE_W - 16 - w;
    const s = host;
    this.c = s.add.container(this.x, this.y).setDepth(100).setVisible(false);
    this.c.add(paintedPanel(s, w, h));
    this.c.add(tx(null, s, w / 2, 27, title, 22, COL.gold, 0.5, 0.5).setFontFamily(DISPLAY).setLetterSpacing(2));
    this.c.add(divider(s, w / 2, 48, w - 70));
    // close button
    const cb = s.add.text(w - 26, 26, '×', { fontFamily: DISPLAY, fontSize: '26px', color: '#b89a68' }).setOrigin(0.5);
    const hit = s.add.zone(w - 26, 26, 44, 44).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => { cb.setColor('#ffffff'); AudioManager.sfx('ui_hover', { volume: 0.4, pitchVar: 60 }); });
    hit.on('pointerout', () => cb.setColor('#b89a68'));
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
    const dx = this.side === 'left' ? -18 : 18;
    this.host.tweens.killTweensOf(this.c);
    this.c.setAlpha(0).setX(this.x + dx);
    this.host.tweens.add({ targets: this.c, alpha: 1, x: this.x, duration: 190, ease: 'Cubic.easeOut' });
    AudioManager.sfx('ui_open');
    this.onOpen();
  }
  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.host.tweens.killTweensOf(this.c);
    this.host.tweens.add({ targets: this.c, alpha: 0, x: this.x + (this.side === 'left' ? -12 : 12), duration: 130, ease: 'Cubic.easeIn', onComplete: () => { if (!this.isOpen) this.c.setVisible(false); } });
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
  /** Small painted button inside the panel body. */
  protected button(x: number, y: number, w: number, h: number, label: string, onClick: () => void, enabled = true, size = 15): Phaser.GameObjects.Container {
    const s = this.host;
    const g = s.add.graphics();
    const draw = (hover: boolean) => {
      g.clear().fillStyle(enabled ? (hover ? 0x4a3826 : 0x2a1f16) : 0x18130f, enabled ? 0.95 : 0.7).fillRoundedRect(0, 0, w, h, 6)
        .lineStyle(1.5, enabled ? (hover ? 0xe8c880 : 0x9a7e50) : 0x3a3228, 1).strokeRoundedRect(0.75, 0.75, w - 1.5, h - 1.5, 6);
    };
    draw(false);
    const t = tx(null, s, w / 2, h / 2, label, size, enabled ? COL.text : '#5a5040', 0.5, 0.5);
    const c = s.add.container(x, y, [g, t]);
    if (enabled) {
      const z = s.add.zone(w / 2, h / 2, Math.max(w, 44), Math.max(h, 44)).setInteractive({ useHandCursor: true });
      c.add(z);
      z.on('pointerover', () => { draw(true); AudioManager.sfx('ui_hover', { volume: 0.4, pitchVar: 60 }); });
      z.on('pointerout', () => draw(false));
      z.on('pointerdown', () => { this.host.consumeClick(); AudioManager.sfx('ui_click'); onClick(); });
    }
    this.body.add(c);
    return c;
  }
}