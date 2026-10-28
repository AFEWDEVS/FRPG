import Phaser from 'phaser';

/**
 * Procedural animation for single-frame sprites: walk bob, squash/stretch, breathing,
 * facing flip, hit flash, attack lunge. Sprite origin must be (0.5, 1) at container (0,0).
 */
export class ProcAnim {
  private phase = 0;
  private lastHalf = 0;
  private flashUntil = 0;
  private lunge = { x: 0, y: 0, t: 0, dur: 1 };
  /** Called twice per walk cycle (each footfall). */
  onStep?: () => void;
  /** Tint re-applied after a hit flash (champions). */
  baseTint?: number;

  constructor(
    private sprite: Phaser.GameObjects.Image,
    private shadow: Phaser.GameObjects.Ellipse,
    private baseScale: number,
  ) {}

  setFacingLeft(left: boolean): void { this.sprite.setFlipX(left); }

  flash(ms = 90): void {
    this.flashUntil = this.sprite.scene.time.now + ms;
    this.sprite.setTintFill(0xffffff);
  }

  /** Quick lunge toward a screen-space direction (attacks). */
  attackLunge(dx: number, dy: number, dur = 160): void {
    const l = Math.hypot(dx, dy) || 1;
    this.lunge = { x: (dx / l) * 14, y: (dy / l) * 7, t: dur, dur };
  }

  update(dtMs: number, moving: boolean, speedFactor = 1): void {
    const s = this.sprite;
    const dt = dtMs / 1000;
    if (this.flashUntil && s.scene.time.now > this.flashUntil) { this.flashUntil = 0; s.clearTint(); if (this.baseTint !== undefined) s.setTint(this.baseTint); }
    let bob = 0, sx = 1, sy = 1;
    if (moving) {
      this.phase += dt * 9 * speedFactor;
      const half = Math.floor(this.phase / Math.PI);
      if (half !== this.lastHalf) { this.lastHalf = half; this.onStep?.(); }
      bob = -Math.abs(Math.sin(this.phase)) * 6;
      const k = Math.abs(Math.sin(this.phase));
      sy = 1 - 0.05 * k + 0.02; sx = 1 + 0.05 * k - 0.02;
    } else {
      this.phase += dt * 2.2;
      const b = Math.sin(this.phase);
      sy = 1 + 0.015 * b; sx = 1 - 0.01 * b;
    }
    let ox = 0, oy = 0;
    if (this.lunge.t > 0) {
      this.lunge.t -= dtMs;
      const p = Math.max(0, this.lunge.t) / this.lunge.dur;
      const f = Math.sin(p * Math.PI);
      ox = this.lunge.x * f; oy = this.lunge.y * f;
    }
    s.setPosition(ox, bob + oy);
    s.setScale(this.baseScale * sx, this.baseScale * sy);
    const lift = Math.min(1, Math.abs(bob) / 6);
    this.shadow.setScale(1 - lift * 0.15, 1 - lift * 0.15);
  }
}