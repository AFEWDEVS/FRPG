import Phaser from 'phaser';
import { worldToGrid } from '../iso/iso';
import type { Intent, PanelId, SkillSlot } from './intents';

export interface PickResult { id: string; kind: 'enemy' | 'npc' | 'player'; }

export interface InputOptions {
  /** Returns the attackable/interactable entity under a world position, if any. */
  pick: (wx: number, wy: number) => PickResult | null;
  /** Return true when a UI element covers the screen position (swallow the click). */
  isBlocked?: (sx: number, sy: number) => boolean;
}

/**
 * Translates raw input into Intents. A touch/joystick controller can implement the same
 * `onIntent` contract (call `emit`) without GameScene changing.
 */
export class InputController {
  private handlers: ((i: Intent) => void)[] = [];
  private holding = false;
  private lastHold = 0;
  private keys: Phaser.Input.Keyboard.Key[] = [];
  enabled = true;

  constructor(private scene: Phaser.Scene, private opts: InputOptions) {
    const input = scene.input;
    input.mouse?.disableContextMenu();
    input.on('pointerdown', this.onDown, this);
    input.on('pointerup', this.onUp, this);
    input.on('pointerupoutside', this.onUp, this);
    const kb = input.keyboard;
    if (kb) {
      const bind = (code: string, fn: () => void) => {
        const k = kb.addKey(code, false);
        k.on('down', () => { if (this.enabled) fn(); });
        this.keys.push(k);
      };
      for (let n = 1; n <= 6; n++) bind(String(n), () => this.skillAtPointer(n as SkillSlot));
      const panels: [string, PanelId][] = [['I', 'inventory'], ['C', 'character'], ['T', 'skills'], ['Q', 'quests'], ['M', 'map']];
      for (const [k, p] of panels) bind(k, () => this.emit({ type: 'panel', panel: p }));
      bind('SPACE', () => this.emit({ type: 'closePanels' }));
      bind('ESC', () => this.emit({ type: 'menu' }));
    }
  }

  onIntent(fn: (i: Intent) => void): () => void {
    this.handlers.push(fn);
    return () => { this.handlers = this.handlers.filter((h) => h !== fn); };
  }
  emit(i: Intent): void { for (const h of this.handlers) h(i); }

  private pointerGrid(p: Phaser.Input.Pointer): { gx: number; gy: number } {
    p.updateWorldPoint(this.scene.cameras.main);
    return worldToGrid(p.worldX, p.worldY);
  }

  private skillAtPointer(slot: SkillSlot): void {
    const p = this.scene.input.activePointer;
    const g = this.pointerGrid(p);
    const hit = this.opts.pick(p.worldX, p.worldY);
    this.emit({ type: 'skill', slot, gx: g.gx, gy: g.gy, targetId: hit?.kind === 'enemy' ? hit.id : undefined });
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (!this.enabled || this.opts.isBlocked?.(p.x, p.y)) return;
    if (p.rightButtonDown()) { this.skillAtPointer('right'); return; }
    this.holding = true;
    this.lastHold = 0;
    this.dispatchPrimary(p, false);
  }
  private onUp(p: Phaser.Input.Pointer): void { if (!p.leftButtonDown()) this.holding = false; }

  private dispatchPrimary(p: Phaser.Input.Pointer, held: boolean): void {
    const g = this.pointerGrid(p);
    const hit = this.opts.pick(p.worldX, p.worldY);
    if (hit && hit.kind === 'enemy') this.emit({ type: 'attack', targetId: hit.id });
    else this.emit({ type: 'move', gx: g.gx, gy: g.gy, held });
  }

  /** Call every frame (hold-to-move repeats the primary action). */
  update(time: number): void {
    if (!this.holding || !this.enabled) return;
    const p = this.scene.input.activePointer;
    if (!p.leftButtonDown()) { this.holding = false; return; }
    if (time - this.lastHold > 120) {
      this.lastHold = time;
      this.dispatchPrimary(p, true);
    }
  }

  destroy(): void {
    const input = this.scene.input;
    input.off('pointerdown', this.onDown, this);
    input.off('pointerup', this.onUp, this);
    input.off('pointerupoutside', this.onUp, this);
    for (const k of this.keys) { k.removeAllListeners(); this.scene.input.keyboard?.removeKey(k, true); }
    this.keys = [];
    this.handlers = [];
  }
}