import { SeededRNG } from '../core/SeededRNG';
import { AREAS } from '../data/areas';
import { hasSetPiece } from '../constants';
import { placePack } from './spawns';
import { NO_TILE, TileMap } from './TileMap';

type DungeonId = 'd1' | 'd2';

interface Rect { x: number; y: number; w: number; h: number; }
interface Leaf extends Rect { a?: Leaf; b?: Leaf; room?: Rect; }

const cx = (r: Rect) => Math.floor(r.x + r.w / 2);
const cy = (r: Rect) => Math.floor(r.y + r.h / 2);

/** Seed for a given floor of a dungeon run. */
export function floorSeed(runSeed: number, floor: number): number {
  return (runSeed + Math.imul(floor + 1, 7919)) >>> 0;
}

/**
 * BSP rooms + L-shaped corridors. Walls are cells adjacent to floor.
 * Floor 0 has the waypoint + exit; the last floor has the miniboss/boss room instead of stairs down.
 */
export function generateDungeon(id: DungeonId, floor: number, runSeed: number): TileMap {
  const def = AREAS[id];
  const total = def.floors ?? 3;
  const last = floor >= total - 1;
  const seed = floorSeed(runSeed, floor);
  const rng = new SeededRNG(seed);
  const N = def.mapSize;
  const map = new TileMap(N, N, seed);
  const floorKey = id === 'd1' ? 'd1_floor' : 'd2_floor';
  map.wallKey = id === 'd1' ? 'd1_wall' : 'd2_wall';
  const floorIdx = map.groundIndex(floorKey);

  // BSP
  const root: Leaf = { x: 1, y: 1, w: N - 2, h: N - 2 };
  const leaves: Leaf[] = [];
  const split = (l: Leaf, depth: number) => {
    const canH = l.w >= 24, canV = l.h >= 24;
    if (depth > 5 || (!canH && !canV) || (depth > 2 && rng.chance(0.2))) { leaves.push(l); return; }
    const horiz = canH && canV ? rng.chance(0.5) : canH;
    if (horiz) {
      const s = rng.int(11, l.w - 11);
      l.a = { x: l.x, y: l.y, w: s, h: l.h };
      l.b = { x: l.x + s, y: l.y, w: l.w - s, h: l.h };
    } else {
      const s = rng.int(11, l.h - 11);
      l.a = { x: l.x, y: l.y, w: l.w, h: s };
      l.b = { x: l.x, y: l.y + s, w: l.w, h: l.h - s };
    }
    split(l.a, depth + 1);
    split(l.b, depth + 1);
  };
  split(root, 0);

  const rooms: Rect[] = [];
  for (const l of leaves) {
    const w = rng.int(6, Math.max(6, l.w - 4)), h = rng.int(6, Math.max(6, l.h - 4));
    l.room = { x: l.x + rng.int(2, Math.max(2, l.w - w - 2)), y: l.y + rng.int(2, Math.max(2, l.h - h - 2)), w, h };
    rooms.push(l.room);
    carveRect(map, l.room, floorIdx);
  }
  const anyRoom = (l: Leaf): Rect => (l.room ? l.room : rng.chance(0.5) ? anyRoom(l.a!) : anyRoom(l.b!));
  const connect = (l: Leaf) => {
    if (!l.a || !l.b) return;
    connect(l.a); connect(l.b);
    const ra = anyRoom(l.a), rb = anyRoom(l.b);
    corridor(map, cx(ra), cy(ra), cx(rb), cy(rb), floorIdx, rng.chance(0.5));
  };
  connect(root);

  // Walls around floors
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (map.ground[map.idx(i, j)] !== NO_TILE) continue;
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
      const a = i + dx, b = j + dy;
      if (map.inBounds(a, b) && map.ground[map.idx(a, b)] !== NO_TILE) { near = true; break; }
    }
    if (near) map.wall[map.idx(i, j)] = 1;
  }

  // Rooms by distance from the start room
  const startRoom = rooms[0];
  const sx = cx(startRoom), sy = cy(startRoom);
  const dist = map.flood(sx, sy);
  const byDist = rooms
    .map((r) => ({ r, d: dist[map.idx(cx(r), cy(r))] }))
    .filter((e) => e.d >= 0)
    .sort((p, q) => q.d - p.d);
  const farRoom = byDist[0].r;
  map.addMarker('spawn', sx, sy);

  const place = (key: string, x: number, y: number, extra: Partial<{ flipX: boolean; tint: number }> = {}) => {
    map.addProp({ key, gx: x, gy: y, w: 1, h: 1, blocks: true, ...extra });
  };
  // Entry: waypoint + exit on floor 0, stairs up otherwise
  if (floor === 0) {
    place('waypoint', startRoom.x + 1, startRoom.y + 1);
    map.addMarker('waypoint', startRoom.x + 1, startRoom.y + 1);
    place('dungeon_entrance', startRoom.x + startRoom.w - 2, startRoom.y + 1);
    map.addMarker('stairs_up', startRoom.x + startRoom.w - 2, startRoom.y + 1);
  } else {
    place('stairs_down', startRoom.x + 1, startRoom.y + 1, { flipX: true, tint: 0xaaaaff });
    map.addMarker('stairs_up', startRoom.x + 1, startRoom.y + 1);
  }
  if (last) {
    map.addMarker('boss', cx(farRoom), cy(farRoom), { defId: def.miniboss });
    place('brazier', farRoom.x + 1, farRoom.y + 1);
    place('brazier', farRoom.x + farRoom.w - 2, farRoom.y + 1);
    place('waypoint', farRoom.x + 1, farRoom.y + farRoom.h - 2);
    map.addMarker('waypoint', farRoom.x + 1, farRoom.y + farRoom.h - 2);
  } else {
    place('stairs_down', cx(farRoom), cy(farRoom) - 1);
    map.addMarker('stairs_down', cx(farRoom), cy(farRoom) - 1);
  }

  // Decor, chests and enemies per room (never disconnecting the level)
  const tryDecor = (key: string, x: number, y: number) => {
    if (!map.isWalkable(x, y) || map.hasPropAt(x, y)) return false;
    place(key, x, y);
    const d = map.flood(sx, sy);
    if (!allRoomsReachable(map, d, rooms)) { map.removePropsAt(x, y); return false; }
    return true;
  };
  const decor = id === 'd1' ? ['barrel', 'crate', 'skull_pile'] : ['brazier', 'skull_pile', 'crystal'];
  for (const r of rooms) {
    if (r === startRoom) continue;
    const corners: [number, number][] = [[r.x, r.y], [r.x + r.w - 1, r.y], [r.x, r.y + r.h - 1], [r.x + r.w - 1, r.y + r.h - 1]];
    for (const [x, y] of corners) if (rng.chance(0.5)) tryDecor(rng.pick(decor), x, y);
    if (rng.chance(0.35)) {
      const x = r.x + rng.int(1, r.w - 2), y = r.y + rng.int(1, r.h - 2);
      if (tryDecor('chest_closed', x, y)) map.addMarker('chest', x, y);
    }
    if (r === farRoom && last) continue;
    placePack(map, rng, def.enemies, cx(r), cy(r) + 1, rng.int(3, 6));
  }

  // Composition: clustered set pieces (stalagmite groves along walls, cobwebs in corners, hanging chains, bones). Reachability preserved.
  const free = (x: number, y: number) => map.isWalkable(x, y) && !map.hasPropAt(x, y);
  const soft = (key: string, x: number, y: number, extra: Partial<{ flipX: boolean; lift: number }> = {}) => {
    if (hasSetPiece(key) && map.inBounds(x, y) && map.ground[map.idx(x, y)] !== NO_TILE && !map.hasPropAt(x, y)) map.addProp({ key, gx: x, gy: y, w: 1, h: 1, blocks: false, ...extra });
  };
  for (const r of rooms) {
    const boss = r === farRoom && last;
    if (hasSetPiece('stalagmite') && rng.chance(0.8)) {
      // a grove hugging one wall of the room
      const side = rng.int(0, 3);
      const bx = side === 0 ? r.x : side === 1 ? r.x + r.w - 1 : r.x + rng.int(0, r.w - 1), by = side === 2 ? r.y : side === 3 ? r.y + r.h - 1 : r.y + rng.int(0, r.h - 1);
      for (let k = 0, n = rng.int(2, 4); k < n * 4 && n > 0; k++) {
        const x = bx + rng.int(-2, 2), y = by + rng.int(-2, 2);
        if (x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h || !free(x, y) || (x === cx(r) && y === cy(r))) continue;
        tryDecor('stalagmite', x, y); n--;
      }
    }
    if (id === 'd2' && hasSetPiece('arcane_obelisk')) {
      tryDecor('arcane_obelisk', r.x + 1, r.y + r.h - 2);
      if (boss) tryDecor('arcane_obelisk', r.x + r.w - 2, r.y + r.h - 2);
    }
    if (rng.chance(0.65)) soft('cobweb_corner', r.x, r.y);
    if (rng.chance(0.5)) soft('cobweb_corner', r.x + r.w - 1, r.y, { flipX: true });
    if (rng.chance(0.4)) soft('cobweb_corner', r.x, r.y + r.h - 1);
    if (rng.chance(0.45)) { const x = r.x + rng.int(2, Math.max(2, r.w - 3)); soft('chains_hanging', x, r.y, { lift: 40 }); if (rng.chance(0.5)) soft('chains_hanging', x + 2, r.y, { lift: 40, flipX: true }); }
    for (let k = rng.int(0, 2); k > 0; k--) soft('bones_large', r.x + rng.int(1, r.w - 2), r.y + rng.int(1, r.h - 2));
  }
  return map;
}

function allRoomsReachable(map: TileMap, d: Int32Array, rooms: Rect[]): boolean {
  return rooms.every((r) => d[map.idx(cx(r), cy(r))] >= 0 || !map.isWalkable(cx(r), cy(r)));
}

function carveRect(map: TileMap, r: Rect, gi: number): void {
  for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) map.ground[map.idx(i, j)] = gi;
}

function corridor(map: TileMap, x1: number, y1: number, x2: number, y2: number, gi: number, hFirst: boolean): void {
  const dot = (x: number, y: number) => {
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const i = x + dx, j = y + dy;
      if (i > 0 && j > 0 && i < map.width - 1 && j < map.height - 1) map.ground[map.idx(i, j)] = gi;
    }
  };
  let x = x1, y = y1;
  const hSeg = () => { while (x !== x2) { x += Math.sign(x2 - x); dot(x, y); } };
  const vSeg = () => { while (y !== y2) { y += Math.sign(y2 - y); dot(x, y); } };
  dot(x, y);
  if (hFirst) { hSeg(); vSeg(); } else { vSeg(); hSeg(); }
}
