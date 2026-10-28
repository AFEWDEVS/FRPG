import type { ClassId } from '../core/types';

export interface SkillDef {
  id: string;
  classId: ClassId;
  name: string;
  /** Tree index 0..2 within the class. */
  tree: number;
  reqLevel: number;
  maxLevel: number;
  manaCost: number;
  description: string;
}

export const SKILL_TREES: Record<ClassId, [string, string, string]> = {
  knight: ['Combate', 'Auras', 'Cruzada'],
  mage: ['Fuego', 'Hielo', 'Arcano'],
  ranger: ['Arco', 'Trampas', 'Seducción'],
};

const s = (id: string, classId: ClassId, name: string, tree: number, reqLevel: number, manaCost: number, description: string): SkillDef =>
  ({ id, classId, name, tree, reqLevel, maxLevel: 20, manaCost, description });

export const SKILLS: SkillDef[] = [
  s('golpe_valiente', 'knight', 'Golpe Valiente', 0, 1, 2, 'Un tajo noble y contundente.'),
  s('torbellino', 'knight', 'Torbellino', 0, 12, 8, 'Giras sobre ti mismo golpeando a todos.'),
  s('escudo_radiante', 'knight', 'Escudo Radiante', 1, 6, 6, 'Un escudo de luz absorbe daño.'),
  s('aura_coraje', 'knight', 'Aura de Coraje', 1, 18, 10, 'Aura que aumenta el daño de aliados.'),
  s('carga_heroica', 'knight', 'Carga Heroica', 2, 6, 5, 'Te lanzas contra el enemigo.'),
  s('martillo_celestial', 'knight', 'Martillo Celestial', 2, 24, 14, 'Un martillo de luz cae del cielo.'),
  s('bola_fuego', 'mage', 'Bola de Fuego', 0, 1, 3, 'Lanza una bola de fuego explosiva.'),
  s('meteoro', 'mage', 'Meteoro', 0, 24, 22, 'Un meteoro arrasa el área.'),
  s('nova_hielo', 'mage', 'Nova de Hielo', 1, 6, 8, 'Onda de hielo que ralentiza.'),
  s('armadura_escarcha', 'mage', 'Armadura de Escarcha', 1, 12, 10, 'Te cubres de hielo protector.'),
  s('rayo_encadenado', 'mage', 'Rayo Encadenado', 2, 6, 7, 'Un rayo salta entre enemigos.'),
  s('teletransporte', 'mage', 'Teletransporte', 2, 18, 12, 'Te desplazas al instante.'),
  s('flecha_multiple', 'ranger', 'Flecha Múltiple', 0, 1, 3, 'Dispara varias flechas en abanico.'),
  s('lluvia_flechas', 'ranger', 'Lluvia de Flechas', 0, 24, 18, 'Una lluvia de flechas cubre el área.'),
  s('flecha_explosiva', 'ranger', 'Flecha Explosiva', 1, 6, 6, 'Una flecha que explota al impactar.'),
  s('trampa_espinas', 'ranger', 'Trampa de Espinas', 1, 12, 9, 'Trampa que hiere a quien la pise.'),
  s('serenata_encantadora', 'ranger', 'Serenata Encantadora', 2, 12, 12, 'Los enemigos se enamoran y luchan por ti.'),
  s('paso_ligero', 'ranger', 'Paso Ligero', 2, 6, 5, 'Un salto rápido en una dirección.'),
];

export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((x) => [x.id, x]));
