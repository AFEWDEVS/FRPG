import Phaser from 'phaser';
import { ensureLightMask } from '../assets/placeholders';

/** Creates the few textures needed before loading starts, then hands off to PreloadScene. */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create(): void {
    ensureLightMask(this);
    this.scene.start('Preload');
  }
}