export type ClassId = 'knight' | 'mage' | 'ranger';
export type AreaId = 'town' | 'w1' | 'w2' | 'd1' | 'd2';
export type EntryPoint = 'start' | 'stairs_up' | 'stairs_down';

/** Everything GameScene needs to build an area. Passed to scene.start/restart. */
export interface AreaTransition {
  areaId: AreaId;
  /** Dungeon floor (0-based). Ignored for town/overworld. */
  floor?: number;
  /** Generation seed. Omit to roll a fresh one. */
  seed?: number;
  /** Where to place the player. */
  entry?: EntryPoint;
}

export interface GridPos { gx: number; gy: number; }
