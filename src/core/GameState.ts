import { CLASSES } from '../data/classes';
import type { EquipSlot, ItemInstance } from '../data/items';
import { EventBus } from './EventBus';
import { SaveManager } from './SaveManager';
import type { ClassId } from './types';

export interface Stats { str: number; dex: number; vit: number; ene: number; }

export interface PlayerProfile {
  name: string;
  classId: ClassId;
  level: number;
  xp: number;
  gold: number;
  stats: Stats;
  statPoints: number;
  skillPoints: number;
  /** skillId -> invested level */
  skills: Record<string, number>;
  /** [left, right, hotkey1..hotkey6] skill ids */
  skillSlots: (string | null)[];
  inventory: ItemInstance[];
  equipment: Partial<Record<EquipSlot, ItemInstance>>;
  potions: { health: number; mana: number };
}

export interface GameFlags {
  /** Gate for World 2. Set when 'boss:defeated' arrives with bossId 'ogre_poet'. */
  w1BossBeaten: boolean;
  gameCompleted: boolean;
  /** questId -> state string (the quest module owns the semantics). */
  quests: Record<string, string>;
  [k: string]: unknown;
}

export interface SaveData { profile: PlayerProfile; flags: GameFlags; }

export function xpForLevel(level: number): number {
  return Math.floor(60 * Math.pow(level, 1.6));
}

class GameStateImpl {
  profile!: PlayerProfile;
  flags: GameFlags = { w1BossBeaten: false, gameCompleted: false, quests: {} };
  life = 100;
  mana = 50;

  constructor() {
    EventBus.on('boss:defeated', ({ bossId }) => {
      if (bossId === 'ogre_poet') this.flags.w1BossBeaten = true;
      if (bossId === 'malvarron') this.flags.gameCompleted = true;
      this.save();
    });
  }

  get hasProfile(): boolean { return !!this.profile; }

  newGame(name: string, classId: ClassId): void {
    const c = CLASSES[classId];
    this.profile = {
      name: name.trim() || 'Héroe', classId, level: 1, xp: 0, gold: 0,
      stats: { ...c.baseStats }, statPoints: 0, skillPoints: 0,
      skills: {}, skillSlots: [c.skillIds[0], null, c.skillIds[0], null, null, null, null, null],
      inventory: [], equipment: {}, potions: { health: 2, mana: 1 },
    };
    this.flags = { w1BossBeaten: false, gameCompleted: false, quests: {} };
    this.life = this.maxLife;
    this.mana = this.maxMana;
    this.save();
  }

  load(): boolean {
    const d = SaveManager.load<SaveData>();
    if (!d) return false;
    this.profile = d.profile;
    this.flags = d.flags;
    this.life = this.maxLife;
    this.mana = this.maxMana;
    return true;
  }
  save(): void {
    if (this.profile) SaveManager.save({ profile: this.profile, flags: this.flags } satisfies SaveData);
  }

  get maxLife(): number {
    const c = CLASSES[this.profile.classId];
    return Math.round(40 + this.profile.stats.vit * c.lifePerVit + (this.profile.level - 1) * 6);
  }
  get maxMana(): number {
    const c = CLASSES[this.profile.classId];
    return Math.round(10 + this.profile.stats.ene * c.manaPerEne + (this.profile.level - 1) * 2);
  }

  emitVitals(): void {
    EventBus.emit('player:vitals', { life: this.life, maxLife: this.maxLife, mana: this.mana, maxMana: this.maxMana });
  }
  emitProgress(): void {
    const p = this.profile;
    EventBus.emit('player:xp', { level: p.level, xp: p.xp, xpNext: xpForLevel(p.level) });
    EventBus.emit('player:gold', { gold: p.gold });
  }

  addGold(n: number): void {
    this.profile.gold += n;
    EventBus.emit('player:gold', { gold: this.profile.gold });
  }

  gainXp(n: number): void {
    const p = this.profile;
    p.xp += n;
    while (p.xp >= xpForLevel(p.level)) {
      p.xp -= xpForLevel(p.level);
      p.level++;
      p.statPoints += 5;
      p.skillPoints += 1;
      this.life = this.maxLife;
      this.mana = this.maxMana;
      EventBus.emit('player:levelup', { level: p.level });
      this.emitVitals();
    }
    this.emitProgress();
  }
}

export const GameState = new GameStateImpl();
