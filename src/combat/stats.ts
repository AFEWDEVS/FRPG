import { CLASSES } from '../data/classes';
import type { ClassId } from '../core/types';
import type { StatModKey } from '../items/types';

/** Minimal slice of the player profile the stat math needs (keeps this module free of GameState imports). */
export interface StatSource {
  classId: ClassId;
  level: number;
  stats: { str: number; dex: number; vit: number; ene: number };
  equipment: Partial<Record<string, unknown>>;
}

export interface DerivedStats {
  str: number; dex: number; vit: number; ene: number;
  maxLife: number; maxMana: number;
  damageMin: number; damageMax: number;
  armor: number;
  attackSpeed: number; castSpeed: number; moveSpeed: number;
  fireRes: number; coldRes: number; lightRes: number;
  critChance: number; critMult: number;
  lifeRegen: number; manaRegen: number; lifeSteal: number;
  magicFind: number; goldFind: number;
  allSkills: number;
}

export const RES_CAP = 75;

type Mods = Partial<Record<StatModKey, number>>;
interface ItemLike { mods?: Mods; damage?: [number, number]; armor?: number }

/** Sums the `mods` of every equipped item plus weapon damage and armor. */
export function equipmentTotals(equipment: Partial<Record<string, unknown>>): { mods: Mods; weapon?: [number, number]; armor: number } {
  const mods: Mods = {};
  let weapon: [number, number] | undefined;
  let armor = 0;
  for (const [slot, raw] of Object.entries(equipment)) {
    const it = raw as ItemLike | undefined;
    if (!it) continue;
    if (it.mods) for (const [k, v] of Object.entries(it.mods)) mods[k as StatModKey] = (mods[k as StatModKey] ?? 0) + (v ?? 0);
    if (it.armor) armor += it.armor;
    if (slot === 'weapon' && it.damage) weapon = it.damage;
  }
  return { mods, weapon, armor };
}

/** D2-like derived stats: class base + attributes + equipment. Pure function: call it whenever the UI needs numbers. */
export function computeDerived(src: StatSource): DerivedStats {
  const c = CLASSES[src.classId];
  const eq = equipmentTotals(src.equipment);
  const m = (k: StatModKey) => eq.mods[k] ?? 0;
  const str = src.stats.str + m('str'), dex = src.stats.dex + m('dex'), vit = src.stats.vit + m('vit'), ene = src.stats.ene + m('ene');
  const lvl = src.level;

  const maxLife = Math.round(40 + vit * c.lifePerVit + (lvl - 1) * 6 + m('life'));
  const maxMana = Math.round(10 + ene * c.manaPerEne + (lvl - 1) * 2 + m('mana'));

  const [bMin, bMax] = eq.weapon ?? c.baseDamage;
  const primary = c.primary === 'str' ? str : c.primary === 'dex' ? dex : ene;
  const mult = (1 + primary * 0.01 + (c.primary !== 'str' ? str * 0.002 : dex * 0.004)) * (1 + m('damagePct') / 100) * (1 + (lvl - 1) * 0.04);
  const damageMin = Math.max(1, (bMin + m('damageMin')) * mult);
  const damageMax = Math.max(damageMin + 1, (bMax + m('damageMax')) * mult);

  return {
    str, dex, vit, ene, maxLife, maxMana,
    damageMin, damageMax,
    armor: Math.round(eq.armor + m('armor') + dex * 0.5),
    attackSpeed: 1 + m('attackSpeed') / 100,
    castSpeed: 1 + m('castSpeed') / 100,
    moveSpeed: 1 + m('moveSpeed') / 100,
    fireRes: Math.min(RES_CAP, m('fireRes')),
    coldRes: Math.min(RES_CAP, m('coldRes')),
    lightRes: Math.min(RES_CAP, m('lightRes')),
    critChance: Math.min(60, 5 + dex * 0.04 + m('critChance')),
    critMult: 1.75,
    lifeRegen: 0.4 + vit * 0.01 + m('lifeRegen'),
    manaRegen: 0.8 + ene * 0.03 + m('manaRegen'),
    lifeSteal: m('lifeSteal'),
    magicFind: m('magicFind'),
    goldFind: m('goldFind'),
    allSkills: m('allSkills'),
  };
}

/** Label/value rows for a character panel. */
export function statRows(d: DerivedStats): { label: string; value: string }[] {
  const f = (n: number) => String(Math.round(n));
  return [
    { label: 'Fuerza', value: f(d.str) }, { label: 'Destreza', value: f(d.dex) },
    { label: 'Vitalidad', value: f(d.vit) }, { label: 'Energía', value: f(d.ene) },
    { label: 'Vida', value: f(d.maxLife) }, { label: 'Maná', value: f(d.maxMana) },
    { label: 'Daño', value: `${f(d.damageMin)}-${f(d.damageMax)}` },
    { label: 'Armadura', value: f(d.armor) },
    { label: 'Vel. de ataque', value: `${f(d.attackSpeed * 100)}%` },
    { label: 'Vel. de lanzamiento', value: `${f(d.castSpeed * 100)}%` },
    { label: 'Vel. de movimiento', value: `${f(d.moveSpeed * 100)}%` },
    { label: 'Prob. crítico', value: `${d.critChance.toFixed(1)}%` },
    { label: 'Res. fuego', value: `${f(d.fireRes)}%` }, { label: 'Res. frío', value: `${f(d.coldRes)}%` }, { label: 'Res. rayo', value: `${f(d.lightRes)}%` },
    { label: 'Regen. vida', value: `${d.lifeRegen.toFixed(1)}/s` }, { label: 'Regen. maná', value: `${d.manaRegen.toFixed(1)}/s` },
    { label: 'Robo de vida', value: `${f(d.lifeSteal)}%` },
  ];
}

/** XP needed to go from `level` to `level + 1`. Same curve as GameState.xpForLevel. */
export function xpToNext(level: number): number { return Math.floor(60 * Math.pow(level, 1.6)); }
export const STAT_POINTS_PER_LEVEL = 5;
export const SKILL_POINTS_PER_LEVEL = 1;