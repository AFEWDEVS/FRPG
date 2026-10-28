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
  'enemy:died': { id: string; defId: string; gx: number; gy: number; xp: number; champion: boolean };
  'boss:defeated': { bossId: string };
  'npc:talk': { npcId: string };
  'quest:update': { questId: string };
  'ui:togglePanel': { panel: 'inventory' | 'character' | 'skills' | 'quests' | 'map' };
  'ui:closePanels': undefined;
  'ui:menu': undefined;
  'skill:use': { slot: 'left' | 'right' | 1 | 2 | 3 | 4 | 5 | 6; gx: number; gy: number; targetId?: string };
  'game:newGame': { name: string; classId: ClassId };
  'settings:changed': undefined;
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
