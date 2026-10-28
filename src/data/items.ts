import type { EquipSlot } from '../items/types';

export type { Rarity, EquipSlot, StatModKey, Item } from '../items/types';
export const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'offhand', 'helm', 'armor', 'gloves', 'boots', 'belt', 'ring1', 'ring2', 'amulet'];

export const SLOT_LABEL: Record<EquipSlot, string> = {
  weapon: 'Arma', offhand: 'Mano izquierda', helm: 'Casco', armor: 'Armadura', gloves: 'Guantes',
  boots: 'Botas', belt: 'Cinturón', ring1: 'Anillo', ring2: 'Anillo', amulet: 'Amuleto',
};

export const RARITY_COLOR = { normal: '#ffffff', magic: '#6969ff', rare: '#ffff64', unique: '#c7b377', quest: '#ff9a28' } as const;
export const RARITY_HEX = { normal: 0xffffff, magic: 0x6969ff, rare: 0xffff64, unique: 0xc7b377, quest: 0xff9a28 } as const;
export const RARITY_LABEL = { normal: 'Normal', magic: 'Mágico', rare: 'Raro', unique: 'Único', quest: 'De misión' } as const;
