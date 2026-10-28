import Phaser from 'phaser';
import { AUDIO_MANIFEST, IMAGE_MANIFEST } from '../assets/manifest';
import { ensurePlaceholders } from '../assets/placeholders';
import { AudioManager } from '../audio/AudioManager';
import { BASE_H, BASE_W } from '../constants';
import { S } from '../data/strings';
import { textStyle } from '../ui/widgets';

/** Loads the manifest with a Diablo-like bar. Failed files are replaced by procedural placeholders. */
export class PreloadScene extends Phaser.Scene {
  private failed: string[] = [];
  constructor() { super('Preload'); }

  preload(): void {
    const cx = BASE_W / 2, cy = BASE_H / 2 + 120;
    this.add.text(cx, BASE_H / 2 - 80, S.gameTitle, textStyle(64, '#c8402a')).setOrigin(0.5);
    this.add.text(cx, BASE_H / 2 - 20, S.loading, textStyle(22)).setOrigin(0.5);
    const frame = this.add.graphics();
    frame.lineStyle(4, 0x6a5a40).strokeRect(cx - 302, cy - 16, 604, 32);
    frame.fillStyle(0x0a0606).fillRect(cx - 300, cy - 14, 600, 28);
    const bar = this.add.graphics();
    this.load.on('progress', (p: number) => {
      bar.clear().fillStyle(0x9a1c14).fillRect(cx - 298, cy - 12, 596 * p, 24);
      bar.fillStyle(0xd8503a, 0.5).fillRect(cx - 298, cy - 12, 596 * p, 8);
    });
    this.load.on('loaderror', (f: Phaser.Loader.File) => this.failed.push(f.key));

    for (const e of IMAGE_MANIFEST) this.load.image(e.key, e.path);
    for (const a of AUDIO_MANIFEST) this.load.audio(a.key, a.urls);
  }

  create(): void {
    const n = ensurePlaceholders(this);
    if (n > 0) console.info(`[assets] ${n} imagenes generadas como placeholder; ${this.failed.length} archivos fallidos`);
    AudioManager.init(this.game);
    this.scene.start('MainMenu');
  }
}