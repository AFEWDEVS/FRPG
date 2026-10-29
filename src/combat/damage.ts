import type { DamageType } from '../data/skills';
import type { DerivedStats } from './stats';

export type { DamageType };

/** Hit colors (floating numbers / flashes) per damage type. */
export const DAMAGE_COLORS: Record<DamageType, string> = {
  physical: '#ffffff', fire: '#ff9a3a', cold: '#8fdcff', lightning: '#d9b8ff',
};
export const DAMAGE_TINT: Record<DamageType, number> = {
  physical: 0xffe8c0, fire: 0xff8a2a, cold: 0x7fd4ff, lightning: 0xc8a0ff,
};
export const CRIT_COLOR = '#ffd84a';

/** Hit sfx per type (AudioManager short names). */
export const DAMAGE_SFX: Record<DamageType, string[]> = {
  physical: ['sword_hit', 'sword_hit_2', 'enemy_hit', 'enemy_hit_2'],
  fire: ['fire_explosion'],
  cold: ['ice_shatter'],
  lightning: ['lightning'],
};

export interface DamageInfo {
  /** Raw damage before mitigation. */
  amount: number;
  type: DamageType;
  crit?: boolean;
  /** Knockback distance in tiles away from the source. */
  knockback?: number;
  /** Source position (grid) for knockback / direction. */
  from?: { gx: number; gy: number };
  /** Ignore armor / resists (DoT, absorbable pure damage). */
  pure?: boolean;
  /** Override floating-number color (for e.g. arcane / nature hits). */
  color?: string;
  /** Skip hit sfx (multi-hit effects play their own). */
  silent?: boolean;
  /** Dealt by a charmed ally: no player lifesteal, no xp implications. */
  ally?: boolean;
  /** Damage-over-time tick: smaller numbers, no hit-stop / shake. */
  dot?: boolean;
  /** Never misses (guaranteed hits). */
  noMiss?: boolean;
}

export interface HitResult { dealt: number; crit: boolean; killed: boolean; }

/** Armor curve: physical reduction in [0, 0.85). */
export function armorReduction(armor: number, attackerLevel: number): number {
  return Math.min(0.85, armor / (armor + 25 + attackerLevel * 12));
}

/** Resist percentage of the player for an elemental type. */
export function playerResist(d: DerivedStats, type: DamageType): number {
  return type === 'fire' ? d.fireRes : type === 'cold' ? d.coldRes : type === 'lightning' ? d.lightRes : 0;
}

/** Roll the player's damage for a skill that deals `pct` percent of base damage. */
export function rollPlayerDamage(d: DerivedStats, pct: number, bonusCrit = 0): { amount: number; crit: boolean } {
  const base = d.damageMin + Math.random() * (d.damageMax - d.damageMin);
  const crit = Math.random() * 100 < d.critChance + bonusCrit;
  return { amount: base * (pct / 100) * (crit ? d.critMult : 1), crit };
}

/** Chance (0..1) that a player attack misses: hit rating vs enemy defense, small base chance, spells and bosses miss less. */
export function missChance(playerLevel: number, dex: number, enemyLevel: number, enemyArmor: number, spell: boolean, boss: boolean): number {
  const rating = 80 + playerLevel * 6 + dex * 1.2;
  const defense = 30 + enemyLevel * 6 + enemyArmor * 0.4;
  let m = 0.03 + 0.18 * (defense / (defense + rating));
  if (spell) m *= 0.5;
  if (boss) m *= 0.6;
  return Math.max(0.02, Math.min(0.3, m));
}

/** Screen shake strength for a hit relative to the target's max life. */
export function shakeFor(dealt: number, maxHp: number, crit: boolean): number {
  const ratio = dealt / Math.max(1, maxHp);
  return Math.min(0.012, 0.0015 + ratio * 0.02 + (crit ? 0.003 : 0));
}