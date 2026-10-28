import { computeDerived } from '../combat/stats';
import { GameState } from '../core/GameState';

export interface DerivedView {
  str: number; dex: number; vit: number; ene: number;
  maxLife: number; maxMana: number; damage: [number, number]; armor: number;
  fireRes: number; coldRes: number; lightRes: number;
  moveSpeed: number; attackSpeed: number; castSpeed: number; critChance: number;
  lifeSteal: number; magicFind: number; goldFind: number; lifeRegen: number; manaRegen: number;
}

/** Stats shown in the character sheet, computed by the combat module's computeDerived. */
export function getDerived(): DerivedView {
  const p = GameState.profile;
  const d = computeDerived({ classId: p.classId, level: p.level, stats: p.stats, equipment: p.equipment });
  return {
    str: d.str, dex: d.dex, vit: d.vit, ene: d.ene, maxLife: d.maxLife, maxMana: d.maxMana,
    damage: [Math.round(d.damageMin), Math.round(d.damageMax)], armor: d.armor,
    fireRes: d.fireRes, coldRes: d.coldRes, lightRes: d.lightRes,
    moveSpeed: Math.round((d.moveSpeed - 1) * 100), attackSpeed: Math.round((d.attackSpeed - 1) * 100), castSpeed: Math.round((d.castSpeed - 1) * 100),
    critChance: Math.round(d.critChance), lifeSteal: d.lifeSteal, magicFind: d.magicFind, goldFind: d.goldFind,
    lifeRegen: d.lifeRegen, manaRegen: d.manaRegen,
  };
}
