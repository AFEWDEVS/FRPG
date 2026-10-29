export const BASE_W = 1280;
export const BASE_H = 720;

/** Isometric 2:1. A tile is TILE_W x TILE_H world px; art of ANY resolution is scaled to fit (see tileScale). */
export const ISO = {
  TILE_W: 128,
  TILE_H: 64,
  /** Legacy: art authored at 256 wide. Prefer tileScale()/propScale() which read the real texture size. */
  ART_SCALE: 0.5,
} as const;

/** Characters are authored ~260px tall; drawn at ART_SCALE * CHAR_SCALE (hero ~190 world px; with camera zoom ~1.25 he is ~1.75x larger on screen than before). */
export const CHAR_SCALE = 1.45;

/** Camera: cinematic, close. Wheel zooms smoothly inside [ZOOM_MIN, ZOOM_MAX]. */
export const CAMERA = { ZOOM_DEFAULT: 1.25, ZOOM_MIN: 0.8, ZOOM_MAX: 1.6 } as const;

/** Scale for a tile / wall texture of any resolution: 512-wide art -> 0.25, 256-wide -> 0.5. */
export function tileScale(texWidth: number): number { return ISO.TILE_W / Math.max(1, texWidth); }

/**
 * Target on-world height (px) per prop, independent of the source pixel size, so regenerating art at a different resolution is seamless.
 * Set pieces (cliffs, arches...) are new; their heights are art-direction numbers.
 */
export const PROP_H: Record<string, number> = {
  barrel: 50, brazier: 87, bush: 56, campfire: 56, chest_closed: 50, chest_open: 56, crate: 44, crystal: 94, dead_tree: 234,
  dungeon_entrance: 208, fence: 61, flowers: 27, house_1: 331, house_2: 350, lava_rock: 68, market_stall: 143, mushrooms: 37,
  obsidian_spire: 171, rock_1: 50, rock_2: 68, ruins_pillar: 185, skull_pile: 37, stairs_down: 81, torch: 74, tree_oak_1: 245,
  tree_oak_2: 245, tree_pine: 261, waypoint: 107, well: 100,
  // set pieces
  cliff_1: 230, cliff_2: 250, ruin_arch: 300, broken_wall: 130, bridge_wood: 110, big_root: 150, giant_mushroom: 270,
  waterfall_rock: 230, banner_festival: 210, lantern_string: 130, statue_heart: 270, lava_pillar: 250, arcane_obelisk: 270,
  chains_hanging: 190, cobweb_corner: 110, stalagmite: 130, bones_large: 70,
};

/** Set-piece prop keys (art may land after the code; generators only use the ones whose texture is available). */
export const SETPIECE_KEYS = [
  'cliff_1', 'cliff_2', 'ruin_arch', 'broken_wall', 'bridge_wood', 'big_root', 'giant_mushroom', 'waterfall_rock', 'banner_festival',
  'lantern_string', 'statue_heart', 'lava_pillar', 'arcane_obelisk', 'chains_hanging', 'cobweb_corner', 'stalagmite', 'bones_large',
] as const;

/** Atmosphere texture keys (loaded as `fx_atmo_<name>`; every one has a procedural fallback). */
export const ATMO_NAMES = ['god_rays', 'fog_wisp_1', 'fog_wisp_2', 'light_pool', 'shadow_blob', 'paint_vignette', 'paper_grain'] as const;

/** Set pieces whose texture loaded. Filled by PreloadScene; generators consult it (headless tools may call allowSetPieces). */
const available = new Set<string>();
export function allowSetPiece(key: string): void { available.add(key); }
export function allowAllSetPieces(): void { for (const k of SETPIECE_KEYS) available.add(k); }
export function hasSetPiece(key: string): boolean { return available.has(key); }

/** Legacy table (only used for tint-less border props). */
export const PROP_SCALE: Record<string, number> = {};
