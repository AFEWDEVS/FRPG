import { ISO } from '../constants';
import type { GridPos } from '../core/types';

/**
 * Continuous grid coordinates: tile (i,j) covers [i,i+1] x [j,j+1]; its center is (i+.5, j+.5).
 * +gx goes down-right on screen, +gy goes down-left.
 */
export function gridToWorld(gx: number, gy: number): { x: number; y: number } {
  return { x: (gx - gy) * (ISO.TILE_W / 2), y: (gx + gy) * (ISO.TILE_H / 2) };
}

export function worldToGrid(x: number, y: number): { gx: number; gy: number } {
  const a = x / (ISO.TILE_W / 2);
  const b = y / (ISO.TILE_H / 2);
  return { gx: (a + b) / 2, gy: (b - a) / 2 };
}

export function worldToCell(x: number, y: number): GridPos {
  const g = worldToGrid(x, y);
  return { gx: Math.floor(g.gx), gy: Math.floor(g.gy) };
}

export function cellCenterWorld(i: number, j: number): { x: number; y: number } {
  return gridToWorld(i + 0.5, j + 0.5);
}

/** Depth = world y, so objects lower on screen draw in front. Ground uses GROUND_DEPTH. */
export const GROUND_DEPTH = -1;
export const DARKNESS_DEPTH = 1_000_000;
export function depthForY(y: number): number { return y; }
