import { AudioManager } from '../../audio/AudioManager';
import { EventBus } from '../../core/EventBus';
import { GameState } from '../../core/GameState';
import { itemTooltip } from '../../items/format';
import { generateItem, makeBaseItem, makePotion, potionTier } from '../../items/generate';
import { GRID_H, GRID_W, addItem, addToGrid, buyPrice, sellValue, type InvEntry } from '../../items/inventory';
import type { ItemGroup } from '../../items/bases';
import { Panel, type UiHost } from '../Panel';
import { CELL, COL, itemBox, itemIcon } from '../theme';

const SHOP_H = 8;

export class ShopPanel extends Panel {
  private stock: InvEntry[] = [];
  private stockLevel = -1;
  merchantName = 'Gertrudis';

  constructor(host: UiHost) { super(host, 'shop', 420, 520, 'left', 'Gertrudis - Mercancía'); }

  /** Ensure stock is fresh for the hero level, then show the panel. */
  openShop(): void {
    const lvl = GameState.profile.level;
    if (this.stockLevel !== lvl) this.restock(lvl);
    if (!this.isOpen) this.open(); else this.refresh();
  }

  restock(lvl: number): void {
    this.stockLevel = lvl;
    this.stock = [];
    const t = potionTier(lvl);
    for (const tier of new Set([Math.max(1, t - 1), t])) {
      this.stock.push({ item: makePotion('health', tier), x: this.stock.length % GRID_W, y: 0 });
      this.stock.push({ item: makePotion('mana', tier), x: this.stock.length % GRID_W, y: 0 });
    }
    const groups: (ItemGroup | undefined)[] = ['weapon', 'weapon', 'caster', 'armor', 'armor', 'armor', 'armor', 'armor', 'jewelry', 'jewelry', 'weapon', undefined];
    for (const group of groups) {
      const it = generateItem({ ilvl: lvl + 1, group, noUnique: true, bonus: 1.4 });
      addToGrid(this.stock, GRID_W, SHOP_H, it);
    }
    // grid insert for the potions uses row 0; re-place the generated ones around them
  }

  protected build(): void {
    const s = this.host;
    const gx = 30, gy = 58;
    const g = this.add(s.add.graphics());
    g.fillStyle(0x0a0706, 0.7).fillRect(gx, gy, GRID_W * CELL, SHOP_H * CELL).lineStyle(1, 0x3a2e22, 1);
    for (let i = 0; i <= GRID_W; i++) g.lineBetween(gx + i * CELL, gy, gx + i * CELL, gy + SHOP_H * CELL);
    for (let j = 0; j <= SHOP_H; j++) g.lineBetween(gx, gy + j * CELL, gx + GRID_W * CELL, gy + j * CELL);
    g.lineStyle(2, 0x6a5a40, 1).strokeRect(gx, gy, GRID_W * CELL, SHOP_H * CELL);
    for (const e of this.stock) {
      const x = gx + e.x * CELL, y = gy + e.y * CELL, w = e.item.w * CELL, h = e.item.h * CELL;
      const gg = this.add(s.add.graphics());
      itemBox(s, gg, e.item, x, y, w, h);
      this.add(itemIcon(s, e.item, x + w / 2, y + h / 2, w, h));
    }
    this.text(30, 360, `Oro: ${GameState.profile.gold}`, 17, '#ffd24a');
    const t = this.text(30, 392, 'Clic en un objeto para comprarlo.\nSuelta un objeto aquí, o usa clic derecho en tu inventario, para venderlo.', 13, COL.dim);
    t.setWordWrapWidth(this.w - 60);
    this.button(this.w / 2 - 80, 462, 160, 34, 'Despedirse', () => this.close(), true, 16);
  }

  private entryAt(px: number, py: number): InvEntry | undefined {
    const lx = px - this.x - 30, ly = py - this.y - 58;
    if (lx < 0 || ly < 0) return undefined;
    const cx = Math.floor(lx / CELL), cy = Math.floor(ly / CELL);
    return this.stock.find((e) => cx >= e.x && cx < e.x + e.item.w && cy >= e.y && cy < e.y + e.item.h);
  }

  pointerMove(px: number, py: number): void {
    if (this.host.held) {
      const v = sellValue(this.host.held);
      this.host.tooltip.show([{ text: v > 0 ? `Vender por ${v} oro` : 'No se puede vender', color: v > 0 ? '#ffd24a' : '#ff4040' }], px, py);
      return;
    }
    const e = this.entryAt(px, py);
    if (e) this.host.tooltip.show(itemTooltip(e.item, { shop: 'buy' }), px, py); else this.host.tooltip.hide();
  }

  pointerDown(px: number, py: number): boolean {
    const host = this.host;
    if (host.held) {
      const v = sellValue(host.held);
      if (v <= 0) { EventBus.emit('ui:toast', { text: 'Nadie quiere eso.', color: '#ff7060' }); return true; }
      GameState.addGold(v);
      AudioManager.sfx('gold_pickup');
      host.setHeld(null);
      this.refresh();
      return true;
    }
    const e = this.entryAt(px, py);
    if (!e) return true;
    const price = buyPrice(e.item);
    if (GameState.profile.gold < price) { EventBus.emit('ui:toast', { text: 'No tienes suficiente oro.', color: '#ff7060' }); return true; }
    const infinite = !!e.item.potion;
    const bought = infinite ? makeBaseItem(e.item.baseId, e.item.ilvl) : e.item;
    if (!addItem(bought)) { EventBus.emit('ui:toast', { text: 'Inventario lleno.', color: '#ff7060' }); return true; }
    GameState.profile.gold -= price;
    EventBus.emit('player:gold', { gold: GameState.profile.gold });
    if (!infinite) this.stock.splice(this.stock.indexOf(e), 1);
    AudioManager.sfx('gold_pickup');
    AudioManager.sfx('item_pickup', { delay: 0.05 });
    host.tooltip.hide();
    EventBus.emit('inventory:changed');
    this.refresh();
    return true;
  }
}

void GRID_H;