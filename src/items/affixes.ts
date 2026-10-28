import type { StatModKey } from './types';
import type { ItemGroup } from './bases';

export interface ModRoll { k: StatModKey; min: number; max: number; cap?: number; }
export interface AffixDef {
  id: string;
  /** Prefix: adjective [masc, fem] placed after the noun. Suffix: full phrase ("del Enamorado"). */
  text: string | [string, string];
  kind: 'prefix' | 'suffix';
  groups: ItemGroup[];
  minLevel: number;
  mods: ModRoll[];
  weight: number;
}

const W: ItemGroup[] = ['weapon', 'caster'];
const A: ItemGroup[] = ['armor'];
const J: ItemGroup[] = ['jewelry'];
const ALL: ItemGroup[] = ['weapon', 'caster', 'armor', 'jewelry'];

const p = (id: string, m: string, f: string, groups: ItemGroup[], minLevel: number, mods: ModRoll[], weight = 10): AffixDef =>
  ({ id, text: [m, f], kind: 'prefix', groups, minLevel, mods, weight });
const s = (id: string, text: string, groups: ItemGroup[], minLevel: number, mods: ModRoll[], weight = 10): AffixDef =>
  ({ id, text, kind: 'suffix', groups, minLevel, mods, weight });
const r = (k: StatModKey, min: number, max: number, cap?: number): ModRoll => ({ k, min, max, cap });

export const AFFIXES: AffixDef[] = [
  // ----- prefixes
  p('cursi', 'Cursi', 'Cursi', W, 1, [r('damagePct', 8, 14, 80)]),
  p('afilado', 'Afilado', 'Afilada', W, 1, [r('damageMin', 1, 3), r('damageMax', 2, 5)]),
  p('apasionado', 'Apasionado', 'Apasionada', W, 8, [r('lifeSteal', 2, 4, 10)], 6),
  p('coqueto', 'Coqueto', 'Coqueta', ['weapon', 'caster', 'jewelry'], 4, [r('critChance', 3, 6, 25)]),
  p('agil', 'Ágil', 'Ágil', ['weapon', 'armor'], 5, [r('attackSpeed', 5, 10, 30)]),
  p('hechizado', 'Hechizado', 'Hechizada', ['caster', 'jewelry'], 5, [r('castSpeed', 5, 10, 30)]),
  p('celoso', 'Celoso', 'Celosa', W, 12, [r('damagePct', 18, 30, 120), r('critChance', 1, 3, 10)], 5),
  p('robusto', 'Robusto', 'Robusta', A, 1, [r('armor', 4, 9)]),
  p('acorazado', 'Acorazado', 'Acorazada', A, 10, [r('armor', 14, 26), r('life', 4, 9)], 6),
  p('fornido', 'Fornido', 'Fornida', ['armor', 'jewelry'], 2, [r('life', 6, 12)]),
  p('veloz', 'Veloz', 'Veloz', A, 6, [r('moveSpeed', 5, 10, 30)], 6),
  p('dorado', 'Dorado', 'Dorada', ['jewelry', 'armor'], 3, [r('goldFind', 12, 25, 120)]),
  p('afortunado', 'Afortunado', 'Afortunada', ['jewelry', 'armor'], 5, [r('magicFind', 8, 16, 60)], 7),
  p('mistico', 'Místico', 'Mística', ['caster', 'jewelry', 'armor'], 2, [r('mana', 5, 11)]),
  p('perfumado', 'Perfumado', 'Perfumada', ['armor', 'jewelry'], 7, [r('lifeRegen', 1, 3, 10), r('manaRegen', 1, 2, 8)], 6),
  // ----- suffixes
  s('enamorado', 'del Enamorado', ALL, 1, [r('life', 7, 14), r('lifeRegen', 1, 2, 8)]),
  s('serenata', 'de la Serenata', ['caster', 'jewelry', 'armor'], 3, [r('castSpeed', 6, 12, 30), r('mana', 5, 10)]),
  s('corazon_roto', 'del Corazón Roto', W, 6, [r('damagePct', 12, 22, 100), r('critChance', 2, 5, 20)], 7),
  s('galan', 'del Galán', ['weapon', 'armor', 'jewelry'], 2, [r('str', 2, 5), r('dex', 2, 5)]),
  s('poeta', 'del Poeta', ['caster', 'jewelry', 'armor'], 2, [r('ene', 2, 5), r('mana', 4, 9)]),
  s('rosa', 'de la Rosa', ALL, 1, [r('lifeRegen', 1, 3, 10)]),
  s('chocolate', 'del Chocolate Amargo', ['armor', 'jewelry'], 2, [r('coldRes', 8, 16, 60)]),
  s('pasion', 'de la Pasión Ardiente', ['armor', 'jewelry'], 2, [r('fireRes', 8, 16, 60)]),
  s('relampago', 'del Flechazo Fugaz', ['armor', 'jewelry'], 2, [r('lightRes', 8, 16, 60)]),
  s('cita_perfecta', 'de la Cita Perfecta', ['weapon', 'caster', 'jewelry'], 14, [r('allSkills', 1, 1, 2)], 2),
  s('suegra', 'de la Suegra Severa', A, 4, [r('armor', 10, 20), r('vit', 2, 4)]),
  s('ligon', 'del Ligón', ['armor', 'jewelry'], 6, [r('moveSpeed', 4, 8, 25), r('dex', 2, 4)], 6),
  s('tacano', 'del Tacaño', J, 3, [r('goldFind', 15, 35, 150)]),
  s('vampiro', 'del Vampiro Romántico', W, 10, [r('lifeSteal', 3, 6, 12)], 4),
  s('elefante', 'del Elefante Rosa', ['armor', 'jewelry'], 5, [r('vit', 3, 6), r('life', 5, 10)]),
  s('luna', 'de las Dos Lunas', J, 8, [r('magicFind', 10, 22, 70), r('mana', 4, 8)], 5),
];

export const RARE_WORD_A = ['Beso', 'Suspiro', 'Corazón', 'Rosa', 'Poema', 'Serenata', 'Capricho', 'Flechazo', 'Desdén', 'Anhelo', 'Rubor', 'Bochorno', 'Cotilleo'];
export const RARE_WORD_B = ['Fugaz', 'Eterno', 'Letal', 'Ardiente', 'Celoso', 'Imposible', 'Prohibido', 'Tímido', 'Desvergonzado', 'Cursi', 'Vengativo', 'Empalagoso'];

export interface UniqueDef {
  name: string; baseId: string; req: number;
  mods: Partial<Record<StatModKey, number>>;
  damage?: [number, number]; armor?: number; flavor: string;
}

export const UNIQUES: UniqueDef[] = [
  { name: 'La Espada del Primer Beso', baseId: 'espada_larga', req: 6, damage: [9, 15], mods: { lifeSteal: 5, critChance: 8, damagePct: 25 }, flavor: 'Nunca olvidarás cómo te tembló el pulso.' },
  { name: 'Hacha de la Ruptura Amistosa', baseId: 'hacha_lenador', req: 10, damage: [14, 26], mods: { damagePct: 45, str: 8, attackSpeed: 10 }, flavor: '"Podemos seguir siendo amigos", dijo antes del golpe.' },
  { name: 'Serenata Eterna', baseId: 'arco_largo', req: 12, damage: [13, 24], mods: { attackSpeed: 20, dex: 10 }, flavor: 'Se oye un laúd cada vez que dispara. Nadie sabe por qué.' },
  { name: 'Bastón del Poeta Maldito', baseId: 'baston_floreado', req: 14, damage: [6, 14], mods: { ene: 12, mana: 50, castSpeed: 15, allSkills: 1 }, flavor: 'Rima todo lo que mata. Mal.' },
  { name: 'Escudo Anti-Rechazo', baseId: 'escudo_heraldico', req: 10, armor: 40, mods: { fireRes: 20, coldRes: 20, lightRes: 20, life: 25 }, flavor: 'Rebota insultos, flores y tuits.' },
  { name: 'Yelmo del Galán Despeinado', baseId: 'yelmo_hierro', req: 12, armor: 30, mods: { vit: 10, magicFind: 25, lifeRegen: 4 }, flavor: 'Despeinado pero irresistible.' },
  { name: 'Anillo de Compromiso Dudoso', baseId: 'anillo_plata', req: 14, mods: { goldFind: 60, magicFind: 20, mana: 25, lifeSteal: 3 }, flavor: 'El diamante es de cristal. El sentimiento, casi.' },
  { name: 'Collar de la Primera Cita', baseId: 'amuleto_plata', req: 16, mods: { allSkills: 1, life: 40, manaRegen: 4, fireRes: 15 }, flavor: 'Huele a nervios y a colonia barata.' },
  { name: 'Botas de Huida Elegante', baseId: 'botas_baile', req: 14, armor: 24, mods: { moveSpeed: 25, dex: 8, coldRes: 15 }, flavor: 'Para cuando la suegra te descubre.' },
  { name: 'Traje de Gala Remendado', baseId: 'cota_malla', req: 18, armor: 90, mods: { life: 60, str: 10, vit: 8, lightRes: 25 }, flavor: 'Lo cosió la abuela. Con rabia.' },
];