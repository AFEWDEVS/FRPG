import type { ClassId } from '../core/types';

export interface ClassDef {
  id: ClassId;
  name: string;
  tagline: string;
  description: string;
  textureKey: string;
  portraitKey: string;
  baseStats: { str: number; dex: number; vit: number; ene: number };
  lifePerVit: number;
  manaPerEne: number;
  speed: number; // tiles / second
  skillIds: string[]; // default hotbar order
}

export const CLASSES: Record<ClassId, ClassDef> = {
  knight: {
    id: 'knight', name: 'Caballero Galante', tagline: 'Cuerpo a cuerpo',
    description: 'Espada reluciente y modales impecables. Golpea fuerte, galantea más fuerte.',
    textureKey: 'hero_knight', portraitKey: 'portrait_hero_knight',
    baseStats: { str: 25, dex: 15, vit: 25, ene: 10 }, lifePerVit: 4, manaPerEne: 1.5, speed: 4.6,
    skillIds: ['golpe_valiente', 'carga_heroica', 'torbellino', 'escudo_radiante', 'aura_coraje', 'martillo_celestial'],
  },
  mage: {
    id: 'mage', name: 'Arcanista', tagline: 'Hechicero a distancia',
    description: 'Domina fuego, hielo y rayos. Su sombrero es su mayor orgullo.',
    textureKey: 'hero_mage', portraitKey: 'portrait_hero_mage',
    baseStats: { str: 10, dex: 15, vit: 15, ene: 30 }, lifePerVit: 2.5, manaPerEne: 3, speed: 4.4,
    skillIds: ['bola_fuego', 'nova_hielo', 'rayo_encadenado', 'meteoro', 'teletransporte', 'armadura_escarcha'],
  },
  ranger: {
    id: 'ranger', name: 'Trovador Arquero', tagline: 'A distancia',
    description: 'Flechas en la mano y una serenata en los labios. Enamora a sus enemigos.',
    textureKey: 'hero_ranger', portraitKey: 'portrait_hero_ranger',
    baseStats: { str: 15, dex: 25, vit: 20, ene: 15 }, lifePerVit: 3, manaPerEne: 2, speed: 4.9,
    skillIds: ['flecha_multiple', 'flecha_explosiva', 'lluvia_flechas', 'trampa_espinas', 'serenata_encantadora', 'paso_ligero'],
  },
};
export const CLASS_LIST: ClassDef[] = [CLASSES.knight, CLASSES.mage, CLASSES.ranger];
