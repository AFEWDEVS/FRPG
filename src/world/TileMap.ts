export type MarkerType =
  | 'spawn' | 'enemy' | 'boss' | 'npc' | 'portal' | 'stairs_down' | 'stairs_up'
  | 'waypoint' | 'dungeon_entrance' | 'chest';

export interface Marker {
  type: MarkerType;
  gx: number;
  gy: number;
  data?: Record<string, unknown>;
}

export interface PropInst {
  key: string;
  /** Top-left cell of the footprint. */
  gx: number;
  gy: number;
  w: number;
  h: number;
  blocks: boolean;
  flipX?: boolean;
  tint?: number;
  scale?: number;
}

export const NO_TILE = 255;

/** Pure data model of a level. Rendering and entities live elsewhere. */
export class TileMap {
  readonly ground: Uint8Array;
  readonly wall: Uint8Array;
  /** Cells blocked by props / borders. */
  readonly blocked: Uint8Array;
  readonly props: PropInst[] = [];
  readonly markers: Marker[] = [];
  groundKeys: string[] = [];
  groundSolid: boolean[] = [];
  wallKey = '';

  constructor(public readonly width: number, public readonly height: number, public readonly seed: number) {
    this.ground = new Uint8Array(width * height).fill(NO_TILE);
    this.wall = new Uint8Array(width * height);
    this.blocked = new Uint8Array(width * height);
  }

  idx(i: number, j: number): number { return j * this.width + i; }
  inBounds(i: number, j: number): boolean { return i >= 0 && j >= 0 && i < this.width && j < this.height; }

  /** Register a ground key and return its index. */
  groundIndex(key: string, solid = false): number {
    let n = this.groundKeys.indexOf(key);
    if (n < 0) { n = this.groundKeys.length; this.groundKeys.push(key); this.groundSolid.push(solid); }
    return n;
  }

  isWalkable = (i: number, j: number): boolean => {
    if (!this.inBounds(i, j)) return false;
    const n = j * this.width + i;
    const g = this.ground[n];
    return g !== NO_TILE && !this.wall[n] && !this.blocked[n] && !this.groundSolid[g];
  };

  addProp(p: PropInst): void {
    this.props.push(p);
    if (p.blocks) this.setFootprint(p, 1);
  }
  private setFootprint(p: PropInst, v: number): void {
    for (let j = p.gy; j < p.gy + p.h; j++) for (let i = p.gx; i < p.gx + p.w; i++) {
      if (this.inBounds(i, j)) this.blocked[this.idx(i, j)] = v;
    }
  }
  /** Remove every prop whose footprint touches the cell. */
  removePropsAt(i: number, j: number): void {
    for (let n = this.props.length - 1; n >= 0; n--) {
      const p = this.props[n];
      if (i >= p.gx && i < p.gx + p.w && j >= p.gy && j < p.gy + p.h) {
        if (p.blocks) this.setFootprint(p, 0);
        this.props.splice(n, 1);
      }
    }
  }
  hasPropAt(i: number, j: number): boolean {
    return this.props.some((p) => i >= p.gx && i < p.gx + p.w && j >= p.gy && j < p.gy + p.h);
  }
  block(i: number, j: number): void { if (this.inBounds(i, j)) this.blocked[this.idx(i, j)] = 1; }

  addMarker(type: MarkerType, gx: number, gy: number, data?: Record<string, unknown>): Marker {
    const m: Marker = { type, gx, gy, data };
    this.markers.push(m);
    return m;
  }
  markersOf(type: MarkerType): Marker[] { return this.markers.filter((m) => m.type === type); }
  firstMarker(type: MarkerType): Marker | undefined { return this.markers.find((m) => m.type === type); }

  /** 4-connected flood fill of walkable cells; returns distance map (-1 = unreachable). */
  flood(si: number, sj: number): Int32Array {
    const dist = new Int32Array(this.width * this.height).fill(-1);
    if (!this.isWalkable(si, sj)) return dist;
    const q: number[] = [this.idx(si, sj)];
    dist[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const c = q[h];
      const ci = c % this.width, cj = (c / this.width) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = ci + dx, nj = cj + dy;
        if (!this.isWalkable(ni, nj)) continue;
        const n = this.idx(ni, nj);
        if (dist[n] >= 0) continue;
        dist[n] = dist[c] + 1;
        q.push(n);
      }
    }
    return dist;
  }
}