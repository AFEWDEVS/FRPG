import Phaser from 'phaser';
import { EventBus, type GameEvents } from '../../core/EventBus';
import { Panel, type UiHost } from '../Panel';
import { COL } from '../theme';

export type QuestView = GameEvents['quests:updated'][number];

let quests: QuestView[] = [];
EventBus.on('quests:updated', (l) => { quests = l; });

/** API for the quest module: push the full list of quests to the log. */
export const QuestLogView = {
  setQuests(list: QuestView[]): void { quests = list; EventBus.emit('quests:updated', list); },
  get quests(): readonly QuestView[] { return quests; },
};

export class QuestPanel extends Panel {
  private sel: string | null = null;

  constructor(host: UiHost) { super(host, 'quests', 420, 520, 'left', 'Misiones'); }

  protected build(): void {
    const s = this.host;
    if (!quests.length) {
      this.text(this.w / 2, 240, 'No tienes misiones todavía.', 17, COL.dim, 0.5, 0.5);
      this.text(this.w / 2, 270, 'Habla con la gente del pueblo.', 14, COL.dim, 0.5, 0.5);
      return;
    }
    if (!this.sel || !quests.some((q) => q.id === this.sel)) this.sel = (quests.find((q) => !q.done) ?? quests[0]).id;
    let y = 58;
    for (const q of quests) {
      const active = q.id === this.sel;
      const g = this.add(s.add.graphics());
      g.fillStyle(active ? 0x3a2c1c : 0x17100c, 0.9).fillRoundedRect(24, y, this.w - 48, 28, 6).lineStyle(1, active ? 0xd8b060 : 0x4a3a28).strokeRoundedRect(24, y, this.w - 48, 28, 6);
      this.text(34, y + 14, `${q.done ? '✔ ' : ''}${q.title}`, 15, q.done ? '#70c070' : active ? COL.gold : COL.text, 0, 0.5);
      const z = this.add(s.add.zone(this.w / 2, y + 14, this.w - 48, 28).setInteractive({ useHandCursor: true }));
      z.on('pointerdown', () => { this.host.consumeClick(); this.sel = q.id; this.refresh(); });
      z.on('pointerover', () => { void Phaser; });
      y += 32;
    }
    const q = quests.find((x) => x.id === this.sel)!;
    y += 12;
    const g2 = this.add(s.add.graphics());
    g2.lineStyle(1, 0x5a4a34).lineBetween(24, y - 6, this.w - 24, y - 6);
    const t = this.text(28, y, q.description, 14, '#d8c8a0');
    t.setWordWrapWidth(this.w - 56);
    y += t.height + 14;
    for (const st of q.steps) {
      const st1 = this.text(28, y, `${st.done ? '☑' : '☐'} ${st.text}`, 14, st.done ? '#70c070' : COL.text);
      st1.setWordWrapWidth(this.w - 56);
      y += st1.height + 6;
    }
  }
}