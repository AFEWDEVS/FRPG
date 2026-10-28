import Phaser from 'phaser';
import { EventBus } from '../core/EventBus';
import { CHAMPION_AFFIXES, ENEMIES, type EnemyDef } from '../data/enemies';
import { Entity } from './Entity';

export interface EnemySpawn {
  defId: string;
  gx: number;
  gy: number;
  champion?: boolean;
  affixes?: string[];
}

type WalkFn = (i: number, j: number) => boolean;

/** Enemy stub: idle / chase AI, damage + death. Attacks, drops and skills are added by the combat module. */
export class Enemy extends Entity {
  readonly def: EnemyDef;
  readonly champion: boolean;
  readonly affixes: string[];
  dead = false;
  /** Set by charm effects (Serenata): the enemy follows and does not chase the player. */
  charmed = false;
  private aggro = false;
  private aggroRange = 8;

  constructor(scene: Phaser.Scene, s: EnemySpawn, private walk: WalkFn) {
    const def = ENEMIES[s.defId] ?? ENEMIES.goblin;
    super(scene, { kind: 'enemy', textureKey: def.textureKey, gx: s.gx + 0.5, gy: s.gy + 0.5, scale: def.scale, radius: 0.6 * def.scale });
    this.def = def;
    this.champion = !!s.champion || !!def.boss;
    this.affixes = s.affixes ?? [];
    const mult = s.champion ? 2.5 : 1;
    this.maxHp = this.hp = Math.round(def.hp * mult);
    this.speed = def.speed * (this.affixes.includes('fast') ? 1.3 : 1);
    if (s.champion) {
      this.sprite.setTint(0x88aaff);
      this.anim.baseTint = 0x88aaff;
      const names = this.affixes.map((a) => CHAMPION_AFFIXES.find((c) => c.id === a)?.name ?? a).join(' ');
      this.addLabel(`${def.name} (${names})`, '#7fa6ff');
    } else if (def.boss) {
      this.addLabel(def.name, '#ffd24a');
      this.aggroRange = 12;
    }
    EventBus.emit('enemy:spawned', { id: this.id, defId: def.id });
  }

  takeDamage(amount: number): void {
    if (this.dead) return;
    this.hp = Math.max(0, this.hp - amount);
    this.aggro = true;
    this.anim.flash();
    EventBus.emit('enemy:damaged', { id: this.id, amount, hp: this.hp });
    if (this.hp <= 0) this.die();
  }

  private die(): void {
    this.dead = true;
    EventBus.emit('enemy:died', { id: this.id, defId: this.def.id, gx: this.gx, gy: this.gy, xp: Math.round(this.def.xp * (this.champion ? 2 : 1)), champion: this.champion });
    if (this.def.boss) EventBus.emit('boss:defeated', { bossId: this.def.id });
    this.scene.tweens.add({ targets: this, alpha: 0, duration: 600, onComplete: () => this.destroy() });
  }

  /** Move toward a grid point with axis sliding. Returns true if moved. */
  protected stepToward(tx: number, ty: number, dtMs: number, stopDist: number): boolean {
    const dx = tx - this.gx, dy = ty - this.gy;
    const d = Math.hypot(dx, dy);
    if (d <= stopDist) return false;
    const step = Math.min(d - stopDist, (this.speed * dtMs) / 1000);
    const nx = this.gx + (dx / d) * step, ny = this.gy + (dy / d) * step;
    const ok = (x: number, y: number) => this.walk(Math.floor(x), Math.floor(y));
    if (ok(nx, ny)) { this.gx = nx; this.gy = ny; }
    else if (ok(nx, this.gy)) this.gx = nx;
    else if (ok(this.gx, ny)) this.gy = ny;
    else return false;
    this.faceGrid(dx, dy);
    this.syncPosition();
    return true;
  }

  /** `target` is the player (or an ally). */
  tickAI(target: { gx: number; gy: number } | null, dtMs: number): void {
    if (this.dead) return;
    this.moving = false;
    if (target && !this.charmed) {
      const d = this.distanceTo(target);
      if (d < this.aggroRange) this.aggro = true;
      if (this.aggro && d < this.aggroRange * 2) this.moving = this.stepToward(target.gx, target.gy, dtMs, 1.0);
    }
  }

  tick(_time: number, dtMs: number): void {
    this.anim.update(dtMs, this.moving);
  }
}