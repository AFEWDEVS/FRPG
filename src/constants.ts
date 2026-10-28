export const BASE_W = 1280;
export const BASE_H = 720;

/** Isometric 2:1. Art is authored at 256x128 per tile and displayed at ART_SCALE. */
export const ISO = {
  TILE_W: 128,
  TILE_H: 64,
  ART_SCALE: 0.5,
} as const;