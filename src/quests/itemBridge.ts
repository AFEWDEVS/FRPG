import { createQuestItem, type QuestItemKind } from '../items/generate';
import { giveItem, removeQuestItem } from '../items/inventory';

const KINDS: QuestItemKind[] = ['letter_page', 'rose_bouquet', 'amulet_quest'];

/** Gives the player a quest item (inventory API from the items module). `label` e.g. "1/3". */
export function grantQuestItem(questId: string, itemKey: string, label?: string): void {
  const kind = KINDS.find((k) => k === itemKey);
  if (!kind) return;
  giveItem(createQuestItem(kind, label, questId));
}

/** Takes the quest's items out of the inventory (hand-in). */
export function consumeQuestItems(questId: string): void {
  removeQuestItem(questId);
}