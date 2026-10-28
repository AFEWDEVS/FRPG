import type { EquipSlot, StatModKey } from './types';

export type ItemGroup = 'weapon' | 'caster' | 'armor' | 'jewelry' | 'potion';
export type ClassHint = 'knight' | 'mage' | 'ranger';

export interface BaseDef {
  id: string; name: string; gender: 'm' | 'f'; plural?: boolean;
  type: string; slot: EquipSlot | 'potion'; w: number; h: number; req: number;
  dmg?: [number, number]; armor?: number; twoHanded?: boolean; value: number; group: ItemGroup;
  mods?: Partial<Record<StatModKey, number>>; potion?: 'health' | 'mana'; hint?: ClassHint;
}

const wp = (id: string, name: string, g: 'm' | 'f', type: string, w: number, h: number, req: number, min: number, max: number, hint: ClassHint, two = false, mods?: BaseDef['mods']): BaseDef =>
  ({ id, name, gender: g, type, slot: 'weapon', w, h, req, dmg: [min, max], twoHanded: two, value: Math.round((min + max) * 3 + req * 4), group: type === 'staff' || type === 'wand' ? 'caster' : 'weapon', mods, hint });
const ar = (id: string, name: string, g: 'm' | 'f', type: string, slot: EquipSlot, w: number, h: number, req: number, armor: number, plural = false, hint?: ClassHint): BaseDef =>
  ({ id, name, gender: g, plural, type, slot, w, h, req, armor, value: Math.round(armor * 5 + req * 5), group: 'armor', hint });
const jw = (id: string, name: string, type: 'ring' | 'amulet', req: number): BaseDef =>
  ({ id, name, gender: 'm', type, slot: type === 'ring' ? 'ring1' : 'amulet', w: 1, h: 1, req, value: 30 + req * 12, group: 'jewelry' });
const po = (id: string, name: string, kind: 'health' | 'mana', req: number, amount: number): BaseDef =>
  ({ id, name, gender: 'f', type: `potion_${kind}`, slot: 'potion', w: 1, h: 1, req, value: Math.round(amount / 4) + 2, group: 'potion', potion: kind, mods: kind === 'health' ? { life: amount } : { mana: amount } });

export const BASES: BaseDef[] = [
  wp('espada_corta', 'Espada Corta', 'f', 'sword', 1, 3, 1, 3, 6, 'knight'),
  wp('espada_larga', 'Espada Larga', 'f', 'sword', 1, 3, 6, 6, 11, 'knight'),
  wp('sable_gala', 'Sable de Gala', 'm', 'sword', 1, 3, 12, 10, 18, 'knight'),
  wp('mandoble', 'Mandoble Romántico', 'm', 'sword', 2, 4, 16, 18, 30, 'knight', true),
  wp('hachuela', 'Hachuela', 'f', 'axe', 2, 3, 1, 4, 8, 'knight'),
  wp('hacha_lenador', 'Hacha de Leñador', 'f', 'axe', 2, 3, 8, 9, 16, 'knight'),
  wp('hacha_guerra', 'Hacha de Guerra', 'f', 'axe', 2, 3, 18, 17, 28, 'knight'),
  wp('maza_boda', 'Maza de Boda', 'f', 'mace', 1, 3, 1, 3, 7, 'knight'),
  wp('porra_festiva', 'Porra Festiva', 'f', 'mace', 1, 3, 9, 8, 15, 'knight'),
  wp('martillo_feria', 'Martillo de Feria', 'm', 'mace', 2, 3, 20, 16, 30, 'knight'),
  wp('baston_roble', 'Bastón de Roble', 'm', 'staff', 2, 4, 1, 2, 6, 'mage', true, { mana: 8 }),
  wp('baston_floreado', 'Bastón Floreado', 'm', 'staff', 2, 4, 10, 4, 10, 'mage', true, { mana: 20 }),
  wp('cetro_lunar', 'Cetro Lunar', 'm', 'staff', 2, 4, 20, 8, 16, 'mage', true, { mana: 40 }),
  wp('varita_madera', 'Varita de Madera', 'f', 'wand', 1, 2, 1, 2, 4, 'mage', false, { mana: 5 }),
  wp('varita_cristal', 'Varita de Cristal', 'f', 'wand', 1, 2, 10, 4, 8, 'mage', false, { mana: 12 }),
  wp('varita_cupido', 'Varita de Cupido', 'f', 'wand', 1, 2, 20, 7, 13, 'mage', false, { mana: 24 }),
  wp('arco_corto', 'Arco Corto', 'm', 'bow', 2, 3, 1, 3, 7, 'ranger', true),
  wp('arco_largo', 'Arco Largo', 'm', 'bow', 2, 4, 8, 8, 15, 'ranger', true),
  wp('arco_trovador', 'Arco de Trovador', 'm', 'bow', 2, 4, 18, 14, 26, 'ranger', true),
  ar('rodela', 'Rodela', 'f', 'shield', 'offhand', 2, 2, 1, 6),
  ar('escudo_heraldico', 'Escudo Heráldico', 'm', 'shield', 'offhand', 2, 3, 8, 18),
  ar('escudo_torre', 'Escudo de Torre', 'm', 'shield', 'offhand', 2, 3, 20, 34),
  ar('gorro_lana', 'Gorro de Lana', 'm', 'helm', 'helm', 2, 2, 1, 3),
  ar('yelmo_hierro', 'Yelmo de Hierro', 'm', 'helm', 'helm', 2, 2, 8, 12),
  ar('corona_petalos', 'Corona de Pétalos', 'f', 'helm', 'helm', 2, 2, 18, 22),
  ar('tunica_fiesta', 'Túnica de Fiesta', 'f', 'armor', 'armor', 2, 3, 1, 8),
  ar('cota_malla', 'Cota de Malla', 'f', 'armor', 'armor', 2, 3, 8, 28),
  ar('coraza_pulida', 'Coraza Pulida', 'f', 'armor', 'armor', 2, 3, 18, 55),
  ar('guantes_cuero', 'Guantes de Cuero', 'm', 'gloves', 'gloves', 2, 2, 1, 3, true),
  ar('guantes_seda', 'Guantes de Seda', 'm', 'gloves', 'gloves', 2, 2, 10, 8, true),
  ar('manoplas_gala', 'Manoplas de Gala', 'f', 'gloves', 'gloves', 2, 2, 20, 16, true),
  ar('botas_cuero', 'Botas de Cuero', 'f', 'boots', 'boots', 2, 2, 1, 3, true),
  ar('botas_baile', 'Botas de Baile', 'f', 'boots', 'boots', 2, 2, 10, 8, true),
  ar('botas_gala', 'Botas de Gala', 'f', 'boots', 'boots', 2, 2, 20, 16, true),
  ar('cinto_tela', 'Cinturón de Tela', 'm', 'belt', 'belt', 2, 1, 1, 2),
  ar('cinto_cuero', 'Cinturón de Cuero', 'm', 'belt', 'belt', 2, 1, 10, 6),
  ar('faja_gala', 'Faja de Gala', 'f', 'belt', 'belt', 2, 1, 20, 12),
  jw('anillo_laton', 'Anillo de Latón', 'ring', 1),
  jw('anillo_plata', 'Anillo de Plata', 'ring', 10),
  jw('anillo_oro', 'Anillo de Oro', 'ring', 20),
  jw('amuleto_madera', 'Amuleto de Madera', 'amulet', 1),
  jw('amuleto_plata', 'Amuleto de Plata', 'amulet', 10),
  jw('amuleto_oro', 'Amuleto de Oro', 'amulet', 20),
  po('pocion_vida_1', 'Poción de Vida Menor', 'health', 1, 40),
  po('pocion_vida_2', 'Poción de Vida', 'health', 8, 90),
  po('pocion_vida_3', 'Poción de Vida Mayor', 'health', 18, 180),
  po('pocion_vida_4', 'Elixir de Vida', 'health', 28, 320),
  po('pocion_mana_1', 'Poción de Maná Menor', 'mana', 1, 25),
  po('pocion_mana_2', 'Poción de Maná', 'mana', 8, 55),
  po('pocion_mana_3', 'Poción de Maná Mayor', 'mana', 18, 110),
  po('pocion_mana_4', 'Elixir de Maná', 'mana', 28, 200),
];

export const BASE_BY_ID: Record<string, BaseDef> = Object.fromEntries(BASES.map((b) => [b.id, b]));
