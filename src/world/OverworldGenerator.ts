import { SeededRNG } from '../core/SeededRNG';
import { AREAS } from '../data/areas';
import { ValueNoise } from './noise';
import { placePack } from './spawns';
import { TileMap } from './TileMap';

type WorldId = 'w1' | 'w2';

interface Biome { ground: string[]; solid: string; path: string; trees: string[]; deco: string[]; blockDeco: string[]; }

const BIOMES: Record<WorldId, Biome> = {
  w1: {
    ground: ['w1_grass', 'w1_grass_flowers', 'w1_dirt', 'w1_forest_floor'], solid: 'w1_water', path: 'w1_dirt',
    trees: ['tree_oak_1', 'tree_oak_2', 'tree_pine'], deco: ['flowers', 'mushrooms'], blockDeco: ['bush', 'rock_1', 'rock_2'],
  },
  w2: {
    ground: ['w2_ash', 'w2_obsidian'], solid: 'w2_lava', path: 'w2_ash',
    trees: ['dead_tree', 'obsidian_spire', 'ruins_pillar'], deco: ['skull_pile'], blockDeco: ['lava_rock', 'crystal', 'rock_1'],
  },
};

/** Generates a fresh overworld from a seed. Guarantees a walkable path spawn -> dungeon entrance. */
export function generateOverworld(worldId: WorldId, seed: number): TileMap {
  const def = AREAS[worldId];
  const bio = BIOMES[worldId];
  const N = def.mapSize;
  const map = new TileMap(N, N, seed);
  const rng = new SeededRNG(seed);
  const elev = new ValueNoise(seed ^ 0x1234);
  const moist = new ValueNoise(seed ^ 0x9876);

  const idxOf = Object.fromEntries(bio.ground.map((k) => [k, map.groundIndex(k)]));
  const solidIdx = map.groundIndex(bio.solid, true);

  const spawn = { gx: 6, gy: Math.floor(N / 2) };
  const entrance = { gx: N - 10 + rng.int(-3, 3), gy: rng.int(12, N - 12) };
  const wp = { gx: spawn.gx + 3, gy: spawn.gy - 2 };
  const near = (i: number, j: number, p: { gx: number; gy: number }, r: number) => Math.hypot(i - p.gx, j - p.gy) < r;

  // Terrain
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const e = elev.fbm(i * 0.07, j * 0.07);
      const m = moist.fbm(i * 0.09 + 50, j * 0.09 + 50);
      let key: string;
      if (e < 0.34 && !near(i, j, spawn, 6) && !near(i, j, entrance, 5)) { map.ground[map.idx(i, j)] = solidIdx; continue; }
      if (worldId === 'w1') {
        if (m > 0.6) key = 'w1_forest_floor';
        else if (e < 0.4 || m < 0.28) key = 'w1_dirt';
        else key = rng.chance(0.18) ? 'w1_grass_flowers' : 'w1_grass';
      } else {
        key = m > 0.62 ? 'w2_obsidian' : 'w2_ash';
      }
      map.ground[map.idx(i, j)] = idxOf[key];
    }
  }

  // Props
  const clear = (i: number, j: number) => near(i, j, spawn, 5) || near(i, j, entrance, 4) || near(i, j, wp, 2);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const edge = i < 2 || j < 2 || i >= N - 2 || j >= N - 2;
      if (edge) {
        map.block(i, j);
        if (map.ground[map.idx(i, j)] !== map.groundIndex(bio.solid, true) && rng.chance(0.6)) {
          map.addProp({ key: rng.pick(bio.trees), gx: i, gy: j, w: 1, h: 1, blocks: true });
        }
        continue;
      }
      if (clear(i, j) || !map.isWalkable(i, j)) continue;
      const g = map.groundKeys[map.ground[map.idx(i, j)]];
      const r = rng.next();
      const forest = g === 'w1_forest_floor';
      if (worldId === 'w1') {
        if (forest && r < 0.2) map.addProp({ key: rng.pick(bio.trees), gx: i, gy: j, w: 1, h: 1, blocks: true });
        else if (!forest && r < 0.035) map.addProp({ key: rng.pick(bio.trees), gx: i, gy: j, w: 1, h: 1, blocks: true });
        else if (r < 0.05) map.addProp({ key: rng.pick(bio.blockDeco), gx: i, gy: j, w: 1, h: 1, blocks: true });
        else if (r < 0.09) map.addProp({ key: rng.pick(bio.deco), gx: i, gy: j, w: 1, h: 1, blocks: false });
      } else {
        if (r < 0.04) map.addProp({ key: rng.pick(bio.trees), gx: i, gy: j, w: 1, h: 1, blocks: true });
        else if (r < 0.075) map.addProp({ key: rng.pick(bio.blockDeco), gx: i, gy: j, w: 1, h: 1, blocks: true });
        else if (r < 0.085) map.addProp({ key: rng.pick(bio.deco), gx: i, gy: j, w: 1, h: 1, blocks: false });
      }
    }
  }

  const clearCell = (i: number, j: number) => {
    map.removePropsAt(i, j);
    if (!map.inBounds(i, j)) return;
    const n = map.idx(i, j);
    map.blocked[n] = 0;
    if (map.ground[n] === NO(map) || map.groundSolid[map.ground[n]]) map.ground[n] = map.groundIndex(bio.path);
  };
  const clearArea = (c: { gx: number; gy: number }, r: number) => {
    for (let j = c.gy - r; j <= c.gy + r; j++) for (let i = c.gx - r; i <= c.gx + r; i++) {
      if (i > 1 && j > 1 && i < N - 2 && j < N - 2 && Math.hypot(i - c.gx, j - c.gy) <= r + 0.3) clearCell(i, j);
    }
  };
  clearArea(spawn, 4);
  clearArea(entrance, 3);
  clearArea(wp, 1);

  // Landmarks (blocking, interactable props)
  map.addProp({ key: 'waypoint', gx: wp.gx, gy: wp.gy, w: 1, h: 1, blocks: true });
  map.addMarker('waypoint', wp.gx, wp.gy);
  map.addProp({ key: 'dungeon_entrance', gx: entrance.gx, gy: entrance.gy, w: 1, h: 1, blocks: true });
  map.addMarker('dungeon_entrance', entrance.gx, entrance.gy);
  map.addMarker('spawn', spawn.gx, spawn.gy);

  // Guarantee a route spawn -> entrance: carve a wobbly corridor if the flood fill cannot reach it.
  const reaches = () => {
    const d = map.flood(spawn.gx, spawn.gy);
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => d[map.idx(entrance.gx + dx, entrance.gy + dy)] >= 0);
  };
  if (!reaches()) {
    let x = spawn.gx, y = spawn.gy;
    while (Math.abs(x - entrance.gx) + Math.abs(y - entrance.gy) > 1) {
      if (rng.chance(0.5) && x !== entrance.gx || y === entrance.gy) x += Math.sign(entrance.gx - x);
      else y += Math.sign(entrance.gy - y);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) {
        const i = x + dx, j = y + dy;
        if ((i === wp.gx && j === wp.gy) || (i === entrance.gx && j === entrance.gy)) continue;
        clearCell(i, j);
      }
    }
  }

  // Everything below is placed on cells reachable from spawn only.
  const dist = map.flood(spawn.gx, spawn.gy);
  const cells: number[] = [];
  for (let n = 0; n < dist.length; n++) if (dist[n] > 12) cells.push(n);
  const toXY = (n: number) => ({ gx: n % N, gy: (n / N) | 0 });

  // Miniboss: far from spawn
  const far = cells.filter((n) => dist[n] > N * 0.8);
  const bossCell = toXY(far.length ? rng.pick(far) : cells[cells.length - 1]);
  if (def.miniboss) {
    clearArea(bossCell, 2);
    map.addMarker('boss', bossCell.gx, bossCell.gy, { defId: def.miniboss });
  }

  const packs = Math.floor((N * N) / 230);
  for (let p = 0; p < packs && cells.length; p++) {
    const c = toXY(rng.pick(cells));
    if (Math.hypot(c.gx - bossCell.gx, c.gy - bossCell.gy) < 6) continue;
    placePack(map, rng, def.enemies, c.gx, c.gy, undefined, dist);
  }
  for (let k = 0; k < 6 && cells.length; k++) {
    const c = toXY(rng.pick(cells));
    if (!map.isWalkable(c.gx, c.gy) || map.hasPropAt(c.gx, c.gy) || map.markers.some((m) => m.gx === c.gx && m.gy === c.gy)) continue;
    map.addProp({ key: 'chest_closed', gx: c.gx, gy: c.gy, w: 1, h: 1, blocks: true });
    map.addMarker('chest', c.gx, c.gy);
  }
  return map;
}

function NO(map: TileMap): number { void map; return 255; }