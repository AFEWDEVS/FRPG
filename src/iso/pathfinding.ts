import type { GridPos } from '../core/types';

export type WalkFn = (gx: number, gy: number) => boolean;

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** A* on an 8-connected grid with no corner cutting. Returns cells (excluding start) or null. */
export function findPath(w: number, h: number, walk: WalkFn, start: GridPos, goal: GridPos, maxNodes = 8000): GridPos[] | null {
  if (!walk(goal.gx, goal.gy)) return null;
  if (start.gx === goal.gx && start.gy === goal.gy) return [];
  const idx = (x: number, y: number) => y * w + x;
  const g = new Map<number, number>();
  const parent = new Map<number, number>();
  const closed = new Set<number>();
  const heap: [number, number][] = [];
  const push = (f: number, i: number) => {
    heap.push([f, i]);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (heap[p][0] <= heap[c][0]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]];
      c = p;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let p = 0;
      for (;;) {
        const l = p * 2 + 1, r = l + 1;
        let m = p;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === p) break;
        [heap[p], heap[m]] = [heap[m], heap[p]];
        p = m;
      }
    }
    return top;
  };
  const hfn = (x: number, y: number) => {
    const dx = Math.abs(x - goal.gx), dy = Math.abs(y - goal.gy);
    return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
  };
  const s = idx(start.gx, start.gy);
  g.set(s, 0);
  push(hfn(start.gx, start.gy), s);
  const goalIdx = idx(goal.gx, goal.gy);
  let nodes = 0;
  while (heap.length && nodes++ < maxNodes) {
    const [, cur] = pop();
    if (cur === goalIdx) {
      const out: GridPos[] = [];
      let c = cur;
      while (c !== s) { out.push({ gx: c % w, gy: Math.floor(c / w) }); c = parent.get(c)!; }
      return out.reverse();
    }
    if (closed.has(cur)) continue;
    closed.add(cur);
    const cx = cur % w, cy = Math.floor(cur / w);
    const cg = g.get(cur)!;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || !walk(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!walk(cx + dx, cy) || !walk(cx, cy + dy))) continue;
      const ni = idx(nx, ny);
      if (closed.has(ni)) continue;
      const ng = cg + (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1);
      if (ng < (g.get(ni) ?? Infinity)) {
        g.set(ni, ng);
        parent.set(ni, cur);
        push(ng + hfn(nx, ny), ni);
      }
    }
  }
  return null;
}

/** Nearest walkable cell to a target (square-ring search). */
export function nearestWalkable(walk: WalkFn, t: GridPos, maxR = 6): GridPos | null {
  if (walk(t.gx, t.gy)) return t;
  for (let r = 1; r <= maxR; r++) {
    let best: GridPos | null = null;
    let bd = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = t.gx + dx, y = t.gy + dy;
        if (walk(x, y) && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = { gx: x, gy: y }; }
      }
    }
    if (best) return best;
  }
  return null;
}
