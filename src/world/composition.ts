import type { SeededRNG } from '../core/SeededRNG';
import { hasSetPiece, SETPIECE_KEYS } from '../constants';
import { NO_TILE, type TileMap } from './TileMap';

/** Set-piece composition helpers. Everything is guarded by hasSetPiece() so maps degrade gracefully while the art is missing. */

type Pt = { gx: number; gy: number };

export function canFit(map: TileMap, gx: number, gy: number, w: number, h: number, avoid?: Set<number>, allowSolid = false): boolean {
  for (let j = gy; j < gy + h; j++) for (let i = gx; i < gx + w; i++) {
    if (i < 2 || j < 2 || i >= map.width - 2 || j >= map.height - 2) return false;
    const n = map.idx(i, j), g = map.ground[n];
    if (g === NO_TILE || (map.groundSolid[g] && !allowSolid) || map.blocked[n] || map.wall[n] || map.hasPropAt(i, j) || avoid?.has(n)) return false;
  }
  return true;
}

export function putSet(map: TileMap, key: string, gx: number, gy: number, w = 1, h = 1, blocks = true, extra: { flipX?: boolean; lift?: number; scale?: number } = {}): boolean {
  if ((SETPIECE_KEYS as readonly string[]).includes(key) && !hasSetPiece(key)) return false;
  map.addProp({ key, gx, gy, w, h, blocks, ...extra });
  return true;
}

/** Place `count` pieces clustered around (cx,cy) within radius r (gaussian-ish), each on a free cell. */
export function cluster(map: TileMap, rng: SeededRNG, cx: number, cy: number, r: number, keys: string[], count: number, blocks: boolean, avoid?: Set<number>): number {
  let placed = 0;
  for (let t = 0; t < count * 6 && placed < count; t++) {
    const a = rng.next() * 6.283, d = (rng.next() + rng.next()) * 0.5 * r;
    const gx = Math.round(cx + Math.cos(a) * d), gy = Math.round(cy + Math.sin(a) * d);
    if (!canFit(map, gx, gy, 1, 1, avoid)) continue;
    if (putSet(map, rng.pick(keys), gx, gy, 1, 1, blocks, { flipX: rng.chance(0.5) })) placed++;
  }
  return placed;
}

/** Wobbly path from a to b through random control points. Returns the sampled centre line and the 2-3 wide cell set. */
export function planPath(rng: SeededRNG, N: number, a: Pt, b: Pt): { pts: { x: number; y: number }[]; cells: Set<number> } {
  const ctrl: { x: number; y: number }[] = [{ x: a.gx, y: a.gy }];
  const K = 4;
  for (let k = 1; k <= K; k++) {
    const t = k / (K + 1);
    ctrl.push({ x: Math.max(5, Math.min(N - 6, a.gx + (b.gx - a.gx) * t + rng.int(-6, 6))), y: Math.max(5, Math.min(N - 6, a.gy + (b.gy - a.gy) * t + rng.int(-8, 8))) });
  }
  ctrl.push({ x: b.gx, y: b.gy });
  const pts: { x: number; y: number }[] = [];
  const cells = new Set<number>();
  for (let s = 0; s < ctrl.length - 1; s++) {
    const p0 = ctrl[Math.max(0, s - 1)], p1 = ctrl[s], p2 = ctrl[s + 1], p3 = ctrl[Math.min(ctrl.length - 1, s + 2)];
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    for (let u = 0; u < len; u += 0.8) {
      const t = u / len, t2 = t * t, t3 = t2 * t;
      const x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      pts.push({ x, y });
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (Math.hypot(dx, dy) > 1.25) continue;
        const i = Math.round(x) + dx, j = Math.round(y) + dy;
        if (i > 1 && j > 1 && i < N - 2 && j < N - 2) cells.add(j * N + i);
      }
    }
  }
  return { pts, cells };
}

/** Cliffs framing the path, ruin arches over it. */
export function framePath(map: TileMap, rng: SeededRNG, pts: { x: number; y: number }[], path: Set<number>, ruins: boolean, protect: (i: number, j: number) => boolean): void {
  const cliffs = ['cliff_1', 'cliff_2'];
  let sinceCliff = 4, sinceArch = 14;
  for (let k = 3; k < pts.length - 3; k++) {
    const p = pts[k], q = pts[k + 2], dx = q.x - pts[k - 2].x, dy = q.y - pts[k - 2].y, d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d, horiz = Math.abs(dx) >= Math.abs(dy);
    sinceCliff++; sinceArch++;
    if (protect(Math.round(p.x), Math.round(p.y))) continue;
    if (ruins && sinceArch > 24 && rng.chance(0.25)) {
      if (putSet(map, 'ruin_arch', Math.round(p.x), Math.round(p.y), 1, 1, false, { flipX: !horiz })) { sinceArch = 0; continue; }
    }
    if (sinceCliff > 7 && rng.chance(0.35)) {
      for (const side of [1, -1]) {
        if (rng.chance(0.3)) continue;
        const off = 3 + rng.int(0, 1);
        const gx = Math.round(p.x + nx * off * side), gy = Math.round(p.y + ny * off * side);
        const w = horiz ? 2 : 1, h = horiz ? 1 : 2;
        if (protect(gx, gy) || !canFit(map, gx, gy, w, h, path)) continue;
        putSet(map, rng.pick(cliffs), gx, gy, w, h, true, { flipX: side < 0 });
        sinceCliff = 0;
      }
    }
  }
}

/** Bridges over narrow liquid gaps (up to 3 cells), making those cells walkable. */
export function placeBridges(map: TileMap, rng: SeededRNG, max: number, avoidNear: Pt[]): number {
  if (!hasSetPiece('bridge_wood')) return 0;
  const cands: { gx: number; gy: number; w: number; h: number; flip: boolean }[] = [];
  const dry = (i: number, j: number) => { if (!map.inBounds(i, j)) return false; const n = map.idx(i, j), g = map.ground[n]; return g !== NO_TILE && !map.groundSolid[g] && !map.blocked[n] && !map.hasPropAt(i, j); };
  const wet = (i: number, j: number) => { if (!map.inBounds(i, j)) return false; const g = map.ground[map.idx(i, j)]; return g !== NO_TILE && map.groundSolid[g]; };
  for (let j = 3; j < map.height - 3; j++) for (let i = 3; i < map.width - 3; i++) {
    if (!wet(i, j)) continue;
    if (dry(i - 1, j)) { let l = 0; while (wet(i + l, j) && l < 4) l++; if (l <= 3 && dry(i + l, j)) cands.push({ gx: i, gy: j, w: l, h: 1, flip: false }); }
    if (dry(i, j - 1)) { let l = 0; while (wet(i, j + l) && l < 4) l++; if (l <= 3 && dry(i, j + l)) cands.push({ gx: i, gy: j, w: 1, h: l, flip: true }); }
  }
  const chosen: typeof cands = [];
  for (let t = 0; t < cands.length * 2 && chosen.length < max; t++) {
    const c = rng.pick(cands);
    if (chosen.some((o) => Math.hypot(o.gx - c.gx, o.gy - c.gy) < 12)) continue;
    if (avoidNear.some((p) => Math.hypot(p.gx - c.gx, p.gy - c.gy) < 7)) continue;
    chosen.push(c);
  }
  for (const c of chosen) {
    for (let j = c.gy; j < c.gy + c.h; j++) for (let i = c.gx; i < c.gx + c.w; i++) map.bridged.add(map.idx(i, j));
    map.addProp({ key: 'bridge_wood', gx: c.gx, gy: c.gy, w: c.w, h: c.h, blocks: false, flipX: c.flip });
  }
  return chosen.length;
}