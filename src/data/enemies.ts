export interface EnemyDef {
  id: string;
  name: string;
  textureKey: string;
  hp: number;
  speed: number; // tiles/s
  xp: number;
  scale: number;
  boss?: boolean;
}

const e = (id: string, name: string, hp: number, speed: number, xp: number, scale = 1, boss = false): EnemyDef =>
  ({ id, name, textureKey: id, hp, speed, xp, scale, boss });

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries([
  e('goblin', 'Goblin Ladrón de Cartas', 40, 3.2, 12),
  e('heart_slime', 'Baba Corazón', 30, 2.0, 8),
  e('wolf', 'Lobo Celoso', 45, 4.4, 14),
  e('mushroom_man', 'Hongo Andante', 55, 2.4, 16),
  e('imp', 'Diablillo Chismoso', 50, 3.8, 20),
  e('skeleton', 'Esqueleto Desamparado', 70, 3.0, 24),
  e('fire_elemental', 'Elemental Ardiente', 90, 3.0, 30),
  e('ash_golem', 'Gólem de Ceniza', 160, 2.2, 40, 1.2),
  e('thorn_queen', 'Reina Espinas', 900, 3.0, 400, 1.6, true),
  e('ogre_poet', 'Ogro Poeta', 1400, 2.6, 600, 1.6, true),
  e('jealous_gargoyle', 'Gárgola Celosa', 2200, 3.0, 900, 1.6, true),
  e('malvarron', 'Lord Malvarrón', 4000, 3.2, 2000, 1.5, true),
].map((d) => [d.id, d]));

export const CHAMPION_AFFIXES = [
  { id: 'fast', name: 'Rápido' },
  { id: 'fiery', name: 'Ardiente' },
  { id: 'lovesick', name: 'Enamoradizo' },
  { id: 'frozen', name: 'Gélido' },
  { id: 'tough', name: 'Robusto' },
];
