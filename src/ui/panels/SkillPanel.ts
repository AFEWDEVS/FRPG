import Phaser from 'phaser';
import { AudioManager } from '../../audio/AudioManager';
import { EventBus } from '../../core/EventBus';
import { GameState } from '../../core/GameState';
import { SKILLS, SKILL_BY_ID, SKILL_TREES, type SkillDef } from '../../data/skills';
import type { TipLine } from '../../items/format';
import { Panel, type UiHost } from '../Panel';
import { COL } from '../theme';

const prereqsOf = (d: SkillDef): string[] => (d as unknown as { prereqs?: string[] }).prereqs ?? [];

export class SkillPanel extends Panel {
  private tab = 0;
  private hover: string | null = null;
  private pos = new Map<string, { x: number; y: number }>();

  constructor(host: UiHost) { super(host, 'skills', 420, 520, 'right', 'Habilidades'); }

  private lvl(id: string): number { return GameState.profile.skills[id] ?? 0; }

  canInvest(d: SkillDef): boolean {
    const p = GameState.profile;
    return p.skillPoints > 0 && p.level >= d.reqLevel && this.lvl(d.id) < d.maxLevel && prereqsOf(d).every((q) => this.lvl(q) > 0);
  }

  private invest(d: SkillDef): void {
    if (!this.canInvest(d)) return;
    const p = GameState.profile;
    p.skills[d.id] = this.lvl(d.id) + 1;
    p.skillPoints--;
    // first point in a skill with an empty hotkey auto-binds it
    const slots = p.skillSlots;
    if (this.lvl(d.id) === 1 && !slots.includes(d.id)) {
      const free = slots.findIndex((s, i) => i >= 2 && !s);
      if (free >= 0) slots[free] = d.id;
    }
    AudioManager.sfx('buff', { volume: 0.5 });
    EventBus.emit('skills:changed');
    EventBus.emit('stats:changed');
  }

  private assign(d: SkillDef, slot: number): void {
    if (this.lvl(d.id) < 1) { EventBus.emit('ui:toast', { text: 'Primero aprende la habilidad.', color: '#ff7060' }); return; }
    const s = GameState.profile.skillSlots;
    // a skill occupies one hotkey; clear duplicates on hotkeys
    if (slot >= 2) for (let i = 2; i < s.length; i++) if (s[i] === d.id) s[i] = null;
    s[slot] = d.id;
    AudioManager.sfx('ui_click');
    EventBus.emit('skills:changed');
  }

  numberKey(n: number): void {
    if (!this.hover) return;
    const d = SKILL_BY_ID[this.hover];
    if (d) this.assign(d, 1 + n);
  }

  protected build(): void {
    const s = this.host, p = GameState.profile;
    const names = SKILL_TREES[p.classId];
    this.hover = null;
    this.pos.clear();
    names.forEach((nm, i) => {
      const inv = SKILLS.filter((d) => d.classId === p.classId && d.tree === i).reduce((a, d) => a + this.lvl(d.id), 0);
      this.button(18 + i * 128, 52, 124, 30, `${nm} (${inv})`, () => { this.tab = i; this.refresh(); }, this.tab !== i, 14);
    });
    this.text(this.w / 2, 100, `Puntos de habilidad: ${p.skillPoints}`, 16, p.skillPoints > 0 ? '#ffe680' : COL.dim, 0.5, 0.5);

    const list = SKILLS.filter((d) => d.classId === p.classId && d.tree === this.tab).sort((a, b) => a.reqLevel - b.reqLevel);
    const tiers = [...new Set(list.map((d) => d.reqLevel))];
    const rowH = Math.min(130, 360 / Math.max(1, tiers.length));
    for (const d of list) {
      const t = tiers.indexOf(d.reqLevel);
      const sameTier = list.filter((x) => x.reqLevel === d.reqLevel);
      const k = sameTier.indexOf(d);
      const x = (this.w * (k + 1)) / (sameTier.length + 1);
      this.pos.set(d.id, { x, y: 170 + t * rowH });
    }
    const lines = this.add(s.add.graphics());
    lines.lineStyle(3, 0x5a4a34, 0.9);
    for (const d of list) {
      const a = this.pos.get(d.id)!;
      const pre = prereqsOf(d);
      if (pre.length) for (const q of pre) { const b = this.pos.get(q); if (b) lines.lineBetween(b.x, b.y + 30, a.x, a.y - 34); }
      else {
        // decorative root: faint link to the previous tier
        const prev = list.filter((x) => x.reqLevel < d.reqLevel).pop();
        if (prev) { const b = this.pos.get(prev.id)!; lines.lineStyle(2, 0x3a2e22, 0.7).lineBetween(b.x, b.y + 34, a.x, a.y - 34); }
      }
    }
    for (const d of list) this.drawSkill(d);
    this.text(this.w / 2, 486, 'Clic izq./der.: asignar al botón del ratón  -  1-6: tecla rápida', 12, COL.dim, 0.5, 0.5);
  }

  private drawSkill(d: SkillDef): void {
    const s = this.host;
    const { x, y } = this.pos.get(d.id)!;
    const lv = this.lvl(d.id);
    const locked = GameState.profile.level < d.reqLevel;
    const g = this.add(s.add.graphics());
    g.fillStyle(0x0a0706, 0.9).fillRect(x - 34, y - 34, 68, 68).lineStyle(2, lv > 0 ? 0xd8b060 : 0x5a4a34, 1).strokeRect(x - 34, y - 34, 68, 68);
    const key = `icon_skill_${d.id}`;
    const img = this.add(s.add.image(x, y, s.textures.exists(key) ? key : 'ui_slot').setDisplaySize(60, 60));
    if (lv === 0) img.setAlpha(locked ? 0.3 : 0.6);
    this.text(x, y + 38, d.name, 12, lv > 0 ? COL.text : COL.dim, 0.5, 0);
    this.text(x + 31, y + 30, String(lv), 15, '#ffffff', 1, 1);
    if (locked) this.text(x, y, `Nv ${d.reqLevel}`, 16, '#ff6050', 0.5, 0.5);
    const z = this.add(s.add.zone(x, y, 68, 68).setInteractive({ useHandCursor: true }));
    z.on('pointerover', (ptr: Phaser.Input.Pointer) => { this.hover = d.id; this.host.tooltip.show(this.tip(d), ptr.x, ptr.y); AudioManager.sfx('ui_hover', { volume: 0.4, pitchVar: 60 }); });
    z.on('pointermove', (ptr: Phaser.Input.Pointer) => this.host.tooltip.show(this.tip(d), ptr.x, ptr.y));
    z.on('pointerout', () => { if (this.hover === d.id) this.hover = null; this.host.tooltip.hide(); });
    z.on('pointerdown', (ptr: Phaser.Input.Pointer) => { this.host.consumeClick(); this.assign(d, ptr.rightButtonDown() ? 1 : 0); });
    if (this.canInvest(d)) {
      this.button(x + 14, y - 52, 26, 26, '+', () => this.invest(d), true, 20);
    }
  }

  private tip(d: SkillDef): TipLine[] {
    const lv = this.lvl(d.id);
    const l: TipLine[] = [
      { text: d.name, color: COL.gold, size: 17 },
      { text: `Nivel ${lv} / ${d.maxLevel}`, color: '#ffffff' },
      { text: d.description, color: COL.text, size: 13 },
      { text: `Coste de maná: ${d.manaCost}`, color: '#7aa8ff', size: 13 },
    ];
    const lvlOk = GameState.profile.level >= d.reqLevel;
    l.push({ text: `Requiere nivel ${d.reqLevel}`, color: lvlOk ? '#bbbbbb' : '#ff4040', size: 13 });
    for (const q of prereqsOf(d)) {
      const ok = this.lvl(q) > 0;
      l.push({ text: `Requiere: ${SKILL_BY_ID[q]?.name ?? q}`, color: ok ? '#bbbbbb' : '#ff4040', size: 13 });
    }
    if (lv < d.maxLevel) l.push({ text: `Siguiente nivel: ${lv + 1}`, color: '#ffe680', size: 13 });
    return l;
  }
}