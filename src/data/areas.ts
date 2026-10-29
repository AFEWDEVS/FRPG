import type { AreaId } from '../core/types';

export interface AmbientDef { color: number; alpha: number; lightRadius: number; }

/** Postprocess colour grade applied to the main camera (WebGL only). tint is a per-channel multiplier. */
export interface GradeDef { tint: [number, number, number]; sat: number; vignette: number; bloom: number; }
export type FxKind = 'town' | 'forest' | 'ember' | 'cave' | 'tower';

export interface AreaDef {
  id: AreaId;
  name: string;
  music: string;
  ambient: AmbientDef;
  /** Ambient particles / clouds / grade. */
  fx: FxKind;
  grade: GradeDef;
  enemies: string[];
  /** Spawned on the overworld, or on the last dungeon floor. */
  miniboss?: string;
  footstep: 'footstep_grass' | 'footstep_stone';
  floors?: number;
  mapSize: number;
}

// Ragnarok look: fields and town are bright and saturated; only dungeons are dark (with a generous light radius).
export const AREAS: Record<AreaId, AreaDef> = {
  town: { id: 'town', name: 'Pueblo Rosaleda', music: 'town', ambient: { color: 0x2a2048, alpha: 0.05, lightRadius: 900 }, fx: 'town', grade: { tint: [1.16, 1.1, 1.02], sat: 0.22, vignette: 0.28, bloom: 0.15 }, enemies: [], footstep: 'footstep_stone', mapSize: 32 },
  w1: { id: 'w1', name: 'Bosque de Verdeluna', music: 'world1', ambient: { color: 0x0a2a1a, alpha: 0.12, lightRadius: 700 }, fx: 'forest', grade: { tint: [1.06, 1.16, 1.05], sat: 0.3, vignette: 0.32, bloom: 0.15 }, enemies: ['goblin', 'heart_slime', 'wolf', 'mushroom_man'], miniboss: 'thorn_queen', footstep: 'footstep_grass', mapSize: 72 },
  d1: { id: 'd1', name: 'Cuevas del Suspiro', music: 'dungeon1', ambient: { color: 0x04061a, alpha: 0.8, lightRadius: 560 }, fx: 'cave', grade: { tint: [0.95, 0.98, 1.06], sat: 0.05, vignette: 0.5, bloom: 0.15 }, enemies: ['goblin', 'heart_slime', 'wolf', 'mushroom_man', 'imp'], miniboss: 'ogre_poet', footstep: 'footstep_stone', floors: 3, mapSize: 56 },
  w2: { id: 'w2', name: 'Ruinas de Cenizar', music: 'world2', ambient: { color: 0x2a0c04, alpha: 0.26, lightRadius: 640 }, fx: 'ember', grade: { tint: [1.16, 1.05, 0.95], sat: 0.2, vignette: 0.4, bloom: 0.18 }, enemies: ['imp', 'skeleton', 'fire_elemental', 'ash_golem'], miniboss: 'jealous_gargoyle', footstep: 'footstep_stone', mapSize: 72 },
  d2: { id: 'd2', name: 'Torre de Malvarrón', music: 'dungeon2', ambient: { color: 0x14041e, alpha: 0.82, lightRadius: 560 }, fx: 'tower', grade: { tint: [1.04, 0.92, 1.1], sat: 0.1, vignette: 0.55, bloom: 0.15 }, enemies: ['imp', 'skeleton', 'fire_elemental', 'ash_golem'], miniboss: 'malvarron', footstep: 'footstep_stone', floors: 4, mapSize: 56 },
};