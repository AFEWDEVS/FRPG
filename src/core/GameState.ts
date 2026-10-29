import { computeDerived, type DerivedStats } from '../combat/stats';
import { CLASSES } from '../data/classes';
import type { EquipSlot, Item } from "../items/types";
import type { InvEntry } from "../items/inventory";
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
  /** 10x4 grid, multi-cell items stored with their top-left cell. */
  inventory: InvEntry[];
  equipment: Partial<Record<EquipSlot, Item>>;
  /** 4 potion belt slots (one potion each). */
  belt: (Item | null)[];
  stash?: InvEntry[];
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
  /** Combat stamina (not saved; refilled on load / respawn). */
  stamina = 100;

  constructor() {
    // Generic XP grant (quest rewards etc.).
    EventBus.on('xp:grant', ({ amount }) => { if (this.profile && amount > 0) this.gainXp(amount); });
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
      skills: { [c.skillIds[0]]: 1 }, skillSlots: ['attack', c.skillIds[0], c.skillIds[0], null, null, null, null, null],
      inventory: [], equipment: {}, belt: [null, null, null, null], potions: { health: 2, mana: 1 },
    };
    this.flags = { w1BossBeaten: false, gameCompleted: false, quests: {} };
    this.life = this.maxLife;
    this.mana = this.maxMana;
    this.stamina = this.maxStamina;
    this.save();
  }

  load(): boolean {
    const d = SaveManager.load<SaveData>();
    if (!d) return false;
    this.profile = d.profile;
    const pr = this.profile;
    if (!Array.isArray(pr.inventory) || pr.inventory.some((e) => !e || !(e as InvEntry).item)) pr.inventory = [];
    if (!pr.equipment || Object.values(pr.equipment).some((i) => i && !(i as Item).uid)) pr.equipment = {};
    if (!Array.isArray(pr.belt)) pr.belt = [null, null, null, null];
    this.flags = d.flags;
    this.life = this.maxLife;
    this.mana = this.maxMana;
    this.stamina = this.maxStamina;
    return true;
  }
  save(): void {
    if (this.profile) SaveManager.save({ profile: this.profile, flags: this.flags } satisfies SaveData);
  }

  /** Derived combat stats (class + attributes + equipment). */
  get derived(): DerivedStats {
    const p = this.profile;
    return computeDerived({ classId: p.classId, level: p.level, stats: p.stats, equipment: p.equipment as Record<string, unknown> });
  }
  get maxLife(): number { return this.derived.maxLife; }
  get maxMana(): number { return this.derived.maxMana; }
  get maxStamina(): number { return this.derived.maxStamina; }

  // --- shared-contract aliases over `profile` ---
  get level(): number { return this.profile.level; }
  get xp(): number { return this.profile.xp; }
  get attrs(): Stats { return this.profile.stats; }
  get statPoints(): number { return this.profile.statPoints; }
  get skillPoints(): number { return this.profile.skillPoints; }
  get skillLevels(): Record<string, number> { return this.profile.skills; }
  /** Live view over profile.skillSlots: left ('attack' | skillId), right, six hotkeys. */
  get hotbar(): { left: string; right: string | null; keys: (string | null)[] } {
    const s = this.profile.skillSlots;
    return { left: s[0] ?? 'attack', right: s[1] ?? null, keys: s.slice(2, 8) };
  }
  get hp(): number { return this.life; }

  emitVitals(): void {
    EventBus.emit('player:vitals', { life: this.life, maxLife: this.maxLife, mana: this.mana, maxMana: this.maxMana });
  }
  emitStamina(): void {
    EventBus.emit('player:stamina', { stamina: this.stamina, max: this.maxStamina });
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
