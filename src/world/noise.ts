import { SeededRNG } from '../core/SeededRNG';

/** Smooth 2D value noise with fractal octaves. Output in [0,1]. */
export class ValueNoise {
  private perm: Uint8Array;
  private vals: Float32Array;
  constructor(seed: number) {
    const rng = new SeededRNG(seed);
    this.perm = new Uint8Array(512);
    const p = Array.from({ length: 256 }, (_, i) => i);
    rng.shuffle(p);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    this.vals = new Float32Array(256);
    for (let i = 0; i < 256; i++) this.vals[i] = rng.next();
  }
  private lat(x: number, y: number): number { return this.vals[this.perm[(this.perm[x & 255] + y) & 511]]; }
  noise(x: number, y: number): number {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = this.lat(x0, y0), b = this.lat(x0 + 1, y0), c = this.lat(x0, y0 + 1), d = this.lat(x0 + 1, y0 + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  fbm(x: number, y: number, oct = 4): number {
    let amp = 0.5, f = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) { sum += this.noise(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2; }
    return sum / norm;
  }
}