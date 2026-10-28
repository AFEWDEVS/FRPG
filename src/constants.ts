export const BASE_W = 1280;
export const BASE_H = 720;

/** Isometric 2:1. Art is authored at 256x128 per tile and displayed at ART_SCALE. */
export const ISO = {
  TILE_W: 128,
  TILE_H: 64,
  ART_SCALE: 0.5,
} as const;

/** Characters are authored ~260px tall; drawn at ART_SCALE * CHAR_SCALE (hero ~170px = ~1.3 tile widths). */
export const CHAR_SCALE = 1.3;

/** Per-prop extra scale on top of ART_SCALE so props read at believable sizes next to the characters. */
export const PROP_SCALE: Record<string, number> = {
  house_1: 1.75, house_2: 1.75, tree_oak_1: 1.4, tree_oak_2: 1.4, tree_pine: 1.4, dead_tree: 1.5,
  market_stall: 1.4, well: 1.3, dungeon_entrance: 1.5, stairs_down: 1.3, waypoint: 1.3,
  ruins_pillar: 1.4, obsidian_spire: 1.4, crystal: 1.3, torch: 1.3, brazier: 1.3, fence: 1.3,
  bush: 1.2, rock_1: 1.2, rock_2: 1.2, lava_rock: 1.2, campfire: 1.2, barrel: 1.2, crate: 1.2, chest_closed: 1.2, chest_open: 1.2,
};
