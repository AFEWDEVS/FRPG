import Phaser from 'phaser';
import { gridToWorld } from '../iso/iso';
import { PALETTE, VFX_DEPTH, type Element } from '../vfx/VfxManager';
import type { DynamicLight } from '../world/Darkness';
import type { Enemy } from '../entities/Enemy';
import type { CombatSystem } from './CombatSystem';

export type ProjectileOwner = 'player' | 'enemy' | 'ally';
export type ProjectileKind = 'orb' | 'arrow' | 'petal' | 'rock' | 'hammer';

export type HitTarget = Enemy | 'player';

export interface ProjectileOpts {
  owner: ProjectileOwner;
  gx: number; gy: number;
  /** Grid-space direction (will be normalized). */
  dx: number; dy: number;
  /** Tiles per second. */
  speed: number;
  /** Max travel in tiles. */
  range: number;
  /** Collision radius in tiles. */
  radius?: number;
  element: Element;
  kind?: ProjectileKind;
  size?: number;
  /** Dynamic-light radius in px (0 = none). */
  light?: number;
  /** How many targets it may pass through before dying (0 = stops at first). */
  pierce?: number;
  /** Elevation in px above the ground. */
  height?: number;
  /** Optional per-frame steering. Mutate p.dx/p.dy (grid space) or p.gx/p.gy. */
  steer?: (p: Projectile, dtMs: number) => void;
  /** Called on hit (target) or when the projectile ends against a wall / at max range (target = null). */
  onHit: (p: Projectile, target: HitTarget | null) => void;
  /** Rotate the sprite to its travel direction (arrows). */
  noTrail?: boolean;
  /** Ignore walls (spiraling hammers). */
  ghost?: boolean;
}

/** A bullet-like entity: moves in grid space, collides with enemies / the player, leaves a glowing trail. */
export class Projectile {
  gx: number; gy: number; dx: number; dy: number;
  readonly o: ProjectileOpts;
  dead = false;
  travelled = 0;
  age = 0;
  pierced = 0;
  private hitIds = new Set<string>();
  private root: Phaser.GameObjects.Container;
  private core?: Phaser.GameObjects.Image;
  private glow?: Phaser.GameObjects.Image;
  private light?: DynamicLight | null;
  private trailT = 0;
  private flame?: Phaser.GameObjects.Image;

  constructor(private sys: CombatSystem, o: ProjectileOpts) {
    this.o = o;
    this.gx = o.gx; this.gy = o.gy;
    const l = Math.hypot(o.dx, o.dy) || 1;
    this.dx = o.dx / l; this.dy = o.dy / l;
    const scene = sys.scene;
    const pal = PALETTE[o.element];
    const size = o.size ?? 1;
    this.root = scene.add.container(0, 0).setDepth(VFX_DEPTH - 2);
    const kind = o.kind ?? 'orb';
    if (kind === 'arrow' || kind === 'petal' || kind === 'rock') {
      const key = kind === 'arrow' ? 'fx_arrow' : kind === 'petal' ? 'fx_petal' : 'fx_rock';
      this.core = scene.add.image(0, 0, key).setScale(size * (kind === 'arrow' ? 0.9 : kind === 'rock' ? 1 : 0.8));
      if (kind === 'arrow') this.core.setTint(0xe8d8b0);
      if (kind === 'petal') this.core.setTint(pal.mid);
      this.root.add(this.core);
      if (kind !== 'rock') {
        this.glow = scene.add.image(0, 0, 'vfx_light').setTint(pal.mid).setBlendMode(Phaser.BlendModes.ADD).setScale(0.35 * size).setAlpha(0.6);
        this.root.addAt(this.glow, 0);
      }
      if (kind === 'arrow') {
        const st = scene.add.image(-20, 0, 'fx_streak').setOrigin(1, 0.5).setScale(0.8 * size, 0.55).setBlendMode(Phaser.BlendModes.ADD).setTint(o.element === 'fire' ? 0xffa040 : 0xfff0c0).setAlpha(0.65);
        this.root.addAt(st, 0);
      }
    } else if (kind === 'hammer') {
      this.glow = scene.add.image(0, 0, 'vfx_light').setTint(pal.mid).setBlendMode(Phaser.BlendModes.ADD).setScale(1.1 * size).setAlpha(0.8);
      this.core = scene.add.image(0, 0, 'fx_hammer').setTint(0xffe28a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.8 * size);
      const aura = scene.add.image(0, 0, 'vfx_star').setTint(0xffffff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.35 * size).setAlpha(0.8);
      this.root.add([this.glow, this.core, aura]);
      sys.vfx.glow(this.core, pal.mid, 5);
      scene.tweens.add({ targets: this.core, angle: 360, duration: 420, repeat: -1 });
      scene.tweens.add({ targets: aura, angle: -360, duration: 700, repeat: -1 });
    } else {
      this.glow = scene.add.image(0, 0, 'vfx_light').setTint(pal.mid).setBlendMode(Phaser.BlendModes.ADD).setScale(0.9 * size).setAlpha(0.75);
      this.core = scene.add.image(0, 0, 'vfx_flare').setTint(pal.core).setBlendMode(Phaser.BlendModes.ADD).setScale(0.38 * size);
      this.root.add([this.glow, this.core]);
      sys.vfx.glow(this.core, pal.mid, 5);
      if (o.element === 'fire') {
        this.flame = scene.add.image(0, 0, 'vfx_fire').setTint(0xffa040).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6 * size).setAlpha(0.95);
        this.root.addAt(this.flame, 1);
        scene.tweens.add({ targets: this.flame, angle: 360, duration: 380, repeat: -1 });
      }
    }
    if (o.light) this.light = sys.vfx.addLight(0, 0, o.light, 1);
    this.place();
  }

  private place(): void {
    const w = gridToWorld(this.gx, this.gy);
    const y = w.y - (this.o.height ?? 42);
    this.root.setPosition(w.x, y);
    if (this.light) { this.light.x = w.x; this.light.y = y; }
    const k = this.o.kind ?? 'orb';
    if (k === 'arrow' || k === 'petal') {
      const sd = gridToWorld(this.dx, this.dy);
      this.root.setRotation(Math.atan2(sd.y, sd.x));
    }
  }

  get worldX(): number { return this.root.x; }
  get worldY(): number { return this.root.y; }

  /** Returns false when finished. */
  update(dtMs: number): boolean {
    if (this.dead) return false;
    const o = this.o;
    this.age += dtMs;
    o.steer?.(this, dtMs);
    const total = (o.speed * dtMs) / 1000;
    const steps = Math.max(1, Math.ceil(total / 0.45));
    const step = total / steps;
    for (let i = 0; i < steps && !this.dead; i++) {
      this.gx += this.dx * step; this.gy += this.dy * step;
      this.travelled += step;
      if (!o.ghost && !this.sys.isWalkable(this.gx, this.gy)) { this.end(null); break; }
      if (this.collide()) break;
      if (this.travelled >= o.range) { this.end(null); break; }
    }
    if (this.dead) return false;
    this.place();
    this.trailT += dtMs;
    if (!o.noTrail && this.trailT > 28) {
      this.trailT = 0;
      const k = o.kind ?? 'orb';
      if (k === 'arrow') this.sys.vfx.emit('sparks', this.root.x, this.root.y, 1, { tint: 0xfff0c0, scale: 0.08, speed: [0, 15], life: 260 });
      else if (k === 'hammer') {
        this.sys.vfx.emit('glow', this.root.x, this.root.y, 1, { tint: 0xffd45a, scale: 0.5, scaleEnd: 0.05, life: 420, alpha: 0.8 });
        this.sys.vfx.emit('stars', this.root.x, this.root.y, 1, { tint: 0xfff0b0, scale: 0.14, speed: [10, 50], life: 500 });
      } else if (k !== 'rock') {
        this.sys.vfx.trail(this.root.x, this.root.y, o.element, (o.size ?? 1) * (k === 'petal' ? 0.5 : 1));
        if (o.element === 'fire' && k === 'orb') this.sys.vfx.emit('smoke', this.root.x, this.root.y, 1, { tint: 0x2a2220, scale: 0.18, scaleEnd: 0.6, alpha: 0.35, life: 650, speed: [0, 15] });
      }
    }
    if (this.glow) this.glow.setAlpha(0.6 + Math.sin(this.age / 50) * 0.15);
    return true;
  }

  private collide(): boolean {
    const o = this.o;
    const r = o.radius ?? 0.5;
    const cands: HitTarget[] = [];
    if (o.owner === 'enemy') {
      if (!this.sys.player.dead && Math.hypot(this.sys.player.gx - this.gx, this.sys.player.gy - this.gy) < r + 0.35) cands.push('player');
      for (const a of this.sys.allies()) if (Math.hypot(a.gx - this.gx, a.gy - this.gy) < r + a.radius * 0.7) cands.push(a);
    } else {
      for (const e of this.sys.hostiles()) if (Math.hypot(e.gx - this.gx, e.gy - this.gy) < r + e.radius * 0.7) cands.push(e);
    }
    for (const t of cands) {
      const id = t === 'player' ? 'player' : t.id;
      if (this.hitIds.has(id)) continue;
      this.hitIds.add(id);
      o.onHit(this, t);
      if (this.dead) return true;
      if (this.pierced >= (o.pierce ?? 0)) { this.end(undefined); return true; }
      this.pierced++;
    }
    return false;
  }

  /** `null` = ended in the open (wall / range) and onHit is called with null; `undefined` = silent end after a hit. */
  end(target: null | undefined): void {
    if (this.dead) return;
    if (target === null) this.o.onHit(this, null);
    this.destroy();
  }

  destroy(): void {
    this.dead = true;
    if (this.light) this.light.dead = true;
    this.root.destroy();
  }
}