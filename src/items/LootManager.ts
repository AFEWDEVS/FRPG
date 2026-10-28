import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { EventBus } from '../core/EventBus';
import { GameState } from '../core/GameState';
import type { AreaId } from '../core/types';
import { ENEMIES } from '../data/enemies';
import { LootDrop } from '../entities/LootDrop';
import { gridToWorld, worldToGrid } from '../iso/iso';
import { findPath, nearestWalkable } from '../iso/pathfinding';
import type { GameScene } from '../scenes/GameScene';
import type { UIScene } from '../scenes/UIScene';
import { rollDrops, type DropKind } from './generate';
import { addItem, gearBonuses, setGroundDropper } from './inventory';
import type { Item } from './types';

const AREA_LEVEL: Record<AreaId, number> = { town: 1, w1: 4, d1: 6, w2: 16, d2: 20 };

/** Monster / chest level for an area, blended with the hero's level so loot keeps pace. */
export function monsterLevel(areaId: AreaId, floor = 0, boss = false): number {
  const base = AREA_LEVEL[areaId] + floor * 2 + (boss ? 3 : 0);
  const lvl = GameState.hasProfile ? GameState.profile.level : 1;
  return Math.max(1, Math.round(base * 0.65 + lvl * 0.35));
}

interface DiedPayload {
  defId?: string; enemy?: { def?: { id?: string }; champion?: boolean }; gx?: number; gy?: number; x?: number; y?: number;
  level?: number; champion?: boolean; isChampion?: boolean; isBoss?: boolean;
}

/** Spawns ground loot from kills / chests / dropped items and handles pickup (click-to-walk, gold auto). */
export class LootManager {
  drops: LootDrop[] = [];
  private target: LootDrop | null = null;
  private targetUntil = 0;
  private repath = 0;
  private repaths = 0;
  private alt?: Phaser.Input.Keyboard.Key;
  private unsub: (() => void)[] = [];

  constructor(private scene: GameScene) {
    const kb = scene.input.keyboard;
    if (kb) { this.alt = kb.addKey('ALT', false); kb.addCapture('ALT'); }
    this.unsub.push(EventBus.on('enemy:died', (e) => this.onDied(e as unknown as DiedPayload)));
    this.unsub.push(EventBus.on('chest:opened', ({ x, y, level }) => this.drop(rollDrops(level, 'chest', this.mf(), this.gf()), x + 0.5, y + 0.5)));
    this.unsub.push(EventBus.on('loot:drop', ({ item, gx, gy }) => this.spawn({ item }, gx, gy, 0.6)));
    setGroundDropper((item) => this.spawn({ item }, scene.player.gx, scene.player.gy, 1));
  }

  private mf(): number { return gearBonuses().mods.magicFind ?? 0; }
  private gf(): number { return gearBonuses().mods.goldFind ?? 0; }

  private onDied(e: DiedPayload): void {
    let gx = e.gx, gy = e.gy;
    if (gx === undefined || gy === undefined) {
      if (e.x === undefined || e.y === undefined) return;
      const g = worldToGrid(e.x, e.y);
      gx = g.gx; gy = g.gy;
    }
    const defId = e.defId ?? e.enemy?.def?.id;
    const boss = e.isBoss ?? !!(defId && ENEMIES[defId]?.boss);
    const champ = e.isChampion ?? e.champion ?? e.enemy?.champion ?? false;
    const level = e.level ?? monsterLevel(this.scene.tr.areaId, this.scene.floor, boss);
    const kind: DropKind = boss ? 'boss' : champ ? 'champion' : 'normal';
    this.drop(rollDrops(level, kind, this.mf(), this.gf()), gx, gy);
  }

  private drop(r: { gold: number; items: Item[] }, gx: number, gy: number): void {
    if (r.gold > 0) this.spawn({ gold: r.gold }, gx, gy, 1.2);
    r.items.forEach((item, i) => this.scene.time.delayedCall(i * 90, () => this.spawn({ item }, gx, gy, 1.4)));
  }

  spawn(o: { item?: Item; gold?: number }, gx: number, gy: number, spread: number): void {
    const map = this.scene.map;
    let px = gx, py = gy;
    for (let t = 0; t < 10; t++) {
      const a = Math.random() * Math.PI * 2, r = t === 0 && spread < 0.7 ? 0 : Math.sqrt(Math.random()) * spread;
      const cx = gx + Math.cos(a) * r, cy = gy + Math.sin(a) * r;
      if (!map.isWalkable(Math.floor(cx), Math.floor(cy))) continue;
      if (this.drops.some((d) => Math.hypot(d.gx - cx, d.gy - cy) < 0.55)) continue;
      px = cx; py = cy;
      break;
    }
    const d = new LootDrop(this.scene, { gx: px, gy: py, item: o.item, gold: o.gold }, (drop, p) => this.onClick(drop, p));
    this.drops.push(d);
    if (o.item) AudioManager.sfx('drop_item', { volume: 0.6 });
  }

  private onClick(d: LootDrop, p: Phaser.Input.Pointer): void {
    const ui = this.scene.scene.get('UI') as UIScene | undefined;
    if (ui?.sys?.isActive() && ui.coversPoint(p.x, p.y)) return;
    this.target = d;
    this.targetUntil = this.scene.time.now + 9000;
    this.repath = 0;
    this.repaths = 0;
    this.walkTo(d);
  }

  private walkTo(d: LootDrop): void {
    const sc = this.scene, m = sc.map;
    const goal = nearestWalkable(m.isWalkable, { gx: Math.floor(d.gx), gy: Math.floor(d.gy) }, 3);
    if (!goal) return;
    const path = findPath(m.width, m.height, m.isWalkable, { gx: Math.floor(sc.player.gx), gy: Math.floor(sc.player.gy) }, goal);
    if (path) sc.player.setPath(path);
  }

  private pickup(d: LootDrop): void {
    const sc = this.scene;
    const w = gridToWorld(d.gx, d.gy);
    if (d.item) {
      if (!addItem(d.item)) {
        EventBus.emit('ui:toast', { text: 'Inventario lleno.', color: '#ff7060' });
        this.target = null;
        return;
      }
      AudioManager.sfx('item_pickup');
      sc.vfx.floatingText(d.item.name, w.x, w.y - 40, { size: 15, duration: 900, rise: 30 });
    } else {
      GameState.addGold(d.gold);
      AudioManager.sfx('gold_pickup');
      sc.vfx.floatingText(`+${d.gold} oro`, w.x, w.y - 40, { color: '#ffd24a', size: 16, duration: 800, rise: 30 });
    }
    if (this.target === d) this.target = null;
    this.drops.splice(this.drops.indexOf(d), 1);
    d.destroy();
    EventBus.emit('inventory:changed');
  }

  update(time: number, dtMs: number): void {
    const pl = this.scene.player;
    const alt = !!this.alt?.isDown;
    for (const d of [...this.drops]) {
      d.refresh(alt);
      const dist = Math.hypot(d.gx - pl.gx, d.gy - pl.gy);
      if (!d.item && dist < 1.5 && time - d.bornAt > 350) this.pickup(d);
    }
    const t = this.target;
    if (t) {
      if (time > this.targetUntil || !this.drops.includes(t)) { this.target = null; return; }
      const dist = Math.hypot(t.gx - pl.gx, t.gy - pl.gy);
      if (dist < 1.25) this.pickup(t);
      else if (!pl.hasPath && this.repaths < 3) {
        this.repath -= dtMs;
        if (this.repath <= 0) { this.repath = 400; this.repaths++; this.walkTo(t); }
      }
    }
  }

  destroy(): void {
    this.unsub.forEach((u) => u());
    this.unsub = [];
    setGroundDropper(null);
    this.drops.forEach((d) => d.destroy());
    this.drops = [];
  }
}