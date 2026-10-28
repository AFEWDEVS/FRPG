import Phaser from 'phaser';
import { EventBus } from '../../core/EventBus';
import { GameState } from '../../core/GameState';
import { EQUIP_SLOTS, SLOT_LABEL } from '../../data/items';
import { itemTooltip } from '../../items/format';
import {
  GRID_H, GRID_W, drinkFromInventory, entriesAt, equipCheck, equipFromHand, equipFromInventory, fitsGrid, sellValue, unequipToInventory, type InvEntry,
} from '../../items/inventory';
import type { EquipSlot, Item } from '../../items/types';
import { AudioManager } from '../../audio/AudioManager';
import { Panel, type UiHost } from '../Panel';
import { CELL, COL, itemBox, itemIcon, slotBg } from '../theme';

interface Rect { x: number; y: number; w: number; h: number; }

export const SLOT_RECTS: Record<EquipSlot, Rect> = {
  helm: { x: 174, y: 50, w: 72, h: 72 },
  amulet: { x: 258, y: 86, w: 36, h: 36 },
  weapon: { x: 30, y: 82, w: 72, h: 144 },
  offhand: { x: 318, y: 82, w: 72, h: 144 },
  armor: { x: 174, y: 130, w: 72, h: 108 },
  gloves: { x: 30, y: 244, w: 72, h: 72 },
  belt: { x: 174, y: 246, w: 72, h: 36 },
  boots: { x: 318, y: 244, w: 72, h: 72 },
  ring1: { x: 130, y: 246, w: 36, h: 36 },
  ring2: { x: 254, y: 246, w: 36, h: 36 },
};
const SHORT: Record<EquipSlot, string> = {
  helm: 'Casco', amulet: 'Amuleto', weapon: 'Arma', offhand: 'Mano izq.', armor: 'Armadura', gloves: 'Guantes', belt: 'Cinto', boots: 'Botas', ring1: 'Anillo', ring2: 'Anillo',
};

type Hit = { kind: 'slot'; slot: EquipSlot } | { kind: 'grid'; cx: number; cy: number; entry?: InvEntry } | null;

export class InventoryPanel extends Panel {
  readonly gx = 30;
  readonly gy = 332;
  private preview?: Phaser.GameObjects.Graphics;
  private lastTip = '';

  constructor(host: UiHost) { super(host, 'inventory', 420, 520, 'right', 'Inventario'); }

  protected build(): void {
    const s = this.host, p = GameState.profile;
    for (const slot of EQUIP_SLOTS) {
      const r = SLOT_RECTS[slot];
      slotBg(s, this.body, r.x, r.y, r.w, r.h);
      const it = p.equipment[slot];
      if (it) {
        const g = this.add(s.add.graphics());
        itemBox(s, g, it, r.x, r.y, r.w, r.h);
        this.add(itemIcon(s, it, r.x + r.w / 2, r.y + r.h / 2, r.w, r.h));
      } else {
        this.text(r.x + r.w / 2, r.y + r.h / 2, SHORT[slot], 11, '#5a4a34', 0.5, 0.5);
      }
    }
    const grid = this.add(s.add.graphics());
    grid.fillStyle(0x0a0706, 0.7).fillRect(this.gx, this.gy, GRID_W * CELL, GRID_H * CELL);
    grid.lineStyle(1, 0x3a2e22, 1);
    for (let i = 0; i <= GRID_W; i++) grid.lineBetween(this.gx + i * CELL, this.gy, this.gx + i * CELL, this.gy + GRID_H * CELL);
    for (let j = 0; j <= GRID_H; j++) grid.lineBetween(this.gx, this.gy + j * CELL, this.gx + GRID_W * CELL, this.gy + j * CELL);
    grid.lineStyle(2, 0x6a5a40, 1).strokeRect(this.gx, this.gy, GRID_W * CELL, GRID_H * CELL);
    for (const e of p.inventory) {
      const g = this.add(s.add.graphics());
      const x = this.gx + e.x * CELL, y = this.gy + e.y * CELL, w = e.item.w * CELL, h = e.item.h * CELL;
      itemBox(s, g, e.item, x, y, w, h);
      this.add(itemIcon(s, e.item, x + w / 2, y + h / 2, w, h));
    }
    this.text(30, 490, `Oro: ${p.gold}`, 17, '#ffd24a');
    this.text(this.w - 30, 492, 'Clic der.: usar / equipar', 12, COL.dim, 1, 0);
    this.preview = this.add(s.add.graphics());
    this.lastTip = '';
  }

  private hit(px: number, py: number): Hit {
    const lx = px - this.x, ly = py - this.y;
    for (const slot of EQUIP_SLOTS) {
      const r = SLOT_RECTS[slot];
      if (lx >= r.x && lx < r.x + r.w && ly >= r.y && ly < r.y + r.h) return { kind: 'slot', slot };
    }
    if (lx >= this.gx && lx < this.gx + GRID_W * CELL && ly >= this.gy && ly < this.gy + GRID_H * CELL) {
      const cx = Math.floor((lx - this.gx) / CELL), cy = Math.floor((ly - this.gy) / CELL);
      return { kind: 'grid', cx, cy, entry: GameState.profile.inventory.find((e) => cx >= e.x && cx < e.x + e.item.w && cy >= e.y && cy < e.y + e.item.h) };
    }
    return null;
  }

  /** Top-left cell for the held item so it is centred under the pointer. */
  private topLeft(px: number, py: number, item: Item): { x: number; y: number } {
    const lx = px - this.x, ly = py - this.y;
    return { x: Math.round((lx - this.gx) / CELL - item.w / 2), y: Math.round((ly - this.gy) / CELL - item.h / 2) };
  }

  pointerMove(px: number, py: number): void {
    const held = this.host.held;
    const h = this.hit(px, py);
    this.preview?.clear();
    if (held) {
      this.host.tooltip.hide();
      if (h?.kind === 'slot') {
        const ok = equipCheck(held, h.slot).ok;
        const r = SLOT_RECTS[h.slot];
        this.preview?.fillStyle(ok ? 0x30ff50 : 0xff3030, 0.25).fillRect(r.x, r.y, r.w, r.h);
      } else if (h?.kind === 'grid') {
        const tl = this.topLeft(px, py, held);
        const inb = fitsGrid(GRID_W, GRID_H, tl.x, tl.y, held.w, held.h);
        const n = inb ? entriesAt(GameState.profile.inventory, tl.x, tl.y, held.w, held.h).length : 9;
        const x0 = Math.max(0, tl.x), y0 = Math.max(0, tl.y);
        const x1 = Math.min(GRID_W, tl.x + held.w), y1 = Math.min(GRID_H, tl.y + held.h);
        this.preview?.fillStyle(n <= 1 && inb ? (n === 1 ? 0x30a0ff : 0x30ff50) : 0xff3030, 0.25)
          .fillRect(this.gx + x0 * CELL, this.gy + y0 * CELL, (x1 - x0) * CELL, (y1 - y0) * CELL);
      }
      return;
    }
    let item: Item | undefined;
    if (h?.kind === 'slot') item = GameState.profile.equipment[h.slot];
    else if (h?.kind === 'grid') item = h.entry?.item;
    if (item) this.host.tooltip.show(itemTooltip(item, { shop: this.host.shopIsOpen() ? 'sell' : null }), px, py);
    else this.host.tooltip.hide();
  }

  pointerDown(px: number, py: number, right: boolean): boolean {
    const h = this.hit(px, py);
    const p = GameState.profile;
    const host = this.host;
    if (!h) return true;
    if (right) {
      if (host.held) return true;
      if (h.kind === 'grid' && h.entry) {
        const it = h.entry.item;
        if (host.shopIsOpen() && sellValue(it) > 0) { this.sell(h.entry); return true; }
        if (it.potion) drinkFromInventory(h.entry);
        else equipFromInventory(h.entry);
      } else if (h.kind === 'slot' && p.equipment[h.slot]) {
        unequipToInventory(h.slot);
      }
      host.tooltip.hide();
      return true;
    }
    if (h.kind === 'grid') {
      if (!host.held) {
        if (!h.entry) return true;
        p.inventory.splice(p.inventory.indexOf(h.entry), 1);
        host.setHeld(h.entry.item);
        AudioManager.sfx('ui_click', { volume: 0.6 });
        EventBus.emit('inventory:changed');
      } else {
        const it = host.held;
        const tl = this.topLeft(px, py, it);
        if (!fitsGrid(GRID_W, GRID_H, tl.x, tl.y, it.w, it.h)) return true;
        const over = entriesAt(p.inventory, tl.x, tl.y, it.w, it.h);
        if (over.length > 1) { EventBus.emit('ui:toast', { text: 'No cabe ahí.', color: '#ff7060' }); return true; }
        if (over.length === 1) p.inventory.splice(p.inventory.indexOf(over[0]), 1);
        p.inventory.push({ item: it, x: tl.x, y: tl.y });
        host.setHeld(over.length ? over[0].item : null);
        AudioManager.sfx('ui_click', { volume: 0.6 });
        EventBus.emit('inventory:changed');
      }
    } else {
      const cur = p.equipment[h.slot];
      if (!host.held) {
        if (!cur) return true;
        delete p.equipment[h.slot];
        host.setHeld(cur);
        AudioManager.sfx('equip');
        EventBus.emit('equipment:changed');
        EventBus.emit('inventory:changed');
      } else {
        const r = equipFromHand(host.held, h.slot);
        if (!r.ok) EventBus.emit('ui:toast', { text: r.reason ?? 'No se puede equipar.', color: '#ff7060' });
        else host.setHeld(r.displaced);
        EventBus.emit('inventory:changed');
      }
    }
    return true;
  }

  private sell(e: InvEntry): void {
    const p = GameState.profile;
    p.inventory.splice(p.inventory.indexOf(e), 1);
    GameState.addGold(sellValue(e.item));
    AudioManager.sfx('gold_pickup');
    EventBus.emit('inventory:changed');
  }
}