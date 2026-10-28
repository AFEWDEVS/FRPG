import type { AreaId } from '../core/types';

export interface AmbientDef { color: number; alpha: number; lightRadius: number; }

export interface AreaDef {
  id: AreaId;
  name: string;
  music: string;
  ambient: AmbientDef;
  enemies: string[];
  /** Spawned on the overworld, or on the last dungeon floor. */
  miniboss?: string;
  footstep: 'footstep_grass' | 'footstep_stone';
  floors?: number;
  mapSize: number;
}

export const AREAS: Record<AreaId, AreaDef> = {
  town: { id: 'town', name: 'Pueblo Rosaleda', music: 'town', ambient: { color: 0x141c38, alpha: 0.35, lightRadius: 640 }, enemies: [], footstep: 'footstep_stone', mapSize: 32 },
  w1: { id: 'w1', name: 'Bosque de Verdeluna', music: 'world1', ambient: { color: 0x04100c, alpha: 0.72, lightRadius: 400 }, enemies: ['goblin', 'heart_slime', 'wolf', 'mushroom_man'], miniboss: 'thorn_queen', footstep: 'footstep_grass', mapSize: 72 },
  d1: { id: 'd1', name: 'Cuevas del Suspiro', music: 'dungeon1', ambient: { color: 0x020208, alpha: 0.9, lightRadius: 320 }, enemies: ['goblin', 'heart_slime', 'wolf', 'mushroom_man', 'imp'], miniboss: 'ogre_poet', footstep: 'footstep_stone', floors: 3, mapSize: 56 },
  w2: { id: 'w2', name: 'Ruinas de Cenizar', music: 'world2', ambient: { color: 0x1c0804, alpha: 0.7, lightRadius: 420 }, enemies: ['imp', 'skeleton', 'fire_elemental', 'ash_golem'], miniboss: 'jealous_gargoyle', footstep: 'footstep_stone', mapSize: 72 },
  d2: { id: 'd2', name: 'Torre de Malvarrón', music: 'dungeon2', ambient: { color: 0x0c0414, alpha: 0.9, lightRadius: 320 }, enemies: ['imp', 'skeleton', 'fire_elemental', 'ash_golem'], miniboss: 'malvarron', footstep: 'footstep_stone', floors: 4, mapSize: 56 },
};
