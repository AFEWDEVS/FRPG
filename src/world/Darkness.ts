import Phaser from 'phaser';
import { BASE_H, BASE_W } from '../constants';
import type { AmbientDef } from '../data/areas';
import { DARKNESS_DEPTH } from '../iso/iso';

export interface StaticLight { x: number; y: number; radius: number; }

/** Props that emit light, with their radius (px). */
export const LIGHT_PROPS: Record<string, number> = {
  campfire: 260, torch: 200, brazier: 240, waypoint: 220, crystal: 160, lava_rock: 150, dungeon_entrance: 180, stairs_down: 150,
};

/**
 * Screen-space darkness: a RenderTexture filled with the ambient color each frame, with soft holes
 * erased around the player and static light sources.
 */
export class Darkness {
  private rt: Phaser.GameObjects.RenderTexture;
  private light: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene, private ambient: AmbientDef, private statics: StaticLight[]) {
    this.rt = scene.add.renderTexture(0, 0, BASE_W, BASE_H).setOrigin(0, 0).setScrollFactor(0).setDepth(DARKNESS_DEPTH);
    this.light = scene.make.image({ key: 'light_mask', add: false });
    this.light.setOrigin(0.5, 0.5);
  }

  /** `playerX/Y` in world space. */
  update(time: number, playerX: number, playerY: number): void {
    const cam = this.scene.cameras.main;
    const rt = this.rt;
    rt.clear();
    rt.fill(this.ambient.color, this.ambient.alpha);
    const flick = 1 + Math.sin(time / 170) * 0.015 + Math.sin(time / 53) * 0.01;
    this.hole(playerX - cam.worldView.x, playerY - cam.worldView.y, this.ambient.lightRadius * flick);
    for (const l of this.statics) {
      const sx = l.x - cam.worldView.x, sy = l.y - cam.worldView.y;
      if (sx < -l.radius || sy < -l.radius || sx > BASE_W + l.radius || sy > BASE_H + l.radius) continue;
      this.hole(sx, sy, l.radius * (1 + Math.sin(time / 120 + l.x) * 0.04));
    }
  }

  private hole(sx: number, sy: number, radius: number): void {
    this.light.setScale((radius * 2) / 512);
    this.rt.erase(this.light, sx, sy);
  }

  destroy(): void { this.rt.destroy(); this.light.destroy(); }
}