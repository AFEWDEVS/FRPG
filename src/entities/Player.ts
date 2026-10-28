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
  setPath(path: GridPos[]): void { this.path = path; }
  stop(): void { this.path = []; }

  tick(_time: number, dtMs: number): void {
    this.moving = false;
    if (!this.locked && !this.dead && this.path.length) {
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