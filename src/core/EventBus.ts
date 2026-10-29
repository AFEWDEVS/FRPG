import Phaser from 'phaser';
import type { AreaId, ClassId } from './types';

/** Typed event map. Add new events here so every module shares the contract. */
export interface GameEvents {
  'area:entered': { areaId: AreaId; floor: number; seed: number; name: string };
  'area:leaving': { areaId: AreaId };
  'player:vitals': { life: number; maxLife: number; mana: number; maxMana: number };
  'player:xp': { level: number; xp: number; xpNext: number };
  'player:levelup': { level: number };
  'player:gold': { gold: number };
  'player:died': undefined;
  'player:moved': { gx: number; gy: number };
  'enemy:spawned': { id: string; defId: string };
  'enemy:damaged': { id: string; amount: number; hp: number };
  /** gx/gy are grid coords, x/y world px (feet). `enemy` is the live Enemy entity (typed loosely to avoid an import cycle). */
  'enemy:died': { id: string; defId: string; gx: number; gy: number; xp: number; champion: boolean; enemy?: unknown; x?: number; y?: number; level?: number; isChampion?: boolean; isBoss?: boolean };
  'skill:failed': { skillId: string; reason: 'mana' | 'cooldown' };
  'skill:learned': { skillId: string; level: number };
  'player:respawn': { goldLost: number };
  'player:damaged': { amount: number; type: string; life: number };
  'boss:defeated': { bossId: string };
  'npc:talk': { npcId: string };
  'quest:update': { questId: string };
  'ui:togglePanel': { panel: 'inventory' | 'character' | 'skills' | 'quests' | 'map' };
  'ui:closePanels': undefined;
  'ui:menu': undefined;
  'skill:use': { slot: 'left' | 'right' | 1 | 2 | 3 | 4 | 5 | 6; gx: number; gy: number; targetId?: string };
  'game:newGame': { name: string; classId: ClassId };
  'settings:changed': undefined;
  'dialogue:show': { speaker: string; portrait: string; text: string; choices?: { id: string; text: string }[]; /** speaker id ('hero','elder'...) for colour / voice */ who?: string; /** punch the portrait */ emphasis?: boolean };
  /** Make an NPC play an emote bubble (npcId: 'elder' | 'bard' | 'merchant' | 'healer'). */
  'npc:emote': { npcId: string; emote: string };
  /** Generic emote: target = 'player' | npc id | enemy id | boss def id; name = heart sweat ! ? angry music sparkle zzz blush broken dots laugh. */
  'emote:show': { target: string; name: string };
  'dialogue:choice': { id: string };
  'dialogue:hide': undefined;
  'quests:updated': { id: string; title: string; description: string; steps: { text: string; done: boolean }[]; done: boolean }[];
  'ui:toast': { text: string; color?: string };
  'npc:interact': { npcId: string };
  'xp:grant': { amount: number };
  // --- UI / items module ---
  'equipment:changed': undefined;
  'inventory:changed': undefined;
  'stats:changed': undefined;
  'skills:changed': undefined;
  'skill:cooldown': { skillId: string; remaining: number; total: number };
  'chest:opened': { x: number; y: number; level: number };
  'loot:drop': { item: import('../items/types').Item; gx: number; gy: number };
  'boss:engaged': { bossId: string; name: string; hp?: number; maxHp?: number };
  'boss:hp': { bossId?: string; hp: number; maxHp: number };
  /** Boss poise bar (stagger meter). value drops when hit, regenerates after a delay; at 0 the boss is staggered. */
  'boss:poise': { bossId?: string; value: number; max: number };
  /** Hero stamina (throttled ~90 ms). exhausted = 0-stamina state until 25% regenerated. */
  'player:stamina': { stamina: number; max: number; exhausted?: boolean };
  /** Heavy-attack charge 0..1 (0 = released / cancelled). */
  'player:charge': { value: number };
  'player:parry': undefined;
  /** Cinematic mode (letterbox): UI hides the HUD while on. */
  'ui:cinematic': { on: boolean };
  'player:staggered': undefined;
  'enemy:staggered': { id: string; defId: string; boss: boolean };
  // --- raw combat inputs (keyboard now, touch later): the InputController/GameScene turns Intents into these ---
  'input:dodge': { gx: number; gy: number };
  'input:heavy': { phase: 'start' | 'release'; gx: number; gy: number; targetId?: string };
  'input:block': { down: boolean };
  'input:sprint': { on: boolean };
  'boss:taunt': { bossId?: string; text: string };
  'quest:item': { questId: string; itemKey: string; name: string };
}

type Key = keyof GameEvents;

class TypedBus {
  private em = new Phaser.Events.EventEmitter();
  on<K extends Key>(e: K, fn: (p: GameEvents[K]) => void, ctx?: unknown): () => void {
    this.em.on(e, fn, ctx);
    return () => this.em.off(e, fn, ctx);
  }
  once<K extends Key>(e: K, fn: (p: GameEvents[K]) => void, ctx?: unknown): void {
    this.em.once(e, fn, ctx);
  }
  off<K extends Key>(e: K, fn?: (p: GameEvents[K]) => void, ctx?: unknown): void {
    this.em.off(e, fn, ctx);
  }
  emit<K extends Key>(e: K, ...p: GameEvents[K] extends undefined ? [] : [GameEvents[K]]): void {
    this.em.emit(e, ...p);
  }
}

export const EventBus = new TypedBus();
