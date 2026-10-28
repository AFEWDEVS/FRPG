import { GameState } from '../core/GameState';
import { RARITY_COLOR } from '../data/items';
import { BASE_BY_ID } from './bases';
import { uniqueFlavor } from './generate';
import { buyPrice, sellValue } from './inventory';
import type { Item, StatModKey } from './types';

export interface TipLine { text: string; color?: string; size?: number; italic?: boolean; }

export const MOD_FMT: Record<StatModKey, (v: number) => string> = {
  damageMin: (v) => `+${v} al daño mínimo`,
  damageMax: (v) => `+${v} al daño máximo`,
  damagePct: (v) => `+${v}% de daño`,
  armor: (v) => `+${v} de armadura`,
  life: (v) => `+${v} de vida`,
  mana: (v) => `+${v} de maná`,
  str: (v) => `+${v} a Fuerza`,
  dex: (v) => `+${v} a Destreza`,
  vit: (v) => `+${v} a Vitalidad`,
  ene: (v) => `+${v} a Energía`,
  attackSpeed: (v) => `+${v}% velocidad de ataque`,
  castSpeed: (v) => `+${v}% velocidad de lanzamiento`,
  moveSpeed: (v) => `+${v}% velocidad de movimiento`,
  fireRes: (v) => `Resistencia al fuego +${v}%`,
  coldRes: (v) => `Resistencia al frío +${v}%`,
  lightRes: (v) => `Resistencia al rayo +${v}%`,
  lifeSteal: (v) => `${v}% del daño robado como vida`,
  manaRegen: (v) => `+${v} regeneración de maná`,
  lifeRegen: (v) => `+${v} regeneración de vida`,
  critChance: (v) => `+${v}% probabilidad de crítico`,
  magicFind: (v) => `+${v}% a objetos mágicos`,
  goldFind: (v) => `+${v}% al oro encontrado`,
  allSkills: (v) => `+${v} a todas las habilidades`,
};

export const MOD_COLOR = '#8f8fff';

export function modLines(item: Item): TipLine[] {
  const out: TipLine[] = [];
  for (const [k, v] of Object.entries(item.mods) as [StatModKey, number][]) {
    if (!v) continue;
    if (item.potion) continue;
    out.push({ text: MOD_FMT[k](v), color: MOD_COLOR });
  }
  return out;
}

export interface TipCtx { shop?: 'buy' | 'sell' | null; }

export function itemTooltip(item: Item, ctx: TipCtx = {}): TipLine[] {
  const lines: TipLine[] = [];
  const col = RARITY_COLOR[item.rarity];
  lines.push({ text: item.name, color: col, size: 17 });
  const base = BASE_BY_ID[item.baseId];
  if (base && (item.rarity === 'magic' || item.rarity === 'rare' || item.rarity === 'unique') && base.name !== item.name) {
    lines.push({ text: base.name, color: item.rarity === 'unique' ? col : '#cfcfcf', size: 14 });
  }
  if (item.rarity === 'quest') lines.push({ text: 'Objeto de misión', color: col });
  if (item.potion) {
    const v = item.potion === 'health' ? item.mods.life : item.mods.mana;
    lines.push({ text: item.potion === 'health' ? `Restaura ${v} de vida` : `Restaura ${v} de maná`, color: MOD_COLOR });
    lines.push({ text: 'Clic derecho para beber', color: '#8a7a60', size: 12 });
  }
  if (item.damage) lines.push({ text: `Daño: ${item.damage[0]} - ${item.damage[1]}`, color: '#ffffff' });
  if (item.twoHanded) lines.push({ text: 'A dos manos', color: '#bbbbbb', size: 13 });
  if (item.armor) lines.push({ text: `Armadura: ${item.armor}`, color: '#ffffff' });
  if (item.reqLevel > 1 && !item.potion || (item.potion && item.reqLevel > 1)) {
    const ok = GameState.hasProfile && GameState.profile.level >= item.reqLevel;
    lines.push({ text: `Requiere nivel ${item.reqLevel}`, color: ok ? '#bbbbbb' : '#ff4040', size: 13 });
  }
  if (!item.potion) lines.push(...modLines(item));
  const fl = uniqueFlavor(item);
  if (fl) lines.push({ text: fl, color: '#a08a58', size: 12, italic: true });
  if (ctx.shop === 'buy') {
    const price = buyPrice(item);
    const ok = GameState.hasProfile && GameState.profile.gold >= price;
    lines.push({ text: `Precio: ${price} oro`, color: ok ? '#ffd24a' : '#ff4040' });
  } else if (ctx.shop === 'sell') {
    const v = sellValue(item);
    lines.push({ text: v > 0 ? `Vender: ${v} oro` : 'No se puede vender', color: v > 0 ? '#ffd24a' : '#ff4040' });
  }
  return lines;
}