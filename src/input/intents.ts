export type SkillSlot = 'left' | 'right' | 1 | 2 | 3 | 4 | 5 | 6;
export type PanelId = 'inventory' | 'character' | 'skills' | 'quests' | 'map';

/**
 * Everything a controller (mouse+keyboard now, virtual joystick/touch later) can ask the game to do.
 * Grid coordinates are continuous (see iso/iso.ts).
 */
export type Intent =
  | { type: 'move'; gx: number; gy: number; held: boolean; /** NPC under the cursor (click lands on its body, not its feet). */ npcId?: string }
  | { type: 'attack'; targetId: string }
  | { type: 'skill'; slot: SkillSlot; gx: number; gy: number; targetId?: string }
  | { type: 'panel'; panel: PanelId }
  | { type: 'closePanels' }
  /** Dodge roll toward a grid point (pointer or stick direction). */
  | { type: 'dodge'; gx: number; gy: number }
  /** Heavy attack: 'start' on hold, 'release' on button up (charged). */
  | { type: 'heavy'; phase: 'start' | 'release'; gx: number; gy: number; targetId?: string }
  | { type: 'block'; down: boolean }
  | { type: 'sprint'; on: boolean }
  | { type: 'menu' };