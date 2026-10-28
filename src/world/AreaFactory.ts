import { AREAS } from '../data/areas';
import type { AreaTransition } from '../core/types';
import { randomSeed } from '../core/SeededRNG';
import { generateDungeon } from './DungeonGenerator';
import { generateOverworld } from './OverworldGenerator';
import { buildTown } from './Town';
import type { TileMap } from './TileMap';

export interface BuiltArea {
  map: TileMap;
  /** Resolved transition (seed and floor filled in). */
  ref: Required<Pick<AreaTransition, 'areaId' | 'floor' | 'seed'>> & Pick<AreaTransition, 'entry'>;
}

/** Builds the TileMap for an area transition. Dungeon `seed` is the run seed shared by all its floors. */
export function buildArea(t: AreaTransition): BuiltArea {
  const seed = t.seed ?? randomSeed();
  const floor = t.floor ?? 0;
  const ref = { areaId: t.areaId, floor, seed, entry: t.entry };
  const def = AREAS[t.areaId];
  let map: TileMap;
  if (t.areaId === 'town') map = buildTown(seed);
  else if (t.areaId === 'w1' || t.areaId === 'w2') map = generateOverworld(t.areaId, seed);
  else map = generateDungeon(t.areaId, Math.min(floor, (def.floors ?? 1) - 1), seed);
  return { map, ref };
}