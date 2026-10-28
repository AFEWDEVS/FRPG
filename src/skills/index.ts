import { EventBus } from '../core/EventBus';
import { GameState } from '../core/GameState';
import { CLASSES } from '../data/classes';
import { SKILLS, SKILL_BY_ID, type SkillDef } from '../data/skills';
import { computeDerived } from '../combat/stats';

/** Scaled value of a skill parameter at a given level. */
export function skillValue(def: SkillDef, key: string, lvl: number): number {
  const s = def.values[key];
  if (!s) return 0;
  return s[0] + s[1] * (Math.max(1, lvl) - 1);
}

export function manaCostOf(def: SkillDef, lvl: number): number { return Math.round(def.manaCost + (Math.max(1, lvl) - 1) * 0.5); }
export function cooldownMs(def: SkillDef, lvl: number): number { return Math.max(0, def.cooldown + (def.cdPerLevel ?? 0) * (Math.max(1, lvl) - 1)); }

/** Invested points in a skill. */
export function skillLevel(id: string): number { return GameState.profile.skills[id] ?? 0; }

/** Invested level plus +all skills from items (only for skills that are learned). */
export function effectiveLevel(id: string): number {
  const base = skillLevel(id);
  if (base <= 0) return 0;
  const pr = GameState.profile;
  const d = computeDerived({ classId: pr.classId, level: pr.level, stats: pr.stats, equipment: pr.equipment as Record<string, unknown> });
  return Math.min(SKILL_BY_ID[id].maxLevel + 10, base + d.allSkills);
}

const fmt = (n: number): string => {
  const r = Math.round(n * 10) / 10;
  return (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace('.', ',');
};

/** Spanish description with {values} filled for `level` (defaults to the current invested level, minimum 1). */
export function describeSkill(id: string, level?: number): string {
  const def = SKILL_BY_ID[id];
  if (!def) return '';
  const lvl = Math.max(1, level ?? skillLevel(id));
  return def.description.replace(/\{(\w+)\}/g, (_m, k: string) => {
    const s = def.values[k];
    if (!s) return `{${k}}`;
    const v = skillValue(def, k, lvl);
    return k === 'n' ? String(Math.floor(v)) : fmt(v);
  });
}

/** Why a skill cannot be learned right now, or null if it can. */
export function learnBlocker(id: string): string | null {
  const def = SKILL_BY_ID[id];
  const pr = GameState.profile;
  if (!def || def.classId !== pr.classId) return 'No es de tu clase';
  if (pr.skillPoints <= 0) return 'Sin puntos de habilidad';
  if (skillLevel(id) >= def.maxLevel) return 'Nivel máximo';
  if (pr.level < def.reqLevel) return `Requiere nivel ${def.reqLevel}`;
  for (const p of def.prereqs) if (skillLevel(p) < 1) return `Requiere ${SKILL_BY_ID[p]?.name ?? p}`;
  return null;
}

/** Spend a skill point. Returns true on success. */
export function learnSkill(id: string): boolean {
  if (learnBlocker(id)) return false;
  const pr = GameState.profile;
  pr.skills[id] = skillLevel(id) + 1;
  pr.skillPoints--;
  EventBus.emit('skill:learned', { skillId: id, level: pr.skills[id] });
  GameState.save();
  return true;
}

export function skillsOfClass(): SkillDef[] { return SKILLS.filter((s) => s.classId === GameState.profile.classId); }

/** Assign a skill (or 'attack' / null) to a hotbar slot index: 0 = left, 1 = right, 2..7 = keys 1..6. */
export function setHotbarSlot(index: number, skillId: string | null): void {
  GameState.profile.skillSlots[index] = skillId;
  GameState.save();
}

/** Makes old / fresh saves consistent: 8 slots, first class skill learned, left slot valid. */
export function normalizeHotbar(): void {
  const pr = GameState.profile;
  const cls = CLASSES[pr.classId];
  const slots = pr.skillSlots;
  while (slots.length < 8) slots.push(null);
  const total = Object.values(pr.skills).reduce((a, b) => a + b, 0);
  if (total === 0 && pr.skillPoints === 0) pr.skills[cls.skillIds[0]] = 1;
  if (!slots[0] || (slots[0] !== 'attack' && skillLevel(slots[0]) <= 0)) slots[0] = 'attack';
}