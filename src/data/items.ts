export type Rarity = 'normal' | 'magic' | 'rare' | 'unique';
export type EquipSlot = 'weapon' | 'offhand' | 'helm' | 'armor' | 'gloves' | 'boots' | 'belt' | 'ring1' | 'ring2' | 'amulet';
export const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'offhand', 'helm', 'armor', 'gloves', 'boots', 'belt', 'ring1', 'ring2', 'amulet'];

export type ItemType =
  | 'sword' | 'axe' | 'mace' | 'staff' | 'wand' | 'bow' | 'shield' | 'helm' | 'armor' | 'gloves'
  | 'boots' | 'belt' | 'ring' | 'amulet' | 'potion_health' | 'potion_mana' | 'gold'
  | 'letter_page' | 'rose_bouquet' | 'amulet_quest';

export interface Affix { id: string; value: number; }

/** A concrete item in the world / inventory / equipment. Generation lives in a later module. */
export interface ItemInstance {
  uid: string;
  type: ItemType;
  rarity: Rarity;
  name: string;
  ilvl: number;
  reqLevel: number;
  affixes: Affix[];
  /** Base values (damage, armor...). */
  base?: Record<string, number>;
  quest?: boolean;
}
