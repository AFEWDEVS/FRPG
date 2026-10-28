import { AudioManager } from '../audio/AudioManager';
import { EventBus } from '../core/EventBus';
import { GameState } from '../core/GameState';
import type { EquipSlot, Item, StatModKey } from './types';

export const GRID_W = 10;
export const GRID_H = 4;
export const BELT_SIZE = 4;

export interface InvEntry { item: Item; x: number; y: number; }

const toast = (text: string, color?: string) => EventBus.emit('ui:toast', { text, color });
const changed = () => EventBus.emit('inventory:changed');

// ------------------------------------------------------------ grid helpers

export function entriesAt(entries: InvEntry[], x: number, y: number, w: number, h: number, ignore?: InvEntry): InvEntry[] {
  return entries.filter((e) => e !== ignore && e.x < x + w && e.x + e.item.w > x && e.y < y + h && e.y + e.item.h > y);
}
export function fitsGrid(gw: number, gh: number, x: number, y: number, w: number, h: number): boolean {
  return x >= 0 && y >= 0 && x + w <= gw && y + h <= gh;
}
export function findSpace(entries: InvEntry[], gw: number, gh: number, w: number, h: number): { x: number; y: number } | null {
  for (let y = 0; y + h <= gh; y++) for (let x = 0; x + w <= gw; x++) {
    if (entriesAt(entries, x, y, w, h).length === 0) return { x, y };
  }
  return null;
}
export function addToGrid(entries: InvEntry[], gw: number, gh: number, item: Item): boolean {
  const s = findSpace(entries, gw, gh, item.w, item.h);
  if (!s) return false;
  entries.push({ item, x: s.x, y: s.y });
  return true;
}

// ------------------------------------------------------------ prices

export const sellValue = (item: Item): number => (item.rarity === 'quest' ? 0 : Math.max(1, Math.floor(item.value)));
export const buyPrice = (item: Item): number => Math.max(1, Math.round(item.value * (item.potion ? 3 : 4)));

// ------------------------------------------------------------ equipment

export function slotsFor(item: Item): EquipSlot[] {
  if (!item.slot || item.slot === 'potion' || item.slot === 'quest') return [];
  if (item.slot === 'ring1' || item.slot === 'ring2') return ['ring1', 'ring2'];
  return [item.slot];
}

export function equipCheck(item: Item, slot: EquipSlot): { ok: boolean; reason?: string } {
  if (!slotsFor(item).includes(slot)) return { ok: false, reason: 'No va en esa ranura.' };
  if (GameState.profile.level < item.reqLevel) return { ok: false, reason: `Requiere nivel ${item.reqLevel}.` };
  const eq = GameState.profile.equipment;
  if (slot === 'offhand' && eq.weapon?.twoHanded) return { ok: false, reason: 'Llevas un arma a dos manos.' };
  return { ok: true };
}

/**
 * Put `item` (held in hand) into `slot`. Returns the displaced item to put back in hand (or null).
 * A two-handed weapon pushes the offhand item into the grid.
 */
export function equipFromHand(item: Item, slot: EquipSlot): { ok: boolean; displaced: Item | null; reason?: string } {
  const c = equipCheck(item, slot);
  if (!c.ok) return { ok: false, displaced: null, reason: c.reason };
  const p = GameState.profile;
  if (slot === 'weapon' && item.twoHanded && p.equipment.offhand) {
    const off = p.equipment.offhand;
    if (!addToGrid(p.inventory, GRID_W, GRID_H, off)) return { ok: false, displaced: null, reason: 'No hay sitio para la mano izquierda.' };
    delete p.equipment.offhand;
  }
  const displaced = p.equipment[slot] ?? null;
  p.equipment[slot] = item;
  AudioManager.sfx('equip');
  EventBus.emit('equipment:changed');
  changed();
  return { ok: true, displaced };
}

/** Right-click equip of a grid entry: best slot, swapping the old gear into the freed space. */
export function equipFromInventory(entry: InvEntry): boolean {
  const p = GameState.profile;
  const slots = slotsFor(entry.item);
  if (!slots.length) return false;
  const slot = slots.find((s) => !p.equipment[s]) ?? slots[0];
  const chk = equipCheck(entry.item, slot);
  if (!chk.ok) { toast(chk.reason!, '#ff7060'); return false; }
  const idx = p.inventory.indexOf(entry);
  p.inventory.splice(idx, 1);
  const r = equipFromHand(entry.item, slot);
  if (!r.ok) { p.inventory.push(entry); toast(r.reason ?? 'No se puede equipar.', '#ff7060'); return false; }
  if (r.displaced && !addToGrid(p.inventory, GRID_W, GRID_H, r.displaced)) {
    // no room: undo
    p.equipment[slot] = r.displaced;
    p.inventory.push(entry);
    toast('Inventario lleno.', '#ff7060');
    EventBus.emit('equipment:changed');
    changed();
    return false;
  }
  changed();
  return true;
}

export function unequipToInventory(slot: EquipSlot): boolean {
  const p = GameState.profile;
  const it = p.equipment[slot];
  if (!it) return false;
  if (!addToGrid(p.inventory, GRID_W, GRID_H, it)) { toast('Inventario lleno.', '#ff7060'); return false; }
  delete p.equipment[slot];
  AudioManager.sfx('equip');
  EventBus.emit('equipment:changed');
  changed();
  return true;
}

/** Sum of everything worn. Combat's computeDerived can use this. */
export function gearBonuses(): { mods: Partial<Record<StatModKey, number>>; damage: [number, number]; armor: number } {
  const mods: Partial<Record<StatModKey, number>> = {};
  let dmin = 0, dmax = 0, armor = 0;
  if (!GameState.hasProfile) return { mods, damage: [0, 0], armor: 0 };
  for (const [slot, it] of Object.entries(GameState.profile.equipment) as [EquipSlot, Item | undefined][]) {
    if (!it) continue;
    for (const [k, v] of Object.entries(it.mods) as [StatModKey, number][]) mods[k] = (mods[k] ?? 0) + v;
    if (it.armor) armor += it.armor;
    if (slot === 'weapon' && it.damage) { dmin += it.damage[0]; dmax += it.damage[1]; }
  }
  armor += mods.armor ?? 0;
  dmin += mods.damageMin ?? 0;
  dmax += mods.damageMax ?? 0;
  return { mods, damage: [dmin, Math.max(dmin, dmax)], armor };
}

// ------------------------------------------------------------ pickup / give

let groundDropper: ((item: Item) => void) | null = null;
/** LootManager registers itself so overflow items fall at the hero's feet. */
export function setGroundDropper(fn: ((item: Item) => void) | null): void { groundDropper = fn; }

/** Put an item in the belt (potions) or the grid. Returns false when there is no room. */
export function addItem(item: Item): boolean {
  const p = GameState.profile;
  if (item.potion) {
    const i = p.belt.findIndex((b) => !b);
    if (i >= 0) { p.belt[i] = item; changed(); return true; }
  }
  if (!addToGrid(p.inventory, GRID_W, GRID_H, item)) return false;
  changed();
  return true;
}

/** Quest API: grant an item (falls to the floor if the bag is full). Shows a toast. */
export function giveItem(item: Item): void {
  if (!addItem(item)) {
    groundDropper?.(item);
    toast('Inventario lleno: el objeto cae al suelo.', '#ff7060');
  } else {
    AudioManager.sfx('item_pickup');
    toast(`Obtienes: ${item.name}`, item.rarity === 'quest' ? '#ff9a28' : undefined);
  }
  GameState.save();
}

function allItems(): Item[] {
  const p = GameState.profile;
  return [...p.inventory.map((e) => e.item), ...Object.values(p.equipment).filter(Boolean) as Item[], ...p.belt.filter(Boolean) as Item[]];
}
export function countQuestItems(questId: string): number {
  return GameState.hasProfile ? allItems().filter((i) => i.questId === questId).length : 0;
}
export function hasQuestItem(questId: string): boolean { return countQuestItems(questId) > 0; }
/** Remove up to n items of a quest (default all). Returns how many were removed. */
export function removeQuestItem(questId: string, n = 99): number {
  const p = GameState.profile;
  let left = n, removed = 0;
  for (let i = p.inventory.length - 1; i >= 0 && left > 0; i--) {
    if (p.inventory[i].item.questId === questId) { p.inventory.splice(i, 1); left--; removed++; }
  }
  for (let i = 0; i < p.belt.length && left > 0; i++) {
    if (p.belt[i]?.questId === questId) { p.belt[i] = null; left--; removed++; }
  }
  if (removed) changed();
  return removed;
}

// ------------------------------------------------------------ potions

/** Apply a potion; returns false when it would be wasted. */
export function applyPotion(item: Item): boolean {
  if (!item.potion) return false;
  const gs = GameState;
  if (item.potion === 'health') {
    if (gs.life >= gs.maxLife) { toast('Ya tienes la vida completa.'); return false; }
    gs.life = Math.min(gs.maxLife, gs.life + (item.mods.life ?? 40));
  } else {
    if (gs.mana >= gs.maxMana) { toast('Ya tienes el maná completo.'); return false; }
    gs.mana = Math.min(gs.maxMana, gs.mana + (item.mods.mana ?? 25));
  }
  gs.emitVitals();
  AudioManager.sfx('potion_drink');
  return true;
}

export function useBelt(i: number): boolean {
  const p = GameState.profile;
  const it = p.belt[i];
  if (!it) return false;
  if (!applyPotion(it)) return false;
  p.belt[i] = null;
  changed();
  return true;
}

export function drinkFromInventory(entry: InvEntry): boolean {
  if (!applyPotion(entry.item)) return false;
  const p = GameState.profile;
  p.inventory.splice(p.inventory.indexOf(entry), 1);
  changed();
  return true;
}

export function dropOnGround(item: Item, gx: number, gy: number): void {
  AudioManager.sfx('drop_item');
  EventBus.emit('loot:drop', { item, gx, gy });
}