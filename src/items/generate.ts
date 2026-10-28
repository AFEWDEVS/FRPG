import { GameState } from '../core/GameState';
import { AFFIXES, RARE_WORD_A, RARE_WORD_B, UNIQUES, type AffixDef, type UniqueDef } from './affixes';
import { BASES, BASE_BY_ID, type BaseDef, type ItemGroup } from './bases';
import type { Item, Rarity, StatModKey } from './types';

let counter = 0;
const uid = () => `it_${Date.now().toString(36)}_${(++counter).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const rint = (a: number, b: number) => Math.floor(rnd(a, b + 1));
const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

export const RARITY_ORDER: Rarity[] = ['normal', 'magic', 'rare', 'unique'];
const RARITY_MULT: Record<Rarity, number> = { normal: 1, magic: 2.5, rare: 6, unique: 16, quest: 1 };

function plural(w: string): string {
  if (/[aeiouáéíóú]$/i.test(w)) return w + 's';
  if (/z$/i.test(w)) return w.slice(0, -1) + 'ces';
  return w + 'es';
}

function adjective(a: AffixDef, base: BaseDef): string {
  const t = a.text as [string, string];
  const w = base.gender === 'm' ? t[0] : t[1];
  return base.plural ? plural(w) : w;
}

function weightedPick<T extends { weight: number }>(list: T[]): T | undefined {
  const total = list.reduce((s, x) => s + x.weight, 0);
  if (total <= 0) return undefined;
  let r = Math.random() * total;
  for (const x of list) { r -= x.weight; if (r <= 0) return x; }
  return list[list.length - 1];
}

function baseItem(base: BaseDef, ilvl: number, rarity: Rarity): Item {
  return {
    uid: uid(), baseId: base.id, name: base.name, rarity, type: base.type, slot: base.slot,
    icon: `icon_item_${base.type}`, w: base.w, h: base.h, ilvl, reqLevel: base.req,
    mods: { ...(base.mods ?? {}) }, damage: base.dmg ? [base.dmg[0], base.dmg[1]] : undefined, armor: base.armor,
    twoHanded: base.twoHanded, potion: base.potion, value: base.value,
  };
}

function rollMods(a: AffixDef, ilvl: number, into: Item['mods']): void {
  const s = 0.6 + ilvl / 25;
  for (const m of a.mods) {
    let v = Math.round(rnd(m.min, m.max) * s);
    if (m.cap !== undefined) v = Math.min(v, m.cap);
    v = Math.max(m.min > 0 ? 1 : 0, v);
    into[m.k] = (into[m.k] ?? 0) + v;
  }
}

function eligible(kind: 'prefix' | 'suffix', base: BaseDef, ilvl: number, used: Set<StatModKey>, usedIds: Set<string>): AffixDef[] {
  return AFFIXES.filter((a) => a.kind === kind && a.groups.includes(base.group) && a.minLevel <= ilvl && !usedIds.has(a.id) && !a.mods.some((m) => used.has(m.k)));
}

function applyAffixes(it: Item, base: BaseDef, ilvl: number, nPre: number, nSuf: number): { pre: AffixDef[]; suf: AffixDef[] } {
  const used = new Set<StatModKey>(Object.keys(it.mods) as StatModKey[]);
  const usedIds = new Set<string>();
  const out = { pre: [] as AffixDef[], suf: [] as AffixDef[] };
  const add = (kind: 'prefix' | 'suffix', n: number, arr: AffixDef[]) => {
    for (let i = 0; i < n; i++) {
      const a = weightedPick(eligible(kind, base, ilvl, used, usedIds));
      if (!a) break;
      usedIds.add(a.id);
      a.mods.forEach((m) => used.add(m.k));
      rollMods(a, ilvl, it.mods);
      arr.push(a);
    }
  };
  add('prefix', nPre, out.pre);
  add('suffix', nSuf, out.suf);
  return out;
}

export function makeBaseItem(baseId: string, ilvl = 1): Item {
  return baseItem(BASE_BY_ID[baseId], ilvl, 'normal');
}

/** Roll a non-unique item of a given base and rarity ('normal' | 'magic' | 'rare'). */
export function makeItem(base: BaseDef, ilvl: number, rarity: Rarity): Item {
  const it = baseItem(base, ilvl, rarity);
  if (rarity === 'normal' || base.group === 'potion') return it;
  let nPre = 0, nSuf = 0;
  if (rarity === 'magic') {
    const r = Math.random();
    if (r < 0.35) nPre = 1; else if (r < 0.7) nSuf = 1; else { nPre = 1; nSuf = 1; }
  } else {
    const total = rint(3, ilvl >= 12 ? 5 : 4);
    nPre = Math.min(3, Math.ceil(total / 2));
    nSuf = Math.min(3, total - nPre);
  }
  const got = applyAffixes(it, base, ilvl, nPre, nSuf);
  const maxMin = Math.max(0, ...got.pre.concat(got.suf).map((a) => a.minLevel));
  it.reqLevel = base.req + Math.floor(maxMin / 3);
  const nAff = got.pre.length + got.suf.length;
  if (rarity === 'magic') {
    it.name = [base.name, got.pre[0] ? adjective(got.pre[0], base) : '', got.suf[0]?.text as string ?? ''].filter(Boolean).join(' ');
  } else {
    it.name = `${pick(RARE_WORD_A)} ${pick(RARE_WORD_B)}`;
  }
  it.value = Math.round((base.value * RARITY_MULT[rarity] + nAff * 25) * (1 + ilvl / 25));
  return it;
}

export function makeUnique(def: UniqueDef, ilvl?: number): Item {
  const base = BASE_BY_ID[def.baseId];
  const it = baseItem(base, ilvl ?? def.req, 'unique');
  it.name = def.name;
  it.reqLevel = def.req;
  it.mods = { ...(base.mods ?? {}), ...def.mods };
  if (def.damage) it.damage = [def.damage[0], def.damage[1]];
  if (def.armor !== undefined) it.armor = def.armor;
  it.value = Math.round(base.value * RARITY_MULT.unique + 200);
  return it;
}

export function uniqueFlavor(item: Item): string | undefined {
  return item.rarity === 'unique' ? UNIQUES.find((u) => u.name === item.name)?.flavor : undefined;
}

export function potionTier(level: number): number { return level < 8 ? 1 : level < 18 ? 2 : level < 28 ? 3 : 4; }

export function makePotion(kind: 'health' | 'mana', tier = 1): Item {
  const id = `pocion_${kind === 'health' ? 'vida' : 'mana'}_${Math.max(1, Math.min(4, tier))}`;
  return baseItem(BASE_BY_ID[id], 1, 'normal');
}

function pickBase(ilvl: number, group?: ItemGroup): BaseDef {
  const cls = GameState.hasProfile ? GameState.profile.classId : undefined;
  let c = BASES.filter((b) => b.group !== 'potion' && b.req <= ilvl + 2 && (!group || b.group === group));
  if (!c.length) c = BASES.filter((b) => b.group !== 'potion' && b.req <= 1);
  const w = c.map((b) => ({ b, weight: (1 + (b.req + 1) / (ilvl + 1) * 3) * (b.hint && b.hint === cls ? 2 : b.hint && b.group !== 'armor' ? 0.5 : 1) }));
  return weightedPick(w)!.b;
}

export interface GenOptions { ilvl: number; mf?: number; rarity?: Rarity; minRarity?: Rarity; group?: ItemGroup; bonus?: number; noUnique?: boolean; }

export function generateItem(o: GenOptions): Item {
  const ilvl = Math.max(1, Math.round(o.ilvl));
  const mf = 1 + (o.mf ?? 0) / 100;
  const bonus = o.bonus ?? 1;
  let rarity: Rarity = o.rarity ?? 'normal';
  if (!o.rarity) {
    const r = Math.random() * 100;
    const pu = o.noUnique ? 0 : 0.8 * mf * bonus, pr = 6 * mf * bonus, pm = 24 * mf * bonus;
    rarity = r < pu ? 'unique' : r < pu + pr ? 'rare' : r < pu + pr + pm ? 'magic' : 'normal';
    if (o.minRarity && RARITY_ORDER.indexOf(rarity) < RARITY_ORDER.indexOf(o.minRarity)) rarity = o.minRarity;
  }
  if (rarity === 'unique') {
    const pool = UNIQUES.filter((u) => u.req <= ilvl + 3 && (!o.group || BASE_BY_ID[u.baseId].group === o.group));
    if (pool.length) return makeUnique(pick(pool), Math.max(ilvl, pool[0].req));
    rarity = 'rare';
  }
  return makeItem(pickBase(ilvl, o.group), ilvl, rarity === 'quest' ? 'normal' : rarity);
}

export type DropKind = 'normal' | 'champion' | 'boss' | 'chest';

/** Roll the loot for a monster / chest. */
export function rollDrops(level: number, kind: DropKind, mf = 0, gf = 0): { gold: number; items: Item[] } {
  const items: Item[] = [];
  let gold = 0;
  const g = (mult: number) => Math.round(rnd(0.7, 1.3) * (4 + level * 3.5) * mult * (1 + gf / 100));
  const gen = (extra: Partial<GenOptions>) => generateItem({ ilvl: level, mf, ...extra });
  const potion = () => makePotion(Math.random() < 0.6 ? 'health' : 'mana', potionTier(level));
  switch (kind) {
    case 'normal':
      if (Math.random() < 0.5) gold = g(1);
      if (Math.random() < 0.2) items.push(gen({}));
      if (Math.random() < 0.1) items.push(potion());
      break;
    case 'champion':
      gold = g(3);
      for (let i = rint(1, 2); i > 0; i--) items.push(gen({ ilvl: level + 1, minRarity: 'magic', bonus: 1.6 }));
      if (Math.random() < 0.35) items.push(potion());
      break;
    case 'boss':
      gold = g(10);
      for (let i = rint(3, 4); i > 0; i--) items.push(gen({ ilvl: level + 2, minRarity: 'rare', bonus: 3 }));
      if (Math.random() < 0.3) items.push(gen({ ilvl: level + 2, rarity: 'unique' }));
      items.push(potion(), potion());
      break;
    case 'chest':
      if (Math.random() < 0.7) gold = g(2);
      for (let i = rint(1, 2); i > 0; i--) items.push(gen({ bonus: 1.3 }));
      if (Math.random() < 0.45) items.push(potion());
      break;
  }
  return { gold, items };
}

// ------------------------------------------------------------ quest items

export type QuestItemKind = 'letter_page' | 'rose_bouquet' | 'amulet_quest';
const QUEST_DEF: Record<QuestItemKind, { name: string; questId: string; w: number; h: number }> = {
  letter_page: { name: 'Página de la Carta', questId: 'q_letter', w: 1, h: 1 },
  rose_bouquet: { name: 'Ramo de Rosas Maldito', questId: 'q_bouquet', w: 1, h: 2 },
  amulet_quest: { name: 'Amuleto Anticelos', questId: 'q_amulet', w: 1, h: 1 },
};

/** Build a quest item. `label` is appended to the name (e.g. "1/3"); `questId` overrides the default. */
export function createQuestItem(kind: QuestItemKind, label?: string, questId?: string): Item {
  const d = QUEST_DEF[kind];
  return {
    uid: uid(), baseId: kind, name: label ? `${d.name} (${label})` : d.name, rarity: 'quest', type: kind, slot: 'quest',
    icon: `icon_item_${kind}`, w: d.w, h: d.h, ilvl: 1, reqLevel: 1, mods: {}, questId: questId ?? d.questId, value: 0,
  };
}