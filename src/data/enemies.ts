import type { AreaId } from '../core/types';
import type { DamageType } from './skills';

export type ProjectileElement = 'fire' | 'ice' | 'lightning' | 'arcane' | 'holy' | 'nature' | 'love' | 'physical';

export interface EnemyAttack {
  kind: 'melee' | 'ranged' | 'slam' | 'lunge';
  /** Tiles at which the attack starts. */
  range: number;
  /** Telegraph time in ms. */
  windup: number;
  cooldown: number;
  /** Damage at enemy level 1. */
  dmg: [number, number];
  type: DamageType;
  /** Projectile / impact visual element. */
  element?: ProjectileElement;
  /** Ranged enemies back away when the target is closer than this. */
  keepDist?: number;
  /** Slam radius in tiles. */
  radius?: number;
  /** Projectile speed (tiles/s). */
  projSpeed?: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  textureKey: string;
  hp: number;
  speed: number; // tiles/s
  xp: number;
  scale: number;
  boss?: boolean;
  atk: EnemyAttack;
  /** Percent resistances (negative = weakness). */
  resists?: Partial<Record<DamageType, number>>;
  armor?: number;
  aggro?: number;
  /** Comedic: runs away when low on health. */
  flees?: boolean;
  tint?: number;
  alpha?: number;
  immobile?: boolean;
  charmImmune?: boolean;
  /** Spawned by bosses only: never drops loot / xp. */
  minion?: boolean;
  /** Poise (stagger resistance). Default derived from hp; bosses set it explicitly. */
  poise?: number;
  /** Shown above the head when the enemy flees / dies etc. */
  quips?: string[];
}

const melee = (dmg: [number, number], cooldown = 1300, windup = 380, range = 1.5): EnemyAttack => ({ kind: 'melee', range, windup, cooldown, dmg, type: 'physical' });
const base = (id: string, name: string, hp: number, speed: number, xp: number, atk: EnemyAttack, extra: Partial<EnemyDef> = {}): EnemyDef =>
  ({ id, name, textureKey: id, hp, speed, xp, scale: 1, atk, ...extra });

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries([
  base('goblin', 'Goblin Ladrón de Cartas', 40, 3.2, 12, melee([3, 6], 1200, 320), { flees: true, quips: ['¡Mi carta!', '¡Es mía!', '¡Ay, ay, ay!', '¡Nadie me quiere!'] }),
  base('heart_slime', 'Baba Corazón', 30, 2.0, 8, melee([2, 5], 1500, 450, 1.3), { resists: { cold: -25 } }),
  base('wolf', 'Lobo Celoso', 45, 4.4, 14, { kind: 'lunge', range: 3.2, windup: 340, cooldown: 1700, dmg: [4, 8], type: 'physical' }),
  base('mushroom_man', 'Hongo Andante', 55, 2.4, 16, { kind: 'ranged', range: 5.5, windup: 520, cooldown: 2300, dmg: [3, 7], type: 'physical', element: 'nature', keepDist: 2.5, projSpeed: 5 }, { resists: { fire: -25 } }),
  base('imp', 'Diablillo Chismoso', 50, 3.8, 20, { kind: 'ranged', range: 7, windup: 480, cooldown: 2000, dmg: [5, 9], type: 'fire', element: 'fire', keepDist: 4, projSpeed: 7 }, { resists: { fire: 50 }, quips: ['¡Me han contado cosas!', 'Hihihi...'] }),
  base('skeleton', 'Esqueleto Desamparado', 70, 3.0, 24, melee([7, 12], 1400, 420), { resists: { cold: 40, lightning: -20 }, armor: 10, quips: ['Nadie me abraza...'] }),
  base('fire_elemental', 'Elemental Ardiente', 90, 3.0, 30, { kind: 'ranged', range: 6.5, windup: 520, cooldown: 1900, dmg: [8, 14], type: 'fire', element: 'fire', keepDist: 3, projSpeed: 6.5 }, { resists: { fire: 75, cold: -50 } }),
  base('ash_golem', 'Gólem de Ceniza', 160, 2.2, 40, { kind: 'slam', range: 2.2, windup: 780, cooldown: 2600, dmg: [12, 20], type: 'physical', radius: 2.4, element: 'physical' }, { scale: 1.2, armor: 40, poise: 95, resists: { fire: 30, lightning: -25 } }),
  // ---- bosses
  base('thorn_queen', 'Reina Espinas', 900, 3.0, 400, { kind: 'melee', range: 2, windup: 450, cooldown: 1500, dmg: [8, 13], type: 'physical' }, { scale: 1.6, boss: true, poise: 240, armor: 20, resists: { fire: -25 }, aggro: 11 }),
  base('ogre_poet', 'Ogro Poeta', 1400, 2.6, 600, { kind: 'melee', range: 2.4, windup: 600, cooldown: 1700, dmg: [12, 18], type: 'physical' }, { scale: 1.6, boss: true, poise: 300, armor: 30, aggro: 11 }),
  base('jealous_gargoyle', 'Gárgola Celosa', 2200, 3.0, 900, { kind: 'melee', range: 2, windup: 400, cooldown: 1500, dmg: [14, 22], type: 'physical' }, { scale: 1.6, boss: true, poise: 380, armor: 40, resists: { lightning: 25 }, aggro: 11 }),
  base('malvarron', 'Lord Malvarrón', 4000, 3.2, 2000, { kind: 'ranged', range: 8, windup: 500, cooldown: 1800, dmg: [10, 16], type: 'lightning', element: 'arcane', keepDist: 3, projSpeed: 8 }, { scale: 1.5, boss: true, poise: 450, resists: { fire: 20, cold: 20, lightning: 20 }, aggro: 12 }),
  // ---- minions summoned by bosses
  base('vine', 'Enredadera Celosa', 60, 0, 0, melee([5, 9], 1300, 400, 1.9), { textureKey: 'mushroom_man', tint: 0x4fae3c, scale: 0.9, immobile: true, minion: true, charmImmune: true }),
  base('mirror_clone', 'Reflejo de Malvarrón', 1, 2.6, 0, { kind: 'ranged', range: 8, windup: 600, cooldown: 2400, dmg: [6, 10], type: 'lightning', element: 'arcane', keepDist: 4, projSpeed: 8 }, { textureKey: 'malvarron', tint: 0x9fe6ff, alpha: 0.7, scale: 1.4, minion: true, charmImmune: true }),
].map((d) => [d.id, d]));

export const CHAMPION_AFFIXES = [
  { id: 'fast', name: 'Rápido' },
  { id: 'fiery', name: 'Ardiente' },
  { id: 'lovesick', name: 'Enamoradizo' },
  { id: 'shielded', name: 'Escudado' },
  { id: 'explosive', name: 'Explosivo' },
  { id: 'frozen', name: 'Gélido' },
];

/** Base enemy level of an area (floor is 0-based). */
export function areaLevel(areaId: AreaId, floor = 0): number {
  switch (areaId) {
    case 'w1': return 2;
    case 'd1': return 4 + floor * 2;
    case 'w2': return 11;
    case 'd2': return 14 + floor * 2;
    default: return 1;
  }
}

/** Multiplier applied to enemy health / damage per level above 1. */
export const enemyHpMult = (lvl: number): number => 1 + 0.22 * (lvl - 1);
export const enemyDmgMult = (lvl: number): number => 1 + 0.15 * (lvl - 1);
export const enemyXpMult = (lvl: number): number => 1 + 0.12 * (lvl - 1);