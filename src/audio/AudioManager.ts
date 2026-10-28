import Phaser from 'phaser';
import { SaveManager, type Settings } from '../core/SaveManager';
import { EventBus } from '../core/EventBus';

/**
 * Global audio. Keys are the short contract names ('town', 'sword_swing'); the manifest prefixes them
 * with music_/sfx_. Missing audio fails silently.
 */
class AudioManagerImpl {
  private game!: Phaser.Game;
  private settings: Settings = SaveManager.loadSettings();
  private current?: { key: string; sound: Phaser.Sound.BaseSound; target: number };
  private fades = new Set<number>();

  init(game: Phaser.Game): void { this.game = game; }

  get musicVolume(): number { return this.settings.music; }
  get sfxVolume(): number { return this.settings.sfx; }

  setVolumes(music?: number, sfx?: number): void {
    if (music !== undefined) this.settings.music = Phaser.Math.Clamp(music, 0, 1);
    if (sfx !== undefined) this.settings.sfx = Phaser.Math.Clamp(sfx, 0, 1);
    SaveManager.saveSettings(this.settings);
    if (this.current) (this.current.sound as Phaser.Sound.WebAudioSound).setVolume(this.settings.music);
    EventBus.emit('settings:changed');
  }

  private has(key: string): boolean { return !!this.game && this.game.cache.audio.exists(key); }

  /** Crossfade to a music track (no-op if already playing). */
  playMusic(name: string, fadeMs = 1200): void {
    const key = `music_${name}`;
    if (this.current?.key === key) return;
    this.fadeOutCurrent(fadeMs);
    if (!this.has(key)) { this.current = undefined; return; }
    try {
      const s = this.game.sound.add(key, { loop: true, volume: 0 });
      s.play();
      this.current = { key, sound: s, target: this.settings.music };
      this.fade(s, 0, this.settings.music, fadeMs);
    } catch { this.current = undefined; }
  }

  stopMusic(fadeMs = 800): void { this.fadeOutCurrent(fadeMs); this.current = undefined; }

  private fadeOutCurrent(ms: number): void {
    const c = this.current;
    if (!c) return;
    const s = c.sound as Phaser.Sound.WebAudioSound;
    this.fade(s, s.volume, 0, ms, () => { s.stop(); s.destroy(); });
  }

  private fade(s: Phaser.Sound.BaseSound, from: number, to: number, ms: number, done?: () => void): void {
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / Math.max(1, ms));
      try { (s as Phaser.Sound.WebAudioSound).setVolume(from + (to - from) * k); } catch { /* destroyed */ }
      if (k >= 1) { window.clearInterval(id); this.fades.delete(id); done?.(); }
    }, 40);
    this.fades.add(id);
  }

  /** Play a one-shot effect with random pitch variation (cents). */
  sfx(name: string, opts: { volume?: number; pitchVar?: number; delay?: number } = {}): void {
    const key = `sfx_${name}`;
    if (!this.has(key)) return;
    const var_ = opts.pitchVar ?? 120;
    try {
      this.game.sound.play(key, {
        volume: (opts.volume ?? 1) * this.settings.sfx,
        detune: (Math.random() * 2 - 1) * var_,
        delay: opts.delay ?? 0,
      });
    } catch { /* ignore */ }
  }
}

export const AudioManager = new AudioManagerImpl();