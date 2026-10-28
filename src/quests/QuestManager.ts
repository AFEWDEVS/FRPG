import type Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { EventBus } from '../core/EventBus';
import { GameState } from '../core/GameState';
import type { AreaId } from '../core/types';
import { QUESTS, QUEST_BY_ID, type QuestDef } from '../data/quests';
import { NPCS } from '../data/npcs';
import { DialogueManager } from '../dialogue/DialogueManager';
import type { VfxManager } from '../vfx/VfxManager';
import { consumeQuestItems, grantQuestItem } from './itemBridge';

export type QuestState = 'active' | 'ready' | 'done';
export type NpcMarker = 'available' | 'turnin' | 'talk' | null;

/** Extra persistent quest data, stored in GameState.flags.questData (flags.quests holds the state strings). */
interface QuestData {
  progress: Record<string, number[]>;
  /** bossId -> already defeated (so a boss killed before accepting the quest still counts). */
  bosses: Record<string, boolean>;
  pity: Record<string, number>;
  seen: Record<string, boolean>;
}

interface SceneLike extends Phaser.Scene { vfx?: VfxManager; player?: { x: number; y: number }; }

const GOLD = '#ffd24a';
/** Quests unlocked by a global flag as well as by their prerequisite. */
const UNLOCK_FLAG: Record<string, string> = { q_poet: 'w1BossBeaten' };

function qd(): QuestData {
  const f = GameState.flags as Record<string, unknown>;
  if (!f.questData) f.questData = { progress: {}, bosses: {}, pity: {}, seen: {} };
  const d = f.questData as QuestData;
  d.progress ??= {}; d.bosses ??= {}; d.pity ??= {}; d.seen ??= {};
  return d;
}

class QuestManagerImpl {
  private inited = false;
  private scene: SceneLike | null = null;
  private area: AreaId = 'town';
  private endingStarted = false;

  /** Subscribe to the global bus once. Safe to call repeatedly. */
  init(): void {
    if (this.inited) return;
    this.inited = true;
    DialogueManager.init();
    EventBus.on('area:entered', ({ areaId, floor }) => {
      this.area = areaId;
      this.endingStarted = false;
      this.onEnter(areaId, floor);
    });
    EventBus.on('enemy:died', (e) => this.onEnemyDied(e as unknown as Record<string, unknown>));
    EventBus.on('boss:defeated', ({ bossId }) => this.onBoss(bossId));
    EventBus.on('ui:togglePanel', ({ panel }) => { if (panel === 'quests') this.emitLog(); });
    EventBus.on('game:newGame', () => this.emitLog());
  }

  /** GameScene tells us which scene to use for VFX / transitions. */
  bindScene(scene: Phaser.Scene): void {
    this.init();
    this.scene = scene as SceneLike;
    scene.events.once('shutdown', () => { if (this.scene === scene) this.scene = null; });
  }

  // ---------------------------------------------------------------- state queries

  state(id: string): QuestState | undefined {
    return GameState.flags.quests[id] as QuestState | undefined;
  }
  private setState(id: string, s: QuestState): void { GameState.flags.quests[id] = s; }
  seen(key: string): boolean { return !!qd().seen[key]; }
  markSeen(key: string): void { qd().seen[key] = true; }
  progress(def: QuestDef): number[] {
    const d = qd();
    const p = d.progress[def.id] ?? (d.progress[def.id] = []);
    while (p.length < def.steps.length) p.push(0);
    return p;
  }
  private need(def: QuestDef, i: number): number { return def.steps[i].count ?? 1; }
  stepDone(def: QuestDef, i: number): boolean { return this.progress(def)[i] >= this.need(def, i); }
  completedCount(): number { return QUESTS.filter((q) => this.state(q.id) === 'done').length; }

  private prereqMet(def: QuestDef): boolean {
    if (!def.prereq) return true;
    const st = this.state(def.prereq);
    if (def.autoStart) {
      const flag = UNLOCK_FLAG[def.prereq];
      return st === 'ready' || st === 'done' || (!!flag && !!GameState.flags[flag]);
    }
    return st === 'done';
  }

  /** Quests an NPC can offer right now (not started, prerequisite done). */
  availableFrom(npcId: string): QuestDef[] {
    return QUESTS.filter((q) => !q.autoStart && q.giver === npcId && !this.state(q.id) && this.prereqMet(q));
  }
  readyFor(npcId: string): QuestDef[] {
    return QUESTS.filter((q) => q.turnIn === npcId && this.state(q.id) === 'ready');
  }
  activeFrom(npcId: string): QuestDef[] {
    return QUESTS.filter((q) => q.giver === npcId && this.state(q.id) === 'active');
  }
  /** The pending 'talk' step targeting this NPC, if any. */
  pendingTalk(npcId: string): { def: QuestDef; step: number } | null {
    for (const q of QUESTS) {
      if (this.state(q.id) !== 'active') continue;
      for (let i = 0; i < q.steps.length; i++) {
        if (q.steps[i].type === 'talk' && q.steps[i].target === npcId && !this.stepDone(q, i)) return { def: q, step: i };
      }
    }
    return null;
  }

  markerFor(npcId: string): NpcMarker {
    if (this.readyFor(npcId).length) return 'turnin';
    if (this.availableFrom(npcId).length) return 'available';
    if (this.pendingTalk(npcId)) return 'talk';
    return null;
  }

  // ---------------------------------------------------------------- transitions

  accept(id: string, announce = true): void {
    const def = QUEST_BY_ID[id];
    if (!def || this.state(id)) return;
    this.setState(id, 'active');
    const p = this.progress(def);
    def.steps.forEach((s, i) => { if (s.type === 'boss' && qd().bosses[s.target]) p[i] = this.need(def, i); });
    if (announce) {
      this.toast(`Nueva misión: ${def.title}`);
      AudioManager.sfx('ui_open', { volume: 0.7 });
    }
    this.changed(id);
    this.checkReady(def);
  }

  /** Hand in a 'ready' quest. */
  turnIn(id: string): void {
    const def = QUEST_BY_ID[id];
    if (!def || this.state(id) !== 'ready') return;
    this.complete(def);
  }

  /** The dialogue module calls this when the player finished talking to a quest NPC. */
  advanceTalk(npcId: string): void {
    const t = this.pendingTalk(npcId);
    if (t) this.bump(t.def, t.step, 1);
  }

  private bump(def: QuestDef, i: number, n: number): void {
    if (this.state(def.id) !== 'active') return;
    const p = this.progress(def);
    const need = this.need(def, i);
    if (p[i] >= need) return;
    p[i] = Math.min(need, p[i] + n);
    const step = def.steps[i];
    if (step.type === 'boss' && step.itemName && step.target === 'thorn_queen') grantQuestItem(def.id, 'rose_bouquet');
    if (need > 1) this.toast(`${def.title}: ${step.itemName ?? step.text} (${p[i]}/${need})`);
    else if (p[i] >= need) this.toast(`${def.title}: objetivo cumplido`);
    AudioManager.sfx('item_pickup', { volume: 0.6 });
    this.changed(def.id);
    this.checkReady(def);
  }

  private checkReady(def: QuestDef): void {
    if (this.state(def.id) !== 'active') return;
    if (!def.steps.every((_, i) => this.stepDone(def, i))) return;
    if (def.turnIn === null) { this.complete(def); return; }
    this.setState(def.id, 'ready');
    this.toast(`${def.title}: regresa con ${NPCS[def.turnIn]?.name ?? def.turnIn}`);
    this.changed(def.id);
  }

  private complete(def: QuestDef): void {
    this.setState(def.id, 'done');
    const r = def.rewards;
    if (r.xp) EventBus.emit('xp:grant', { amount: r.xp });
    if (r.gold) GameState.addGold(r.gold);
    if (r.skillPoints) {
      GameState.profile.skillPoints += r.skillPoints;
      GameState.emitProgress();
    }
    if (def.turnIn !== null) consumeQuestItems(def.id);
    this.fanfare(def);
    if (def.turnIn === null && def.dialogue.turnIn.length) DialogueManager.queue(def.dialogue.turnIn);
    this.changed(def.id);
    GameState.save();
    // The Amaranta chain continues by itself.
    this.tryAutoStart();
  }

  private fanfare(def: QuestDef): void {
    const r = def.rewards;
    AudioManager.sfx('quest_complete');
    this.toast(`¡Misión completada: ${def.title}!`);
    const bits = [`+${r.xp} XP`, `+${r.gold} oro`];
    if (r.skillPoints) bits.push(`+${r.skillPoints} punto de habilidad`);
    this.toast(bits.join('  '), '#9fe08a');
    const s = this.scene, pl = s?.player;
    if (s && pl && s.vfx) {
      s.vfx.floatingText('¡Misión completada!', pl.x, pl.y - 170, { color: GOLD, size: 28, duration: 2200 });
      s.vfx.burst('heart', pl.x, pl.y - 70, { count: 36, tint: [0xff4f78, 0xff94b0, 0xffd0dc], speed: { min: 60, max: 220 }, gravityY: -80, lifespan: 1300, scale: { start: 0.35, end: 0 } });
      s.vfx.burst('star', pl.x, pl.y - 90, { count: 18, tint: 0xffe680, lifespan: 900 });
      AudioManager.sfx('heart_sparkle', { delay: 150 });
    }
  }

  /** Start any chained Amaranta quest whose prerequisite is met; its offer plays as a vision. */
  tryAutoStart(): void {
    for (const def of QUESTS) {
      if (!def.autoStart || this.state(def.id) || !this.prereqMet(def)) continue;
      if (def.world === 2 && this.area !== 'w2' && this.area !== 'd2') continue;
      this.accept(def.id, false);
      this.toast('Has recibido una carta mágica de Amaranta', '#ff9ec0');
      DialogueManager.queue(def.dialogue.offer, { onDone: () => this.toast(`Nueva misión: ${def.title}`) });
    }
  }

  // ---------------------------------------------------------------- events

  private onEnter(areaId: AreaId, floor: number): void {
    for (const def of QUESTS) {
      if (this.state(def.id) !== 'active') continue;
      def.steps.forEach((s, i) => {
        if (s.type === 'enter' && s.target === areaId && (s.floor === undefined || floor >= s.floor)) this.bump(def, i, 1);
      });
    }
    this.tryAutoStart();
    this.emitLog();
  }

  private onBoss(bossId: string): void {
    qd().bosses[bossId] = true;
    for (const def of QUESTS) {
      if (this.state(def.id) !== 'active') continue;
      def.steps.forEach((s, i) => { if (s.type === 'boss' && s.target === bossId) this.bump(def, i, 1); });
    }
    if (bossId === 'ogre_poet') {
      this.toast('El portal al Mundo 2 ha despertado...', '#ff9ec0');
    }
    if (bossId === 'malvarron') this.startEnding();
    GameState.save();
  }

  private onEnemyDied(p: Record<string, unknown>): void {
    const enemy = p.enemy as { defId?: string; def?: { id?: string } } | undefined;
    const defId = String(p.defId ?? enemy?.defId ?? enemy?.def?.id ?? '');
    const champion = !!(p.champion ?? p.isChampion);
    const isBoss = !!p.isBoss;
    for (const def of QUESTS) {
      if (this.state(def.id) !== 'active') continue;
      def.steps.forEach((s, i) => {
        if (this.stepDone(def, i)) return;
        if (s.type === 'kill' && s.target === defId) { this.bump(def, i, 1); return; }
        if (s.type !== 'collect' || !s.drop) return;
        const rule = s.drop;
        if (!rule.areas.includes(this.area)) return;
        const listed = rule.from.length === 0 || rule.from.includes(defId);
        const pity = qd().pity;
        const key = `${def.id}:${i}`;
        if (listed) pity[key] = (pity[key] ?? 0) + 1;
        const roll = (rule.champion && (champion || isBoss) && Math.random() < 0.7)
          || Math.random() < (listed ? rule.chance : rule.other)
          || (listed && pity[key] >= rule.pity);
        if (!roll) return;
        pity[key] = 0;
        const name = s.itemName ?? s.target;
        const need = this.need(def, i);
        grantQuestItem(def.id, s.target, need > 1 ? `${this.progress(def)[i] + 1}/${need}` : undefined);
        const sc = this.scene;
        if (sc?.vfx && sc.player) sc.vfx.floatingText(name, sc.player.x, sc.player.y - 140, { color: GOLD, size: 20, duration: 1800 });
        this.bump(def, i, 1);
      });
    }
  }

  private startEnding(): void {
    if (this.endingStarted) return;
    this.endingStarted = true;
    GameState.flags.gameCompleted = true;
    GameState.save();
    const s = this.scene;
    if (!s) return;
    s.time.delayedCall(3800, () => {
      if (this.scene !== s) return;
      s.cameras.main.fadeOut(900, 255, 255, 255);
      s.cameras.main.once('camerafadeoutcomplete', () => {
        EventBus.emit('dialogue:hide');
        s.scene.stop('UI');
        s.scene.start('Ending');
      });
    });
  }

  // ---------------------------------------------------------------- log / ui

  private toast(text: string, color = GOLD): void { EventBus.emit('ui:toast', { text, color }); }

  private changed(id: string): void {
    EventBus.emit('quest:update', { questId: id });
    this.emitLog();
  }

  log(): { id: string; title: string; description: string; steps: { text: string; done: boolean }[]; done: boolean }[] {
    const order = { active: 0, ready: 1, done: 2 };
    return QUESTS
      .filter((q) => this.state(q.id))
      .sort((a, b) => order[this.state(a.id)!] - order[this.state(b.id)!])
      .map((q) => {
        const p = this.progress(q);
        return {
          id: q.id, title: q.title,
          description: this.state(q.id) === 'ready' ? `${q.description}\n\nRegresa con ${NPCS[q.turnIn ?? '']?.name ?? 'el anciano'}.` : q.description,
          steps: q.steps.map((s, i) => {
            const n = this.need(q, i);
            return { text: n > 1 ? `${s.text} (${p[i]}/${n})` : s.text, done: p[i] >= n };
          }),
          done: this.state(q.id) === 'done',
        };
      });
  }
  emitLog(): void { if (GameState.hasProfile) EventBus.emit('quests:updated', this.log()); }
}

export const QuestManager = new QuestManagerImpl();