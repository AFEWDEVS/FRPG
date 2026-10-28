import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { BASE_H, BASE_W } from '../constants';
import { EventBus, type GameEvents } from '../core/EventBus';
import { GameState, xpForLevel } from '../core/GameState';
import { SKILL_BY_ID } from '../data/skills';
import { describeSkill } from '../skills';
import { itemTooltip } from '../items/format';
import { BELT_SIZE, useBelt } from '../items/inventory';
import type { UiHost } from './Panel';
import { COL, tx } from './theme';

type PanelId = GameEvents['ui:togglePanel']['panel'];

const BAR_Y = BASE_H - 118;
const ROW_Y = BASE_H - 58;
const ORB_R = 56;
const ORB_Y = BASE_H - 62;
const LIFE_X = 112;
const MANA_X = BASE_W - 112;
export const BELT_KEYS = ['A', 'S', 'D', 'F'];

interface Slot { x: number; y: number; size: number; icon?: Phaser.GameObjects.Image; }

/** Bottom bar: stone panel, orbs with liquid, skill buttons/hotkeys, potion belt, XP bar and panel buttons. */
export class Hud {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private unsub: (() => void)[] = [];
  private orbs: { img: Phaser.GameObjects.Image; mask: Phaser.GameObjects.Graphics; x: number; fill: number; shown: number }[] = [];
  private vit = { life: 1, maxLife: 1, mana: 1, maxMana: 1 };
  private xp = { level: 1, xp: 0, xpNext: 1 };
  private xpG!: Phaser.GameObjects.Graphics;
  private slots: Slot[] = [];
  private belt: Slot[] = [];
  private beltIcons: (Phaser.GameObjects.Image | null)[] = [null, null, null, null];
  private cdG!: Phaser.GameObjects.Graphics;
  private cd = new Map<string, { end: number; total: number }>();
  private info!: Phaser.GameObjects.Text;
  private goldT!: Phaser.GameObjects.Text;
  private plus: Record<string, Phaser.GameObjects.Container> = {};
  private phase = 0;
  private btnX: Record<string, number> = {};

  constructor(private scene: Phaser.Scene & UiHost) {
    this.build();
    const on = <K extends keyof GameEvents>(e: K, fn: (p: GameEvents[K]) => void) => this.unsub.push(EventBus.on(e, fn));
    on('player:vitals', (v) => { this.vit = v; });
    on('player:xp', (v) => { this.xp = v; this.drawXp(); this.refreshInfo(); });
    on('player:gold', () => this.refreshInfo());
    on('skills:changed', () => this.refresh());
    on('stats:changed', () => this.refresh());
    on('player:levelup', () => this.refresh());
    on('inventory:changed', () => this.refreshBelt());
    on('skill:cooldown', ({ skillId, remaining, total }) => this.cd.set(skillId, { end: performance.now() + remaining, total: Math.max(1, total) }));
    this.refresh();
  }

  private reg<T extends Phaser.GameObjects.GameObject>(o: T): T { this.objs.push(o); return o; }

  private zone(x: number, y: number, w: number, h: number, tip: () => import('../items/format').TipLine[] | null, click?: (right: boolean) => void): Phaser.GameObjects.Zone {
    const s = this.scene;
    const z = this.reg(s.add.zone(x, y, w, h).setDepth(30).setInteractive({ useHandCursor: !!click }));
    z.on('pointerover', (p: Phaser.Input.Pointer) => { const t = tip(); if (t) s.tooltip.show(t, p.x, p.y); if (click) AudioManager.sfx('ui_hover', { volume: 0.35, pitchVar: 60 }); });
    z.on('pointermove', (p: Phaser.Input.Pointer) => { const t = tip(); if (t && !s.held) s.tooltip.show(t, p.x, p.y); });
    z.on('pointerout', () => s.tooltip.hide());
    if (click) z.on('pointerdown', (p: Phaser.Input.Pointer) => { s.consumeClick(); AudioManager.sfx('ui_click'); click(p.rightButtonDown()); });
    return z;
  }

  private build(): void {
    const s = this.scene;
    // --- carved stone bar
    const bar = this.reg(s.add.graphics().setDepth(10));
    bar.fillStyle(0x000000, 0.35).fillRect(0, BAR_Y - 14, BASE_W, 14);
    if (s.textures.exists('ui_panel_stone')) this.reg(s.add.image(BASE_W / 2, BAR_Y + 59, 'ui_panel_stone').setDisplaySize(BASE_W, 118).setDepth(9).setTint(0x9a8a7a));
    bar.fillStyle(0x0c0806, 0.85).fillRect(0, BAR_Y, BASE_W, 118);
    bar.lineStyle(3, 0x8a7048, 1).lineBetween(0, BAR_Y, BASE_W, BAR_Y);
    bar.lineStyle(1, 0x2a1e12, 1).lineBetween(0, BAR_Y + 3, BASE_W, BAR_Y + 3);
    // decorative inset around centre
    bar.lineStyle(2, 0x5a4a34, 1).strokeRoundedRect(196, BAR_Y + 8, BASE_W - 392, 104, 6);
    bar.lineStyle(1, 0xa88a58, 0.5).strokeRoundedRect(200, BAR_Y + 12, BASE_W - 400, 96, 4);

    this.makeOrb(LIFE_X, 'ui_orb_health', 0x3a0808, () => [{ text: `${S_VIDA}: ${Math.ceil(this.vit.life)} / ${this.vit.maxLife}`, color: '#ff8080', size: 16 }]);
    this.makeOrb(MANA_X, 'ui_orb_mana', 0x08103a, () => [{ text: `${S_MANA}: ${Math.ceil(this.vit.mana)} / ${this.vit.maxMana}`, color: '#8fa8ff', size: 16 }]);

    // --- skill buttons and hotkeys (index = skillSlots index)
    const defs: [number, number, number, string][] = [[0, 270, 54, 'M1'], [1, 900, 54, 'M2']];
    for (let i = 0; i < 6; i++) defs.push([2 + i, 338 + i * 52, 46, String(i + 1)]);
    for (const [idx, x, size, label] of defs) {
      this.slots[idx] = { x, y: ROW_Y, size };
      this.slotFrame(x, ROW_Y, size);
      this.reg(tx(null, s, x, ROW_Y + size / 2 + 6, label, 12, COL.dim, 0.5, 0.5)).setDepth(14);
      this.zone(x, ROW_Y, size, size, () => this.skillTip(idx));
    }
    this.cdG = this.reg(s.add.graphics().setDepth(16));

    // --- potion belt
    for (let i = 0; i < BELT_SIZE; i++) {
      const x = 690 + i * 46;
      this.belt[i] = { x, y: ROW_Y, size: 40 };
      this.slotFrame(x, ROW_Y, 40);
      const k = tx(null, s, x, ROW_Y + 26, BELT_KEYS[i], 12, COL.dim, 0.5, 0.5);
      this.reg(k).setDepth(14);
      this.zone(x, ROW_Y, 40, 40, () => { const it = GameState.hasProfile ? GameState.profile.belt[i] : null; return it && !s.held ? itemTooltip(it) : null; }, () => {
        if (!s.held) useBelt(i);
      });
    }

    // --- XP bar
    this.xpG = this.reg(s.add.graphics().setDepth(14));
    this.zone(BASE_W / 2, BASE_H - 12, 760, 14, () => [
      { text: `Nivel ${this.xp.level}`, color: COL.gold, size: 15 },
      { text: `Experiencia: ${this.xp.xp} / ${this.xp.xpNext}`, color: '#ffffff', size: 13 },
    ]);

    // --- info text and panel buttons
    this.info = this.reg(tx(null, s, 214, BAR_Y + 18, '', 14, COL.text, 0, 0.5)).setDepth(14) as Phaser.GameObjects.Text;
    this.goldT = this.reg(tx(null, s, BASE_W - 214, BAR_Y + 18, '', 15, '#ffd24a', 1, 0.5)).setDepth(14) as Phaser.GameObjects.Text;
    const btns: [PanelId | 'menu', string][] = [['character', 'Personaje (C)'], ['inventory', 'Inventario (I)'], ['skills', 'Habilidades (T)'], ['quests', 'Misiones (Q)'], ['map', 'Mapa (M)'], ['menu', 'Menú (Esc)']];
    btns.forEach(([id, label], i) => {
      const x = BASE_W / 2 - 235 + i * 94, y = BAR_Y + 18;
      this.btnX[id] = x;
      const g = this.reg(s.add.graphics().setDepth(12));
      const draw = (h: boolean) => g.clear().fillStyle(h ? 0x4a3a28 : 0x261c14, 1).fillRect(x - 45, y - 12, 90, 24).lineStyle(1, h ? 0xd8b060 : 0x6a5a40, 1).strokeRect(x - 45, y - 12, 90, 24);
      draw(false);
      this.reg(tx(null, s, x, y, label, 12, COL.text, 0.5, 0.5)).setDepth(13);
      const z = this.zone(x, y, 90, 24, () => null, () => { if (id === 'menu') EventBus.emit('ui:menu'); else EventBus.emit('ui:togglePanel', { panel: id }); });
      z.on('pointerover', () => draw(true));
      z.on('pointerout', () => draw(false));
    });

    // --- level-up "+" glow buttons
    for (const [id, panel] of [['character', 'character'], ['skills', 'skills']] as const) {
      const x = this.btnX[id] + 34, y = BAR_Y - 6;
      const g = s.add.graphics();
      g.fillStyle(0xffe680, 0.35).fillCircle(0, 0, 16).fillStyle(0x6a3a08, 1).fillCircle(0, 0, 11).lineStyle(2, 0xffe680, 1).strokeCircle(0, 0, 11);
      const t = tx(null, s, 0, 0, '+', 20, '#ffe680', 0.5, 0.5);
      const c = this.reg(s.add.container(x, y, [g, t]).setDepth(31).setVisible(false));
      const z = s.add.zone(0, 0, 32, 32).setInteractive({ useHandCursor: true });
      c.add(z);
      z.on('pointerdown', () => { s.consumeClick(); AudioManager.sfx('ui_click'); EventBus.emit('ui:togglePanel', { panel }); });
      z.on('pointerover', (p: Phaser.Input.Pointer) => s.tooltip.show([{ text: id === 'character' ? 'Puntos de atributo disponibles' : 'Puntos de habilidad disponibles', color: '#ffe680' }], p.x, p.y));
      z.on('pointerout', () => s.tooltip.hide());
      this.plus[id] = c;
    }
  }

  private slotFrame(x: number, y: number, size: number): void {
    const s = this.scene;
    const g = this.reg(s.add.graphics().setDepth(11));
    g.fillStyle(0x080504, 0.9).fillRect(x - size / 2, y - size / 2, size, size).lineStyle(2, 0x7a6444, 1).strokeRect(x - size / 2, y - size / 2, size, size);
    if (s.textures.exists('ui_slot')) this.reg(s.add.image(x, y, 'ui_slot').setDisplaySize(size, size).setDepth(11).setAlpha(0.8));
  }

  private makeOrb(x: number, key: string, bgCol: number, tip: () => import('../items/format').TipLine[]): void {
    const s = this.scene;
    this.reg(s.add.circle(x, ORB_Y, ORB_R + 2, bgCol, 1).setDepth(11));
    const img = this.reg(s.add.image(x, ORB_Y, key).setDisplaySize(ORB_R * 2, ORB_R * 2).setDepth(12));
    const mg = s.make.graphics({ x: 0, y: 0 }, false);
    img.setMask(mg.createGeometryMask());
    this.reg(s.add.ellipse(x - 18, ORB_Y - 28, 34, 16, 0xffffff, 0.2).setDepth(13).setRotation(-0.5).setBlendMode(Phaser.BlendModes.ADD));
    this.reg(s.add.image(x, ORB_Y, 'ui_orb_frame').setDisplaySize(ORB_R * 2 + 18, ORB_R * 2 + 18).setDepth(15));
    this.orbs.push({ img, mask: mg, x, fill: 1, shown: 1 });
    this.zone(x, ORB_Y, ORB_R * 2, ORB_R * 2, tip);
  }

  private skillTip(idx: number): import('../items/format').TipLine[] | null {
    if (!GameState.hasProfile) return null;
    const id = GameState.profile.skillSlots[idx];
    const d = id ? SKILL_BY_ID[id] : null;
    if (id === 'attack') return [{ text: 'Ataque básico', color: COL.gold, size: 16 }, { text: 'Golpea o dispara con tu arma. No cuesta maná.', size: 13 }];
    if (!d) return [{ text: idx === 0 ? 'Botón izquierdo del ratón' : idx === 1 ? 'Botón derecho del ratón' : `Tecla ${idx - 1}`, color: COL.dim, size: 13 },
      { text: 'Asigna una habilidad en el árbol (T)', color: COL.dim, size: 12 }];
    return [{ text: d.name, color: COL.gold, size: 16 }, { text: describeSkill(d.id), size: 13 }, { text: `Maná: ${d.manaCost}`, color: '#7aa8ff', size: 13 }];
  }

  refresh(): void {
    if (!GameState.hasProfile) return;
    const p = GameState.profile;
    this.slots.forEach((sl, i) => {
      const id = p.skillSlots[i];
      const key = id === 'attack' ? `icon_item_${{ knight: 'sword', mage: 'staff', ranger: 'bow' }[p.classId] ?? 'sword'}` : id ? `icon_skill_${id}` : '';
      if (key && this.scene.textures.exists(key)) {
        if (!sl.icon) sl.icon = this.reg(this.scene.add.image(sl.x, sl.y, key).setDepth(12));
        sl.icon.setTexture(key).setDisplaySize(sl.size - 4, sl.size - 4).setVisible(true);
      } else sl.icon?.setVisible(false);
    });
    this.refreshBelt();
    this.refreshInfo();
    this.plus.character.setVisible(p.statPoints > 0);
    this.plus.skills.setVisible(p.skillPoints > 0);
  }

  private refreshBelt(): void {
    if (!GameState.hasProfile) return;
    const belt = GameState.profile.belt;
    this.belt.forEach((sl, i) => {
      const it = belt[i];
      this.beltIcons[i]?.destroy();
      this.beltIcons[i] = null;
      if (it) this.beltIcons[i] = this.reg(this.scene.add.image(sl.x, sl.y, this.scene.textures.exists(it.icon) ? it.icon : 'icon_item_potion_health').setDisplaySize(34, 34).setDepth(12));
    });
  }

  private refreshInfo(): void {
    if (!GameState.hasProfile) return;
    const p = GameState.profile;
    this.info.setText(`${p.name} - Nivel ${p.level}`);
    this.goldT.setText(`${p.gold} oro`);
    this.plus.character?.setVisible(p.statPoints > 0);
    this.plus.skills?.setVisible(p.skillPoints > 0);
  }

  private drawXp(): void {
    const w = 760, x = BASE_W / 2 - w / 2, y = BASE_H - 17, h = 9;
    const f = Math.min(1, this.xp.xp / Math.max(1, this.xp.xpNext));
    this.xpG.clear().fillStyle(0x140e0a, 1).fillRect(x, y, w, h).fillStyle(0xd8a030, 1).fillRect(x, y, w * f, h)
      .fillStyle(0xffe8a0, 0.5).fillRect(x, y, w * f, 3).lineStyle(1, 0x8a7048, 1).strokeRect(x, y, w, h);
    this.xpG.lineStyle(1, 0x000000, 0.6);
    for (let i = 1; i < 10; i++) this.xpG.lineBetween(x + (w * i) / 10, y, x + (w * i) / 10, y + h);
  }

  /** Index of the belt slot under a point, or -1. */
  beltIndexAt(px: number, py: number): number {
    return this.belt.findIndex((b) => Math.abs(px - b.x) <= b.size / 2 && Math.abs(py - b.y) <= b.size / 2);
  }
  covers(_px: number, py: number): boolean { return py >= BAR_Y - 14 + 14; }

  update(dtMs: number): void {
    this.phase += dtMs * 0.004;
    const f = [this.vit.life / Math.max(1, this.vit.maxLife), this.vit.mana / Math.max(1, this.vit.maxMana)];
    this.orbs.forEach((o, i) => {
      o.fill = Phaser.Math.Clamp(f[i], 0, 1);
      o.shown += (o.fill - o.shown) * Math.min(1, dtMs * 0.01);
      const g = o.mask.clear().fillStyle(0xffffff, 1);
      const top = ORB_Y + ORB_R - o.shown * ORB_R * 2;
      const pts: Phaser.Math.Vector2[] = [];
      for (let x = o.x - ORB_R; x <= o.x + ORB_R; x += 4) pts.push(new Phaser.Math.Vector2(x, top + Math.sin(this.phase * 1.3 + x * 0.09 + i) * 2.2 * (o.shown < 0.98 ? 1 : 0)));
      pts.push(new Phaser.Math.Vector2(o.x + ORB_R, ORB_Y + ORB_R + 2), new Phaser.Math.Vector2(o.x - ORB_R, ORB_Y + ORB_R + 2));
      g.fillPoints(pts, true);
    });
    // cooldown sweeps
    const g = this.cdG.clear();
    const now = performance.now();
    if (GameState.hasProfile) {
      this.slots.forEach((sl, i) => {
        const id = GameState.profile.skillSlots[i];
        const c = id ? this.cd.get(id) : undefined;
        if (!c) return;
        const rem = c.end - now;
        if (rem <= 0) { this.cd.delete(id!); return; }
        this.sweep(g, sl.x, sl.y, sl.size / 2, rem / c.total);
      });
    }
  }

  private sweep(g: Phaser.GameObjects.Graphics, cx: number, cy: number, half: number, frac: number): void {
    const a0 = -Math.PI / 2 + (1 - frac) * Math.PI * 2, a1 = Math.PI * 1.5;
    const pts: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(cx, cy)];
    const steps = Math.max(2, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 36));
    for (let k = 0; k <= steps; k++) {
      const a = a0 + ((a1 - a0) * k) / steps;
      const c = Math.cos(a), s = Math.sin(a), r = (half - 1) / Math.max(Math.abs(c), Math.abs(s));
      pts.push(new Phaser.Math.Vector2(cx + c * r, cy + s * r));
    }
    g.fillStyle(0x000000, 0.62).fillPoints(pts, true);
  }

  destroy(): void {
    this.unsub.forEach((u) => u());
    this.objs.forEach((o) => o.destroy());
    this.orbs.forEach((o) => o.mask.destroy());
    this.beltIcons.forEach((i) => i?.destroy());
    this.objs = [];
  }

  pulse(time: number): void {
    const k = 1 + Math.sin(time * 0.006) * 0.15;
    for (const c of Object.values(this.plus)) c.setScale(k);
  }
}

const S_VIDA = 'Vida';
const S_MANA = 'Maná';
void xpForLevel;