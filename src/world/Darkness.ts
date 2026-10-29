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
 * The RT is screen sized and counter-scaled by 1/zoom so it covers the whole view at any camera zoom.
 */
export class Darkness {
  private rt: Phaser.GameObjects.RenderTexture;
  private light: Phaser.GameObjects.Image;
  private dyn: DynamicLight[] = [];
  private off: boolean;

  constructor(private scene: Phaser.Scene, private ambient: AmbientDef, private statics: StaticLight[]) {
    this.off = ambient.alpha < 0.15;
    this.rt = scene.add.renderTexture(BASE_W / 2, BASE_H / 2, BASE_W, BASE_H).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(DARKNESS_DEPTH);
    this.rt.setVisible(!this.off);
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
    if (this.off) return;
    const cam = this.scene.cameras.main;
    const z = cam.zoom;
    const rt = this.rt;
    rt.setScale(1 / z);
    rt.clear();
    rt.fill(this.ambient.color, this.ambient.alpha);
    const wv = cam.worldView;
    const flick = 1 + Math.sin(time / 170) * 0.015 + Math.sin(time / 53) * 0.01;
    this.hole((playerX - wv.x) * z, (playerY - wv.y) * z, this.ambient.lightRadius * flick * z, 1);
    for (const l of this.statics) {
      const sx = (l.x - wv.x) * z, sy = (l.y - wv.y) * z, r = l.radius * z;
      if (sx < -r || sy < -r || sx > BASE_W + r || sy > BASE_H + r) continue;
      const fl = 1 + Math.sin(time / 120 + l.x) * 0.04 + Math.sin(time / 47 + l.y * 0.3) * 0.03;
      this.hole(sx, sy, r * fl, 1);
    }
    for (let i = this.dyn.length - 1; i >= 0; i--) {
      const l = this.dyn[i];
      if (l.dead || l.strength <= 0.01) { this.dyn.splice(i, 1); continue; }
      const sx = (l.x - wv.x) * z, sy = (l.y - wv.y) * z, r = l.radius * z;
      if (sx < -r || sy < -r || sx > BASE_W + r || sy > BASE_H + r) continue;
      this.hole(sx, sy, r * (0.9 + 0.1 * l.strength), Math.min(1, l.strength));
    }
  }

  private hole(sx: number, sy: number, radius: number, strength: number): void {
    this.light.setScale((radius * 2) / 512);
    this.light.setAlpha(strength);
    this.rt.erase(this.light, sx, sy);
  }

  destroy(): void { this.rt.destroy(); this.light.destroy(); this.dyn = []; }
}