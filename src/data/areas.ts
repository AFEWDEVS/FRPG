import type { AreaId } from '../core/types';

export interface AmbientDef { color: number; alpha: number; lightRadius: number; }

/** Postprocess colour grade applied to the main camera (WebGL only). tint is a per-channel multiplier. */
export interface GradeDef { tint: [number, number, number]; sat: number; vignette: number; bloom: number; contrast?: number; }
/** Painterly atmosphere layers (src/fx/Atmosphere.ts). Alphas are 0..1 overlay strengths. */
export interface AtmoDef {
  /** Key light: colour of the sun/torch light and the direction (screen px) cast shadows point away from. */
  key: number; shadowDir: [number, number]; shadowAlpha: number;
  /** God rays (additive, drifting). 0 = none. */
  rays: number; rayColor: number;
  /** Fog wisp layers: ground fog (dungeon), mist (water), ash haze. */
  fog: 'ground' | 'mist' | 'ash' | 'none'; fogColor: number; fogAlpha: number;
  /** Depth fog: tints the top (distant) part of the screen. */
  depthColor: number; depthAlpha: number;
  /** Cool colour of the shadow-side vignette, and strength of the painted vignette / paper grain. */
  shadowColor: number; vignette: number; grain: number;
}
export type FxKind = 'town' | 'forest' | 'ember' | 'cave' | 'tower';

export interface AreaDef {
  id: AreaId;
  name: string;
  music: string;
  ambient: AmbientDef;
  /** Ambient particles / clouds / grade. */
  fx: FxKind;
  grade: GradeDef;
  atmo: AtmoDef;
  enemies: string[];
  /** Spawned on the overworld, or on the last dungeon floor. */
  miniboss?: string;
  footstep: 'footstep_grass' | 'footstep_stone';
  floors?: number;
  mapSize: number;
  /** Camera clear colour (visible only if the border terrain ever runs out). */
  bg?: string;
}

// Ragnarok look: fields and town are bright and saturated; only dungeons are dark (with a generous light radius).
export const AREAS: Record<AreaId, AreaDef> = {
  town: { id: 'town', bg: '#1d2c1b', name: 'Pueblo Rosaleda', music: 'town', ambient: { color: 0x2a2048, alpha: 0.05, lightRadius: 900 }, fx: 'town', grade: { contrast: 0.14, tint: [1.16, 1.1, 1.02], sat: 0.22, vignette: 0.28, bloom: 0.15 }, atmo: { key: 0xffe0a8, shadowDir: [-0.7, 0.45], shadowAlpha: 0.5, rays: 0.3, rayColor: 0xffe2a0, fog: 'none', fogColor: 0xffffff, fogAlpha: 0, depthColor: 0xb8c8f0, depthAlpha: 0.1, shadowColor: 0x2a1c48, vignette: 0.55, grain: 0.07 }, enemies: [], footstep: 'footstep_stone', mapSize: 32 },
  w1: { id: 'w1', bg: '#142a1c', name: 'Bosque de Verdeluna', music: 'world1', ambient: { color: 0x0a2a1a, alpha: 0.12, lightRadius: 700 }, fx: 'forest', grade: { contrast: 0.14, tint: [1.06, 1.16, 1.05], sat: 0.3, vignette: 0.32, bloom: 0.15 }, atmo: { key: 0xfff0b8, shadowDir: [-0.7, 0.45], shadowAlpha: 0.55, rays: 0.5, rayColor: 0xf6f0a8, fog: 'mist', fogColor: 0xcfe8da, fogAlpha: 0.12, depthColor: 0x9cc8c0, depthAlpha: 0.15, shadowColor: 0x0c2a30, vignette: 0.6, grain: 0.07 }, enemies: ['goblin', 'heart_slime', 'wolf', 'mushroom_man'], miniboss: 'thorn_queen', footstep: 'footstep_grass', mapSize: 72 },
  d1: { id: 'd1', bg: '#0a0a12', name: 'Cuevas del Suspiro', music: 'dungeon1', ambient: { color: 0x0a1030, alpha: 0.56, lightRadius: 700 }, fx: 'cave', grade: { contrast: 0.14, tint: [0.95, 0.98, 1.06], sat: 0.05, vignette: 0.5, bloom: 0.15 }, atmo: { key: 0x9cb4ff, shadowDir: [0, 0.5], shadowAlpha: 0.6, rays: 0, rayColor: 0x9cb4ff, fog: 'ground', fogColor: 0x7488c0, fogAlpha: 0.26, depthColor: 0x101830, depthAlpha: 0.3, shadowColor: 0x04061a, vignette: 0.7, grain: 0.08 }, enemies: ['goblin', 'heart_slime', 'wolf', 'mushroom_man', 'imp'], miniboss: 'ogre_poet', footstep: 'footstep_stone', floors: 3, mapSize: 56 },
  w2: { id: 'w2', bg: '#2a1410', name: 'Ruinas de Cenizar', music: 'world2', ambient: { color: 0x2a0c04, alpha: 0.26, lightRadius: 640 }, fx: 'ember', grade: { contrast: 0.14, tint: [1.16, 1.05, 0.95], sat: 0.2, vignette: 0.4, bloom: 0.18 }, atmo: { key: 0xff9a58, shadowDir: [-0.6, 0.5], shadowAlpha: 0.55, rays: 0.2, rayColor: 0xff8a4a, fog: 'ash', fogColor: 0x7a5646, fogAlpha: 0.18, depthColor: 0x7a2c18, depthAlpha: 0.2, shadowColor: 0x2a0c10, vignette: 0.65, grain: 0.08 }, enemies: ['imp', 'skeleton', 'fire_elemental', 'ash_golem'], miniboss: 'jealous_gargoyle', footstep: 'footstep_stone', mapSize: 72 },
  d2: { id: 'd2', bg: '#0d0814', name: 'Torre de Malvarrón', music: 'dungeon2', ambient: { color: 0x1a0a30, alpha: 0.58, lightRadius: 700 }, fx: 'tower', grade: { contrast: 0.14, tint: [1.04, 0.92, 1.1], sat: 0.1, vignette: 0.55, bloom: 0.15 }, atmo: { key: 0xb48cff, shadowDir: [0, 0.5], shadowAlpha: 0.6, rays: 0, rayColor: 0xb48cff, fog: 'ground', fogColor: 0x7a5ab0, fogAlpha: 0.24, depthColor: 0x180a2a, depthAlpha: 0.3, shadowColor: 0x0c0418, vignette: 0.7, grain: 0.08 }, enemies: ['imp', 'skeleton', 'fire_elemental', 'ash_golem'], miniboss: 'malvarron', footstep: 'footstep_stone', floors: 4, mapSize: 56 },
};