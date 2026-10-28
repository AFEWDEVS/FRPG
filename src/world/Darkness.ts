import Phaser from 'phaser';
import { BASE_H, BASE_W } from '../constants';
import type { AmbientDef } from '../data/areas';
import { DARKNESS_DEPTH } from '../iso/iso';

export interface StaticLight { x: number; y: number; radius: number; }

/** Short-lived or moving light (fireballs, explosions, braziers...). Mutate x/y/radius/strength freely; set `dead` to drop it. */
export interface DynamicLight { x: number; y: number; radius: number; strength: number; dead?: boolean; }

/** Props that emit light, with their radius (px). */
export const LIGHT_PROPS: Record<string, number> = {
  campfire: 260, torch: 200, brazier: 240, waypoint: 220, crystal: 160, lava_rock: 150, dungeon_entrance: 180, stairs_down: 150,
};

const MAX_DYNAMIC = 32;

/**
 * Screen-space darkness: a RenderTexture filled with the ambient color each frame, with soft holes
 * erased around the player, static light sources and dynamic lights (spells, explosions).
 */
export class Darkness {
  private rt: Phaser.GameObjects.RenderTexture;
  private light: Phaser.GameObjects.Image;
  private dyn: DynamicLight[] = [];

  constructor(private scene: Phaser.Scene, private ambient: AmbientDef, private statics: StaticLight[]) {
    this.rt = scene.add.renderTexture(0, 0, BASE_W, BASE_H).setOrigin(0, 0).setScrollFactor(0).setDepth(DARKNESS_DEPTH);
    this.light = scene.make.image({ key: 'light_mask', add: false });
    this.light.setOrigin(0.5, 0.5);
  }

  /** Register a dynamic light. Returns the same object so callers can move / kill it. */
  addLight(l: DynamicLight): DynamicLight {
    if (this.dyn.length >= MAX_DYNAMIC) this.dyn.shift();
    this.dyn.push(l);
    return l;
  }

  /** `playerX/Y` in world space. */
  update(time: number, playerX: number, playerY: number): void {
    const cam = this.scene.cameras.main;
    const rt = this.rt;
    rt.clear();
    rt.fill(this.ambient.color, this.ambient.alpha);
    const flick = 1 + Math.sin(time / 170) * 0.015 + Math.sin(time / 53) * 0.01;
    this.hole(playerX - cam.worldView.x, playerY - cam.worldView.y, this.ambient.lightRadius * flick, 1);
    for (const l of this.statics) {
      const sx = l.x - cam.worldView.x, sy = l.y - cam.worldView.y;
      if (sx < -l.radius || sy < -l.radius || sx > BASE_W + l.radius || sy > BASE_H + l.radius) continue;
      this.hole(sx, sy, l.radius * (1 + Math.sin(time / 120 + l.x) * 0.04), 1);
    }
    for (let i = this.dyn.length - 1; i >= 0; i--) {
      const l = this.dyn[i];
      if (l.dead || l.strength <= 0.01) { this.dyn.splice(i, 1); continue; }
      const sx = l.x - cam.worldView.x, sy = l.y - cam.worldView.y;
      if (sx < -l.radius || sy < -l.radius || sx > BASE_W + l.radius || sy > BASE_H + l.radius) continue;
      this.hole(sx, sy, l.radius * (0.9 + 0.1 * l.strength), Math.min(1, l.strength));
    }
  }

  private hole(sx: number, sy: number, radius: number, strength: number): void {
    this.light.setScale((radius * 2) / 512);
    this.light.setAlpha(strength);
    this.rt.erase(this.light, sx, sy);
  }

  destroy(): void { this.rt.destroy(); this.light.destroy(); this.dyn = []; }
}