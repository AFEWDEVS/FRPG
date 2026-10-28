import { SeededRNG } from '../core/SeededRNG';
import { CHAMPION_AFFIXES } from '../data/enemies';
import type { TileMap } from './TileMap';

/** Place one enemy pack (3-6 mobs, 15% champion pack) around a center cell. */
export function placePack(map: TileMap, rng: SeededRNG, enemyIds: string[], cx: number, cy: number, size?: number, reach?: Int32Array): void {
  const defId = rng.pick(enemyIds);
  const champion = rng.chance(0.15);
  const affixes = champion ? rng.shuffle([...CHAMPION_AFFIXES]).slice(0, rng.int(1, 2)).map((a) => a.id) : [];
  const n = size ?? rng.int(3, 6);
  const pack = `${cx},${cy}`;
  let placed = 0;
  for (let t = 0; t < 40 && placed < n; t++) {
    const gx = cx + rng.int(-3, 3), gy = cy + rng.int(-3, 3);
    if (!map.isWalkable(gx, gy) || (reach && reach[map.idx(gx, gy)] < 0)) continue;
    if (map.markers.some((m) => m.type === 'enemy' && m.gx === gx && m.gy === gy)) continue;
    map.addMarker('enemy', gx, gy, { defId, champion, affixes, pack });
    placed++;
  }
}