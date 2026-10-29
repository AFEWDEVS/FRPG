import Phaser from 'phaser';
import type { GradeDef } from '../data/areas';

/** Subtle bloom + vignette + colour grade on the main camera. Silently does nothing without WebGL. */
export function applyGrade(scene: Phaser.Scene, cam: Phaser.Cameras.Scene2D.Camera, g: GradeDef): void {
  try {
    if (scene.game.renderer.type !== Phaser.WEBGL) return;
    cam.postFX.clear();
    if (g.bloom > 0) cam.postFX.addBloom(0xffffff, 1, 1, 0.6, g.bloom, 3);
    if (g.vignette > 0) cam.postFX.addVignette(0.5, 0.5, 0.92, g.vignette);
    const cm = cam.postFX.addColorMatrix();
    cm.saturate(g.sat);
    cm.multiply([g.tint[0], 0, 0, 0, 0, 0, g.tint[1], 0, 0, 0, 0, 0, g.tint[2], 0, 0, 0, 0, 0, 1, 0], true);
  } catch (e) {
    console.warn('[postfx] unavailable', e);
  }
}