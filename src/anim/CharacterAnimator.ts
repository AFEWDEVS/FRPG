import type Phaser from 'phaser';

export interface AnimClip { frames: number[]; fps: number; loop?: boolean; }
export interface AnimMeta { frameWidth: number; frameHeight: number; cols: number; rows: number; anims: Record<string, AnimClip>; }

export const animSheetKey = (charKey: string) => `anim_${charKey}`;
export const animMetaKey = (charKey: string) => `animmeta_${charKey}`;

export function isValidMeta(m: unknown): m is AnimMeta {
  const a = m as AnimMeta | undefined;
  return !!a && typeof a.frameWidth === 'number' && typeof a.frameHeight === 'number' && !!a.anims && typeof a.anims === 'object';
}

type State = 'idle' | 'walk' | 'attack' | 'hurt' | 'death';

/**
 * Drives a sprite-sheet (4x4 grid, see AnimMeta) on the entity's Image. Direction = down/up (+ flipX handled by ProcAnim).
 * Combat code never talks to this directly: ProcAnim.attackLunge() -> playAttack(), ProcAnim.flash() -> playHurt(),
 * ProcAnim.die() -> playDeath().
 */
export class CharacterAnimator {
  /** Multiplier so a sheet frame displays at the same height as the old static sprite. */
  readonly scaleMul: number;
  up = false;
  private state: State = 'idle';
  private t = 0;
  private stateMs = 0;
  private stateDur = 0;
  private fpsMul = 1;
  private frame = -1;

  constructor(private sprite: Phaser.GameObjects.Image, charKey: string, private meta: AnimMeta, staticH: number) {
    this.scaleMul = staticH > 0 ? staticH / meta.frameHeight : 1;
    sprite.setTexture(animSheetKey(charKey), this.pick('idle')?.frames[0] ?? 0);
  }

  private clipFor(name: string): AnimClip | undefined {
    const a = this.meta.anims;
    return (this.up ? a[`${name}_up`] : undefined) ?? a[`${name}_down`] ?? a[name];
  }
  private pick(name: string): AnimClip | undefined { return this.clipFor(name) ?? this.meta.anims.walk_down; }

  playAttack(durMs = 320): void {
    const c = this.clipFor('attack');
    if (!c) return;
    this.state = 'attack'; this.t = 0; this.stateMs = 0;
    this.stateDur = Math.min(520, Math.max(240, durMs));
  }
  playHurt(ms = 200): void {
    if (this.state === 'death' || (this.state === 'attack' && this.stateMs < this.stateDur * 0.5)) return;
    if (!this.meta.anims.hurt) return;
    this.state = 'hurt'; this.stateMs = 0; this.stateDur = ms;
  }
  playDeath(): void { this.state = 'death'; }
  revive(): void { this.state = 'idle'; this.t = 0; }

  update(dtMs: number, moving: boolean, speedFactor = 1): void {
    this.stateMs += dtMs;
    let clip: AnimClip | undefined;
    let loop = true;
    if (this.state === 'death') { clip = this.meta.anims.death; loop = false; this.t = 1e6; }
    else if (this.state === 'hurt') {
      clip = this.meta.anims.hurt;
      if (this.stateMs >= this.stateDur) this.state = 'idle';
    } else if (this.state === 'attack') {
      clip = this.clipFor('attack');
      if (this.stateMs >= this.stateDur) this.state = 'idle';
    }
    if (this.state === 'idle' || this.state === 'walk') {
      if (moving) {
        if (this.state !== 'walk') { this.state = 'walk'; this.t = 0; }
        clip = this.clipFor('walk');
        this.fpsMul = Math.max(0.5, speedFactor);
      } else {
        if (this.state !== 'idle') { this.state = 'idle'; this.t = 0; }
        clip = this.meta.anims.idle ?? this.clipFor('walk');
        this.fpsMul = 1;
        if (!this.meta.anims.idle) { this.setFrame(clip?.frames[0] ?? 0); return; }
      }
    }
    if (!clip || !clip.frames.length) return;
    let fps = clip.fps || 8;
    if (this.state === 'walk') fps *= this.fpsMul;
    else if (this.state === 'attack') fps = (clip.frames.length * 1000) / this.stateDur;
    this.t += (dtMs / 1000) * fps;
    const n = clip.frames.length;
    const i = loop && clip.loop !== false ? Math.floor(this.t) % n : Math.min(n - 1, Math.floor(this.t));
    this.setFrame(clip.frames[i]);
  }

  private setFrame(f: number): void {
    if (f === this.frame) return;
    this.frame = f;
    this.sprite.setFrame(f);
  }
}
