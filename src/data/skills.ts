import type { ClassId } from '../core/types';

export type DamageType = 'physical' | 'fire' | 'cold' | 'lightning';
export type SkillTargeting = 'melee' | 'projectile' | 'ground' | 'self' | 'dash';

/** [base value at level 1, increase per extra level]. */
export type Scale = [number, number];

export interface SkillDef {
  id: string;
  classId: ClassId;
  name: string;
  /** Tree index 0..2 within the class. */
  tree: number;
  reqLevel: number;
  maxLevel: number;
  /** Mana cost at level 1 (+0.5 per extra level). */
  manaCost: number;
  /** Spanish description template; {key} is replaced by scaled values (see skills/index.ts describeSkill). */
  description: string;
  /** Skill ids (each at level >= 1) required before this one can be learned. */
  prereqs: string[];
  /** Cooldown in ms at level 1 (cdPerLevel is added per extra level). */
  cooldown: number;
  cdPerLevel?: number;
  element: DamageType | 'holy' | 'arcane' | 'love' | 'nature';
  targeting: SkillTargeting;
  /** Max cast distance in tiles (melee skills: reach). */
  range: number;
  /** Scaling values used by the executor and the description. */
  values: Record<string, Scale>;
}

export const SKILL_TREES: Record<ClassId, [string, string, string]> = {
  knight: ['Combate', 'Auras', 'Cruzada'],
  mage: ['Fuego', 'Hielo', 'Arcano'],
  ranger: ['Arco', 'Trampas', 'Seducción'],
};

type Def = Omit<SkillDef, 'maxLevel' | 'prereqs' | 'cdPerLevel'> & { prereqs?: string[]; cdPerLevel?: number };
const s = (d: Def): SkillDef => ({ maxLevel: 20, prereqs: [], ...d });

export const SKILLS: SkillDef[] = [
  // ---- Caballero Galante
  s({ id: 'golpe_valiente', classId: 'knight', name: 'Golpe Valiente', tree: 0, reqLevel: 1, manaCost: 2, cooldown: 0, element: 'physical', targeting: 'melee', range: 2.1,
    description: 'Un tajo noble y contundente en arco. Inflige {dmg}% del daño del arma a los enemigos frente a ti.',
    values: { dmg: [150, 11] } }),
  s({ id: 'torbellino', classId: 'knight', name: 'Torbellino', tree: 0, reqLevel: 12, manaCost: 8, cooldown: 1800, element: 'physical', targeting: 'self', range: 2.4, prereqs: ['golpe_valiente'],
    description: 'Giras sobre ti mismo durante {dur}s golpeando a todos los cercanos por {dmg}% de daño cada vez.',
    values: { dmg: [85, 6], dur: [1.2, 0.04] } }),
  s({ id: 'escudo_radiante', classId: 'knight', name: 'Escudo Radiante', tree: 1, reqLevel: 6, manaCost: 6, cooldown: 12000, element: 'holy', targeting: 'self', range: 0,
    description: 'Un escudo de luz absorbe {absorb} de daño durante {dur}s.',
    values: { absorb: [45, 14], dur: [10, 0.5] } }),
  s({ id: 'aura_coraje', classId: 'knight', name: 'Aura de Coraje', tree: 1, reqLevel: 18, manaCost: 10, cooldown: 16000, element: 'holy', targeting: 'self', range: 3.2, prereqs: ['escudo_radiante'],
    description: 'Un aura sagrada quema a los enemigos cercanos por {dmg}% de daño cada 0,6s durante {dur}s.',
    values: { dmg: [45, 4], dur: [12, 0.6] } }),
  s({ id: 'carga_heroica', classId: 'knight', name: 'Carga Heroica', tree: 2, reqLevel: 6, manaCost: 5, cooldown: 3500, cdPerLevel: -60, element: 'physical', targeting: 'dash', range: 8, prereqs: ['golpe_valiente'],
    description: 'Te lanzas contra el enemigo infligiendo {dmg}% de daño y aturdiéndolo {stun}s.',
    values: { dmg: [130, 9], stun: [1, 0.05] } }),
  s({ id: 'martillo_celestial', classId: 'knight', name: 'Martillo Celestial', tree: 2, reqLevel: 24, manaCost: 14, cooldown: 3000, element: 'holy', targeting: 'self', range: 7, prereqs: ['carga_heroica'],
    description: 'Invocas {n} martillos de luz que giran en espiral hacia fuera infligiendo {dmg}% de daño.',
    values: { dmg: [160, 11], n: [3, 0.25] } }),
  // ---- Arcanista
  s({ id: 'bola_fuego', classId: 'mage', name: 'Bola de Fuego', tree: 0, reqLevel: 1, manaCost: 3, cooldown: 0, element: 'fire', targeting: 'projectile', range: 14,
    description: 'Lanza una bola de fuego que explota por {dmg}% de daño de fuego y quema {burn}% por segundo durante 3s.',
    values: { dmg: [220, 16], burn: [25, 3] } }),
  s({ id: 'meteoro', classId: 'mage', name: 'Meteoro', tree: 0, reqLevel: 24, manaCost: 22, cooldown: 5000, element: 'fire', targeting: 'ground', range: 12, prereqs: ['bola_fuego'],
    description: 'Un meteoro cae tras 1,2s causando {dmg}% de daño de fuego y deja el suelo ardiendo ({fire}% cada 0,5s).',
    values: { dmg: [550, 38], fire: [45, 4] } }),
  s({ id: 'nova_hielo', classId: 'mage', name: 'Nova de Hielo', tree: 1, reqLevel: 6, manaCost: 8, cooldown: 2200, element: 'cold', targeting: 'self', range: 4.6,
    description: 'Una onda helada causa {dmg}% de daño de frío y ralentiza a los enemigos {slow}% durante {dur}s.',
    values: { dmg: [170, 12], slow: [50, 0.5], dur: [2.5, 0.2] } }),
  s({ id: 'armadura_escarcha', classId: 'mage', name: 'Armadura de Escarcha', tree: 1, reqLevel: 12, manaCost: 10, cooldown: 15000, element: 'cold', targeting: 'self', range: 0, prereqs: ['nova_hielo'],
    description: 'Te cubres de hielo: +{armor} de armadura durante {dur}s y los atacantes cuerpo a cuerpo se ralentizan.',
    values: { armor: [30, 9], dur: [25, 1] } }),
  s({ id: 'rayo_encadenado', classId: 'mage', name: 'Rayo Encadenado', tree: 2, reqLevel: 6, manaCost: 7, cooldown: 500, element: 'lightning', targeting: 'projectile', range: 11,
    description: 'Un rayo causa {dmg}% de daño y salta hasta {n} veces entre enemigos cercanos.',
    values: { dmg: [190, 13], n: [3, 0.3] } }),
  s({ id: 'teletransporte', classId: 'mage', name: 'Teletransporte', tree: 2, reqLevel: 18, manaCost: 12, cooldown: 3500, cdPerLevel: -80, element: 'arcane', targeting: 'ground', range: 13, prereqs: ['rayo_encadenado'],
    description: 'Te desplazas al instante hasta {dist} casillas hacia el cursor.',
    values: { dist: [10, 0.2] } }),
  // ---- Trovador Arquero
  s({ id: 'flecha_multiple', classId: 'ranger', name: 'Flecha Múltiple', tree: 0, reqLevel: 1, manaCost: 3, cooldown: 0, element: 'physical', targeting: 'projectile', range: 14,
    description: 'Dispara {n} flechas en abanico, cada una por {dmg}% de daño.',
    values: { dmg: [85, 6], n: [3, 0.25] } }),
  s({ id: 'lluvia_flechas', classId: 'ranger', name: 'Lluvia de Flechas', tree: 0, reqLevel: 24, manaCost: 18, cooldown: 4000, element: 'physical', targeting: 'ground', range: 11, prereqs: ['flecha_multiple'],
    description: 'Una lluvia de flechas cubre el área durante {dur}s; cada flecha causa {dmg}% de daño.',
    values: { dmg: [75, 5], dur: [2.5, 0.1] } }),
  s({ id: 'flecha_explosiva', classId: 'ranger', name: 'Flecha Explosiva', tree: 1, reqLevel: 6, manaCost: 6, cooldown: 800, element: 'fire', targeting: 'projectile', range: 14,
    description: 'Una flecha que explota al impactar causando {dmg}% de daño de fuego en un radio de {r} casillas.',
    values: { dmg: [190, 13], r: [1.8, 0.04] } }),
  s({ id: 'trampa_espinas', classId: 'ranger', name: 'Trampa de Espinas', tree: 1, reqLevel: 12, manaCost: 9, cooldown: 1000, element: 'nature', targeting: 'ground', range: 7, prereqs: ['flecha_explosiva'],
    description: 'Coloca una trampa (máx. 3) que brota espinas por {dmg}% de daño e inmoviliza {root}s.',
    values: { dmg: [260, 17], root: [1.5, 0.08] } }),
  s({ id: 'serenata_encantadora', classId: 'ranger', name: 'Serenata Encantadora', tree: 2, reqLevel: 12, manaCost: 12, cooldown: 12000, cdPerLevel: -150, element: 'love', targeting: 'self', range: 6.5,
    description: 'Hasta {n} enemigos cercanos se enamoran y luchan por ti durante {dur}s.',
    values: { n: [2, 0.3], dur: [6, 0.5] } }),
  s({ id: 'paso_ligero', classId: 'ranger', name: 'Paso Ligero', tree: 2, reqLevel: 6, manaCost: 5, cooldown: 2500, element: 'physical', targeting: 'dash', range: 6,
    description: 'Un salto veloz de {dist} casillas que te da +{haste}% de velocidad durante 3s.',
    values: { dist: [5, 0.1], haste: [30, 2] } }),
];

export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((x) => [x.id, x]));