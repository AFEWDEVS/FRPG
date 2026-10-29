import Phaser from 'phaser';
import { animMetaKey, animSheetKey, isValidMeta } from '../anim/CharacterAnimator';
import { ANIM_DIR, AUDIO_MANIFEST, CHAR_KEYS, IMAGE_MANIFEST } from '../assets/manifest';
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
    this.load.on('loaderror', (f: Phaser.Loader.File) => { if (!f.key.startsWith('anim') && !f.key.startsWith('fx_')) this.failed.push(f.key); });

    for (const e of IMAGE_MANIFEST) this.load.image(e.key, e.path);
    this.load.image('fx_cast_circle', 'assets/gen/fx/cast_circle.png');
    this.load.spritesheet('fx_levelup_angel', 'assets/gen/fx/levelup_angel.png', { frameWidth: 192, frameHeight: 192 });
    for (const a of AUDIO_MANIFEST) this.load.audio(a.key, a.urls);
    // Optional animation sheets: many do not exist yet, a failed meta file is simply ignored.
    for (const k of CHAR_KEYS) this.load.json(animMetaKey(k), `${ANIM_DIR}/${k}.json`);
  }

  create(): void {
    const n = ensurePlaceholders(this);
    if (n > 0) console.info(`[assets] ${n} imagenes generadas como placeholder; ${this.failed.length} archivos fallidos`);
    if (this.textures.exists('fx_levelup_angel') && !this.anims.exists('levelup_angel')) {
      this.anims.create({ key: 'levelup_angel', frames: this.anims.generateFrameNumbers('fx_levelup_angel', { start: 0, end: 5 }), frameRate: 12, repeat: 1 });
    }
    AudioManager.init(this.game);
    this.loadAnimSheets();
  }

  /** Second load stage: spritesheets for every character whose anim json was found and valid. */
  private loadAnimSheets(): void {
    const found: string[] = [];
    for (const k of CHAR_KEYS) {
      const m = this.cache.json.get(animMetaKey(k));
      if (!isValidMeta(m)) continue;
      this.load.spritesheet(animSheetKey(k), `${ANIM_DIR}/${k}.png`, { frameWidth: m.frameWidth, frameHeight: m.frameHeight });
      found.push(k);
    }
    if (!found.length) { this.scene.start('MainMenu'); return; }
    this.load.once('complete', () => {
      const ok = found.filter((k) => this.textures.exists(animSheetKey(k)));
      console.info(`[anim] sheets: ${ok.join(', ') || 'none'}`);
      this.scene.start('MainMenu');
    });
    this.load.start();
  }

}