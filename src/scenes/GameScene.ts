import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { EventBus } from '../core/EventBus';
import { GameState } from '../core/GameState';
import { randomSeed } from '../core/SeededRNG';
import type { AreaId, AreaTransition, GridPos } from '../core/types';
import { AREAS, type AreaDef } from '../data/areas';
import { S } from '../data/strings';
import { Enemy } from '../entities/Enemy';
import { CombatSystem } from '../combat/CombatSystem';
import { areaLevel as enemyAreaLevel } from '../data/enemies';
import type { Entity } from '../entities/Entity';
import { Npc } from '../entities/Npc';
import { Player } from '../entities/Player';
import type { Intent } from '../input/intents';
import { InputController } from '../input/InputController';
import { findPath, nearestWalkable } from '../iso/pathfinding';
import { gridToWorld } from '../iso/iso';
import { QuestManager } from '../quests/QuestManager';
import { VfxManager } from '../vfx/VfxManager';
import { LootManager, monsterLevel } from '../items/LootManager';
import { buildArea } from '../world/AreaFactory';
import { Darkness, LIGHT_PROPS, type StaticLight } from '../world/Darkness';
import { Ambient, type FireSpot } from '../fx/Ambient';
import { applyGrade } from '../fx/PostFx';
import type { Marker, TileMap } from '../world/TileMap';
import { WorldRenderer } from '../world/WorldRenderer';
import type { UIScene } from './UIScene';

const WORLD_OF: Record<string, AreaId> = { d1: 'w1', d2: 'w2' };

/**
 * Hosts one area at a time. Re-entering an area (scene.restart with an AreaTransition)
 * regenerates it from a fresh seed. The HUD lives in UIScene, launched in parallel.
 */
export class GameScene extends Phaser.Scene {
  tr!: AreaTransition;
  seed = 0;
  floor = 0;
  map!: TileMap;
  areaDef!: AreaDef;
  player!: Player;
  vfx!: VfxManager;
  enemies: Enemy[] = [];
  npcs: Npc[] = [];
  loot!: LootManager;
  combat!: CombatSystem;
  private worldRenderer!: WorldRenderer;
  private darkness!: Darkness;
  private ambientFx?: Ambient;
  /** Camera zoom: default shows more world than 1:1; mouse wheel / setZoomTarget (pinch) changes it. Kept across areas. */
  static zoomPref = 0.8;
  static readonly ZOOM_MIN = 0.55;
  static readonly ZOOM_MAX = 1.25;
  private zoomTarget = GameScene.zoomPref;
  private look = { x: 0, y: 0 };
  private lastPos = { x: 0, y: 0 };
  private inputCtl!: InputController;
  private interactables: Marker[] = [];
  private pending: Marker | null = null;
  private repath = 0;
  private leaving = false;
  private unsub: (() => void)[] = [];

  constructor() { super('Game'); }

  init(data: AreaTransition): void {
    this.tr = data ?? { areaId: 'town' };
  }

  create(): void {
    if (!GameState.hasProfile) { this.scene.start('MainMenu'); return; }
    this.leaving = false;
    this.enemies = [];
    this.npcs = [];
    this.interactables = [];
    this.pending = null;

    const built = buildArea(this.tr);
    this.map = built.map;
    this.seed = built.ref.seed;
    this.floor = built.ref.floor;
    this.tr = { ...this.tr, seed: this.seed, floor: this.floor };
    this.areaDef = AREAS[this.tr.areaId];
    this.vfx = new VfxManager(this);
    QuestManager.bindScene(this);

    this.lockPortals();
    this.worldRenderer = new WorldRenderer(this, this.map);
    Enemy.areaLevel = enemyAreaLevel(this.tr.areaId, this.floor);
    Enemy.areaStart = this.time.now;
    this.spawnEntities(built.ref.entry);
    this.loot = new LootManager(this);
    this.combat = new CombatSystem(this);

    const cam = this.cameras.main;
    this.zoomTarget = GameScene.zoomPref;
    cam.setZoom(this.zoomTarget);
    cam.startFollow(this.player, true, 0.1, 0.1).setRoundPixels(false);
    // Clamp to the map's iso bounding box plus a margin (the renderer fills everything beyond with border terrain).
    const mw = this.map.width * 64, mh = this.map.height * 64, mg = 420;
    cam.setBounds(-mh - mg, -mg, mw + mh + 2 * mg, (this.map.width + this.map.height) * 32 + 2 * mg);
    cam.setBackgroundColor(this.areaDef.bg ?? '#0e1612');
    this.look = { x: 0, y: 0 };
    this.lastPos = { x: this.player.x, y: this.player.y };
    applyGrade(this, cam, this.areaDef.grade);
    this.input.on('wheel', this.onWheel, this);
    this.cameras.main.fadeIn(450);

    const lights: StaticLight[] = [];
    const fires: FireSpot[] = [];
    for (const p of this.map.props) {
      const r = LIGHT_PROPS[p.key];
      if (!r) continue;
      const a = WorldRenderer.propAnchor(p);
      lights.push({ x: a.x, y: a.y - 30, radius: r });
      if (p.key === 'torch' || p.key === 'brazier' || p.key === 'campfire') fires.push({ x: a.x, y: a.y - 30, key: p.key });
    }
    this.ambientFx = new Ambient(this, this.areaDef.fx, fires);
    this.darkness = new Darkness(this, this.areaDef.ambient, lights);
    this.vfx.setDarkness(this.darkness);

    this.inputCtl = new InputController(this, {
      pick: (wx, wy) => this.pickEntity(wx, wy),
      isBlocked: (sx, sy) => this.ui()?.coversPoint(sx, sy) ?? false,
    });
    this.inputCtl.onIntent((i) => this.handleIntent(i));

    if (import.meta.env.DEV) {
      this.input.keyboard?.on('keydown-F2', () => { GameState.flags.w1BossBeaten = true; GameState.save(); this.vfx.floatingText('DEBUG: Mundo 2 desbloqueado', this.player.x, this.player.y - 150); });
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    if (!this.scene.isActive('UI')) this.scene.launch('UI');
    this.scene.bringToTop('UI');

    AudioManager.playMusic(this.areaDef.music);
    GameState.emitVitals();
    GameState.emitProgress();
    EventBus.emit('area:entered', { areaId: this.tr.areaId, floor: this.floor, seed: this.seed, name: this.areaLabel() });
    GameState.save();
  }

  private areaLabel(): string {
    const d = this.areaDef;
    return d.floors ? `${d.name} - Nivel ${this.floor + 1}` : d.name;
  }

  private ui(): UIScene | undefined {
    const s = this.scene.get('UI') as UIScene | undefined;
    return s && s.sys?.isActive() ? s : undefined;
  }

  private cleanup(): void {
    this.unsub.forEach((u) => u());
    this.unsub = [];
    this.inputCtl?.destroy();
    this.input.off('wheel', this.onWheel, this);
    this.ambientFx?.destroy();
    this.loot?.destroy();
    this.combat?.destroy();
    this.worldRenderer?.destroy();
    this.darkness?.destroy();
  }

  /** W2 portal looks sealed until the W1 gate flag is set. */
  private lockPortals(): void {
    if (this.tr.areaId !== 'town' || GameState.flags.w1BossBeaten) return;
    for (const m of this.map.markersOf('portal')) {
      if (m.data?.to !== 'w2') continue;
      const p = this.map.props.find((q) => q.gx === m.gx && q.gy === m.gy);
      if (p) p.tint = 0x555566;
    }
  }

  private spawnEntities(entry: AreaTransition['entry']): void {
    const m = this.map;
    let at: GridPos = m.firstMarker('spawn') ?? { gx: 2, gy: 2 };
    if (entry === 'stairs_up' || entry === 'stairs_down') {
      const s = m.firstMarker(entry);
      if (s) at = nearestWalkable(m.isWalkable, { gx: s.gx, gy: s.gy + 1 }) ?? at;
    }
    at = nearestWalkable(m.isWalkable, at) ?? at;
    this.player = new Player(this, at.gx + 0.5, at.gy + 0.5);
    this.player.onStep = () => AudioManager.sfx(this.areaDef.footstep, { volume: 0.3, pitchVar: 200 });

    for (const mk of m.markers) {
      if (mk.type === 'npc') this.npcs.push(new Npc(this, String(mk.data?.npcId), mk.gx, mk.gy));
      else if (mk.type === 'enemy' || mk.type === 'boss') {
        const d = mk.data ?? {};
        this.enemies.push(new Enemy(this, {
          defId: String(d.defId), gx: mk.gx, gy: mk.gy, champion: !!d.champion, affixes: (d.affixes as string[] | undefined) ?? [],
        }, m.isWalkable));
      } else if (['portal', 'stairs_down', 'stairs_up', 'waypoint', 'dungeon_entrance', 'chest'].includes(mk.type)) {
        this.interactables.push(mk);
      }
    }
  }

  // ---------------------------------------------------------------- input

  private pickEntity(wx: number, wy: number): { id: string; kind: 'enemy' | 'npc' | 'player' } | null {
    let best: Entity | null = null;
    let bestD = Infinity;
    const cands: Entity[] = [...this.enemies.filter((e) => !e.dead && !e.charmed), ...this.npcs];
    for (const e of cands) {
      const h = e.sprite.displayHeight;
      const dx = Math.abs(wx - e.x), dy = wy - e.y;
      if (dx < e.sprite.displayWidth * 0.4 && dy > -h && dy < 20) {
        const d = Math.abs(dy + h / 2) + dx;
        if (d < bestD) { bestD = d; best = e; }
      }
    }
    return best ? { id: best.id, kind: best.kind as 'enemy' | 'npc' } : null;
  }

  private handleIntent(i: Intent): void {
    if (this.leaving || this.player.dead) return;
    switch (i.type) {
      case 'move': this.onMove(i.gx, i.gy, i.held, i.npcId); break;
      case 'attack': {
        const e = this.enemies.find((x) => x.id === i.targetId && !x.dead);
        if (e) { this.combat.attackTarget(e); this.pending = null; }
        break;
      }
      case 'skill': EventBus.emit('skill:use', { slot: i.slot, gx: i.gx, gy: i.gy, targetId: i.targetId }); break;
      case 'panel': EventBus.emit('ui:togglePanel', { panel: i.panel }); break;
      case 'closePanels': EventBus.emit('ui:closePanels'); break;
      case 'menu': EventBus.emit('ui:menu'); break;
    }
  }

  private onMove(gx: number, gy: number, held: boolean, npcId?: string): void {
    this.combat?.clearTarget();
    this.pending = null;
    if (!held) {
      const npc = (npcId ? this.npcs.find((n) => n.id === npcId) : undefined) ?? this.npcs.find((n) => Math.hypot(n.gx - gx, n.gy - gy) < 1.1);
      if (npc) { this.walkNear(npc.gx, npc.gy, 1.5); this.pendingNpc = npc; return; }
      this.pendingNpc = null;
      const it = this.interactables.find((m) => Math.hypot(m.gx + 0.5 - gx, m.gy + 0.5 - gy) < 1.2);
      if (it) {
        this.pending = it;
        this.walkNear(it.gx + 0.5, it.gy + 0.5);
        this.tryInteract();
        return;
      }
    }
    this.walkTo({ gx: Math.floor(gx), gy: Math.floor(gy) });
  }
  private pendingNpc: Npc | null = null;

  private walkTo(goal: GridPos, stopDist = 0, around?: { gx: number; gy: number }): boolean {
    const m = this.map;
    const g = nearestWalkable(m.isWalkable, goal, 5);
    if (!g) return false;
    const start = { gx: Math.floor(this.player.gx), gy: Math.floor(this.player.gy) };
    const path = findPath(m.width, m.height, m.isWalkable, start, g);
    if (!path) return false;
    if (around && stopDist > 0) {
      while (path.length && Math.hypot(path[path.length - 1].gx + 0.5 - around.gx, path[path.length - 1].gy + 0.5 - around.gy) < stopDist) path.pop();
    }
    this.player.setPath(path);
    return true;
  }
  private walkNear(gx: number, gy: number, stopDist = 0): void { this.walkTo({ gx: Math.floor(gx), gy: Math.floor(gy) }, stopDist, { gx, gy }); }

  private tryInteract(): void {
    const p = this.player;
    if (this.pendingNpc && p.distanceTo(this.pendingNpc) < 2.3 && !p.hasPath) {
      const n = this.pendingNpc;
      this.pendingNpc = null;
      this.player.faceGrid(n.gx - this.player.gx, n.gy - this.player.gy);
      AudioManager.sfx('ui_open', { volume: 0.5 });
      EventBus.emit('npc:talk', { npcId: n.def.id });
      EventBus.emit('npc:interact', { npcId: n.def.id });
      return;
    }
    const it = this.pending;
    if (!it || p.hasPath) return;
    if (Math.hypot(it.gx + 0.5 - p.gx, it.gy + 0.5 - p.gy) > 2.3) { this.pending = null; return; }
    this.pending = null;
    this.activate(it);
  }

  private say(text: string): void {
    this.vfx.floatingText(text, this.player.x, this.player.y - 150, { size: 18, duration: 2400 });
  }

  private activate(m: Marker): void {
    const id = this.tr.areaId;
    const runSeed = this.seed;
    switch (m.type) {
      case 'portal':
        if (m.data?.to === 'w2' && !GameState.flags.w1BossBeaten) { this.say(S.interact.portalLocked); return; }
        this.travelTo({ areaId: m.data?.to as AreaId, entry: 'start' });
        break;
      case 'waypoint':
        this.say(S.interact.waypoint);
        this.travelTo({ areaId: 'town', entry: 'start' });
        break;
      case 'dungeon_entrance':
        this.travelTo({ areaId: id === 'w1' ? 'd1' : 'd2', floor: 0, seed: randomSeed(), entry: 'start' });
        break;
      case 'stairs_down':
        this.travelTo({ areaId: id, floor: this.floor + 1, seed: runSeed, entry: 'stairs_up' });
        break;
      case 'stairs_up':
        if (this.floor === 0) this.travelTo({ areaId: WORLD_OF[id] ?? 'town', entry: 'start' });
        else this.travelTo({ areaId: id, floor: this.floor - 1, seed: runSeed, entry: 'stairs_down' });
        break;
      case 'chest':
        this.openChest(m);
        break;
      default: break;
    }
  }

  private openChest(m: Marker): void {
    if (m.data?.opened) return;
    m.data = { ...(m.data ?? {}), opened: true };
    this.interactables = this.interactables.filter((x) => x !== m);
    const p = this.map.props.find((q) => q.key === 'chest_closed' && q.gx === m.gx && q.gy === m.gy);
    if (p) { p.key = 'chest_open'; this.worldRenderer.spriteFor(p)?.setTexture('chest_open'); }
    AudioManager.sfx('chest_open');
    EventBus.emit('chest:opened', { x: m.gx, y: m.gy, level: monsterLevel(this.tr.areaId, this.floor) });
  }

  /** Leave for another area; the next scene regenerates it (fresh seed unless given). */
  travelTo(t: AreaTransition): void {
    if (this.leaving) return;
    this.leaving = true;
    AudioManager.sfx('portal');
    EventBus.emit('area:leaving', { areaId: this.tr.areaId });
    const cam = this.cameras.main;
    cam.fadeOut(420);
    cam.once('camerafadeoutcomplete', () => this.scene.restart(t));
  }

  // ---------------------------------------------------------------- loop

  update(time: number, dtMs: number): void {
    this.inputCtl.update(time);
    if (this.vfx.frozen) dtMs = 0;
    this.combat.update(time, dtMs);
    this.player.tick(time, dtMs);
    for (const n of this.npcs) n.tick(time, dtMs);
    if (!this.player.hasPath && (this.pending || this.pendingNpc)) this.tryInteract();

    this.loot.update(time, dtMs);
    this.updateCamera(dtMs);
    this.worldRenderer.update(this.cameras.main, this.player);
    this.ambientFx?.update(time, dtMs);
    this.darkness.update(time, this.player.x, this.player.y - 50);
  }

  // ---------------------------------------------------------------- camera

  /** Smoothly zoom to z (clamped). Wheel and future pinch gestures both go through here. */
  setZoomTarget(z: number): void {
    this.zoomTarget = Phaser.Math.Clamp(z, GameScene.ZOOM_MIN, GameScene.ZOOM_MAX);
    GameScene.zoomPref = this.zoomTarget;
  }

  private onWheel(ptr: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number): void {
    if (this.ui()?.coversPoint(ptr.x, ptr.y)) return;
    this.setZoomTarget(this.zoomTarget * Math.exp(-dy * 0.0014));
  }

  private updateCamera(dtMs: number): void {
    const cam = this.cameras.main;
    const dt = Math.max(1, Math.min(dtMs, 50));
    const z = cam.zoom + (this.zoomTarget - cam.zoom) * (1 - Math.exp(-dt / 90));
    cam.setZoom(Math.abs(z - this.zoomTarget) < 0.0005 ? this.zoomTarget : z);
    // look-ahead in the movement direction
    const p = this.player;
    const vx = (p.x - this.lastPos.x) / dt * 1000, vy = (p.y - this.lastPos.y) / dt * 1000;
    this.lastPos = { x: p.x, y: p.y };
    const sp = Math.hypot(vx, vy);
    const k = sp > 5 && sp < 700 ? Math.min(80, sp * 0.22) / sp : 0;
    const f = 1 - Math.exp(-dt / 380);
    this.look.x += (vx * k - this.look.x) * f;
    this.look.y += (vy * k - this.look.y) * f;
    cam.setFollowOffset(-this.look.x, -this.look.y);
  }

}
