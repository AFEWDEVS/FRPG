import Phaser from 'phaser';
import { CLASSES } from '../data/classes';
import { EventBus } from '../core/EventBus';
import type { GridPos } from '../core/types';
import { GameState } from '../core/GameState';
import { cellCenterWorld } from '../iso/iso';
import { Entity } from './Entity';

export class Player extends Entity {
  private path: GridPos[] = [];
  private lastCell = { i: -1, j: -1 };
  /** Fired once per footfall; GameScene hooks footstep sfx here. */
  onStep?: () => void;
  /** Multiplier from skills/items (e.g. Paso Ligero). */
  speedMultiplier = 1;
  /** Combat modules set this to freeze movement (casting, stunned). */
  locked = false;
  dead = false;
  /** Poema del Ogro: movement orders are scrambled until this time (scene time ms). */
  confusedUntil = 0;
  /** True while a dash tween is moving the hero. */
  dashing = false;
  /** Walkability predicate for confusion jitter / dashes (set by CombatSystem). */
  walkable?: (i: number, j: number) => boolean;
  private deathShown = false;

  constructor(scene: Phaser.Scene, gx: number, gy: number) {
    const cls = CLASSES[GameState.profile.classId];
    super(scene, { kind: 'player', textureKey: cls.textureKey, gx, gy, id: 'player' });
    this.speed = cls.speed;
    this.hp = GameState.life;
    this.maxHp = GameState.maxLife;
    this.anim.onStep = () => this.onStep?.();
  }

  get hasPath(): boolean { return this.path.length > 0; }

  /** Replace the current path (cells excluding start). */
  setPath(path: GridPos[]): void {
    if (this.scene.time.now < this.confusedUntil && path.length) {
      // confusion: sometimes ignore the order, otherwise stumble through a random neighbour cell first
      if (Math.random() < 0.35) return;
      const last = path[path.length - 1];
      const i = Math.floor(this.gx) + Phaser.Math.Between(-2, 2), j = Math.floor(this.gy) + Phaser.Math.Between(-2, 2);
      if (!this.walkable || this.walkable(i, j)) path = [{ gx: i, gy: j }, ...path.slice(Math.min(path.length - 1, 1)), last];
    }
    this.path = path;
  }

  /** Smoothly move to a grid point over `ms` (dashes). Returns immediately; `done` runs at the end. */
  dashTo(gx: number, gy: number, ms: number, done?: () => void, onFrame?: () => void, ease = 'Cubic.easeOut'): void {
    this.path = [];
    this.dashing = true;
    this.anim.squash(0.85, 1.2);
    const sx = this.gx, sy = this.gy;
    const proxy = { t: 0 };
    this.scene.tweens.add({
      targets: proxy, t: 1, duration: ms, ease,
      onUpdate: () => { this.gx = sx + (gx - sx) * proxy.t; this.gy = sy + (gy - sy) * proxy.t; this.syncPosition(); onFrame?.(); },
      onComplete: () => { this.anim.squash(1.18, 0.82); this.dashing = false; this.gx = gx; this.gy = gy; this.syncPosition(); EventBus.emit('player:moved', { gx, gy }); done?.(); },
    });
  }

  /** Instant reposition (teleport). */
  warp(gx: number, gy: number): void {
    this.path = [];
    this.setGrid(gx, gy);
    EventBus.emit('player:moved', { gx, gy });
  }
  stop(): void { this.path = []; }

  tick(_time: number, dtMs: number): void {
    this.moving = false;
    if (this.dead !== this.deathShown) {
      this.deathShown = this.dead;
      if (this.dead) this.anim.die(true); else this.anim.revive();
    }
    if (!this.locked && !this.dead && !this.dashing && this.path.length) {
      let remaining = (this.speed * this.speedMultiplier * dtMs) / 1000;
      while (remaining > 0 && this.path.length) {
        const t = this.path[0];
        const tx = t.gx + 0.5, ty = t.gy + 0.5;
        const dx = tx - this.gx, dy = ty - this.gy;
        const d = Math.hypot(dx, dy);
        if (d <= remaining) {
          this.gx = tx; this.gy = ty; remaining -= d;
          this.path.shift();
        } else {
          this.gx += (dx / d) * remaining; this.gy += (dy / d) * remaining; remaining = 0;
        }
        if (d > 0.001) this.faceGrid(dx, dy);
        this.moving = true;
      }
      this.syncPosition();
      const i = Math.floor(this.gx), j = Math.floor(this.gy);
      if (i !== this.lastCell.i || j !== this.lastCell.j) {
        this.lastCell = { i, j };
        EventBus.emit('player:moved', { gx: this.gx, gy: this.gy });
      }
    }
    this.anim.update(dtMs, this.moving, this.speedMultiplier);
  }

  /** World position of the player's body center (for lights / aiming). */
  get centerWorld(): { x: number; y: number } {
    const c = cellCenterWorld(this.gx - 0.5, this.gy - 0.5);
    return { x: c.x, y: c.y - 40 };
  }
}