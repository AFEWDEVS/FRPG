import Phaser from 'phaser';

export interface BurstOptions {
  count?: number;
  tint?: number | number[];
  scale?: { start: number; end: number };
  speed?: { min: number; max: number };
  lifespan?: number;
  gravityY?: number;
  alpha?: { start: number; end: number };
  angle?: { min: number; max: number };
  blend?: 'ADD' | 'NORMAL';
  depth?: number;
}

export interface FloatingTextOptions {
  color?: string;
  size?: number;
  duration?: number;
  rise?: number;
}

const VFX_DEPTH = 900_000;

/**
 * Per-GameScene effects API. Texture keys are the short vfx names ('spark', 'heart', ...).
 * Later agents extend this (projectiles, auras...) but should keep these signatures.
 */
export class VfxManager {
  private hitStopUntil = 0;

  constructor(private scene: Phaser.Scene) {}

  /** One-shot particle explosion at world (x, y). */
  burst(key: string, x: number, y: number, o: BurstOptions = {}): void {
    const tex = `vfx_${key}`;
    if (!this.scene.textures.exists(tex)) return;
    const em = this.scene.add.particles(x, y, tex, {
      emitting: false,
      lifespan: o.lifespan ?? 500,
      speed: o.speed ?? { min: 40, max: 160 },
      scale: o.scale ?? { start: 0.6, end: 0 },
      alpha: o.alpha ?? { start: 1, end: 0 },
      angle: o.angle ?? { min: 0, max: 360 },
      gravityY: o.gravityY ?? 0,
      tint: o.tint ?? 0xffffff,
      blendMode: o.blend === 'NORMAL' ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD,
    });
    em.setDepth(o.depth ?? VFX_DEPTH);
    em.explode(o.count ?? 12);
    this.scene.time.delayedCall((o.lifespan ?? 500) + 100, () => em.destroy());
  }

  screenShake(intensity = 0.006, ms = 120): void {
    this.scene.cameras.main.shake(ms, intensity);
  }

  /** Briefly freeze gameplay for impact. GameScene skips entity ticks while `frozen`. */
  hitStop(ms = 60): void { this.hitStopUntil = Math.max(this.hitStopUntil, performance.now() + ms); }
  get frozen(): boolean { return performance.now() < this.hitStopUntil; }

  floatingText(text: string, x: number, y: number, o: FloatingTextOptions = {}): void {
    const t = this.scene.add.text(x, y, text, {
      fontFamily: 'Georgia, serif', fontSize: `${o.size ?? 20}px`, color: o.color ?? '#ffffff',
      stroke: '#000000', strokeThickness: 4, align: 'center', wordWrap: { width: 340 },
    }).setOrigin(0.5, 1).setDepth(VFX_DEPTH + 10);
    this.scene.tweens.add({
      targets: t, y: y - (o.rise ?? 50), alpha: { from: 1, to: 0 }, duration: o.duration ?? 1100, ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }
}