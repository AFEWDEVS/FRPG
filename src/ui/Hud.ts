import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { BASE_H, BASE_W } from '../constants';
import { EventBus, type GameEvents } from '../core/EventBus';
import { GameState } from '../core/GameState';
import { SKILL_BY_ID } from '../data/skills';
import { describeSkill, manaCostOf } from '../skills';
import { itemTooltip, type TipLine } from '../items/format';
import { BELT_SIZE, useBelt } from '../items/inventory';
import type { UiHost } from './Panel';
import { COL, DISPLAY, has, tx } from './theme';

type PanelId = GameEvents['ui:togglePanel']['panel'];
export const BELT_KEYS = ['A', 'S', 'D', 'F'];

// ---- layout (design space 1280x720; the canvas is FIT-scaled so it follows any resolution)
const ORB_R = 40;
const ORB_X = 66, ORB_Y = BASE_H - 60;
const BAR_X = 124, BAR_W = 190;
const SLOT_Y = BASE_H - 44, SLOT_R = 24, SLOT_STEP = 56, SLOT_X0 = 372;
const POT_X0 = SLOT_X0 + 7 * SLOT_STEP + 62, POT_STEP = 46, POT_R = 19;
const BTN_R = 20;

const anyOn = (e: string, fn: (p: never) => void): (() => void) => EventBus.on(e as never, fn as never);

/** Smooth bar with a delayed "damage chip" that trails behind the fill. */
class Bar {
  target = 1; shown = 1; chip = 1; private hold = 0;
  readonly g: Phaser.GameObjects.Graphics;
  constructor(parent: Phaser.GameObjects.Container, scene: Phaser.Scene, public x: number, public y: number, public w: number, public h: number,
    private col: number, private hi: number, private chipCol: number) {
    this.g = scene.add.graphics();
    parent.add(this.g);
  }
  set(f: number): void { f = Phaser.Math.Clamp(f, 0, 1); if (f < this.target - 0.001) this.hold = 450; this.target = f; }
  step(dt: number): void {
    this.shown += (this.target - this.shown) * Math.min(1, dt * 0.014);
    if (Math.abs(this.target - this.shown) < 0.0015) this.shown = this.target;
    if (this.shown >= this.chip) this.chip = this.shown;
    else if (this.hold > 0) this.hold -= dt;
    else this.chip += (this.shown - this.chip) * Math.min(1, dt * 0.005);
    this.draw();
  }
  draw(): void {
    const { x, y, w, h } = this, g = this.g.clear(), r = h / 2;
    g.fillStyle(0x000000, 0.45).fillRoundedRect(x - 1, y - 1, w + 2, h + 2, r + 1);
    if (this.chip > this.shown) g.fillStyle(this.chipCol, 0.85).fillRoundedRect(x, y, Math.max(h, w * this.chip), h, r);
    if (this.shown > 0.002) {
      const fw = Math.max(h, w * this.shown);
      g.fillStyle(this.col, 1).fillRoundedRect(x, y, fw, h, r);
      g.fillStyle(this.hi, 0.55).fillRoundedRect(x + 1, y + 1, fw - 2, Math.max(1.5, h * 0.38), r);
    }
    g.lineStyle(1, 0xc8a46a, 0.5).strokeRoundedRect(x - 0.5, y - 0.5, w + 1, h + 1, r + 1);
  }
}

interface Slot { x: number; y: number; r: number; icon?: Phaser.GameObjects.Image; ring: Phaser.GameObjects.Graphics; }

function makeCanvasTex(scene: Phaser.Scene, key: string, w: number, h: number, paint: (c: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h);
  if (!t) return;
  paint(t.getContext());
  t.refresh();
}

/**
 * Minimal painted HUD. Bottom-left: life orb + mana/stamina bars; bottom-centre: round skill slots + potions;
 * very bottom: thin XP line; top-right: icon buttons, gold and quest tracker. Everything lives in `root` so it can fade away.
 */
export class Hud {
  private root: Phaser.GameObjects.Container;
  private left: Phaser.GameObjects.Container;
  private unsub: (() => void)[] = [];
  private vit = { life: 1, maxLife: 1, mana: 1, maxMana: 1 };
  private xp = { level: 1, xp: 0, xpNext: 1 };
  private xpG: Phaser.GameObjects.Graphics;
  private slots: Slot[] = [];
  private belt: Slot[] = [];
  private beltIcons: (Phaser.GameObjects.Image | null)[] = [null, null, null, null];
  private cdG: Phaser.GameObjects.Graphics;
  private cd = new Map<string, { end: number; total: number }>();
  private info!: Phaser.GameObjects.Text;
  private goldT!: Phaser.GameObjects.Text;
  private questT!: Phaser.GameObjects.Text;
  private questStep!: Phaser.GameObjects.Text;
  private dots: Record<string, Phaser.GameObjects.Graphics> = {};
  private lifeBar!: { chip: Phaser.GameObjects.Image; fill: Phaser.GameObjects.Image; mc: Phaser.GameObjects.Graphics; mf: Phaser.GameObjects.Graphics };
  private lifeShown = 1; private lifeChip = 1; private lifeHold = 0;
  private mana: Bar; private stam: Bar;
  private stamV = { s: 1, max: 1 };
  private vignette: Phaser.GameObjects.Image;
  private flash = 0;
  private phase = 0;
  private hidden = false;
  private lx = 0;
  private quests: GameEvents['quests:updated'] = [];

  constructor(private scene: Phaser.Scene & UiHost) {
    this.root = scene.add.container(0, 0).setDepth(10);
    makeCanvasTex(scene, 'hud_vignette', 256, 144, (c) => {
      const g = c.createRadialGradient(128, 72, 40, 128, 72, 150);
      g.addColorStop(0, 'rgba(140,0,0,0)'); g.addColorStop(0.65, 'rgba(120,0,0,0.25)'); g.addColorStop(1, 'rgba(90,0,0,0.95)');
      c.fillStyle = g; c.fillRect(0, 0, 256, 144);
    });
    for (const [k, a, b, d] of [['hud_orb_life', '#ff7a6a', '#b01c1c', '#3a0606'], ['hud_orb_mana', '#8ab0ff', '#2a48c8', '#0a1240']] as const) {
      makeCanvasTex(scene, k, 128, 128, (c) => {
        const g = c.createRadialGradient(46, 40, 6, 64, 64, 64);
        g.addColorStop(0, a); g.addColorStop(0.55, b); g.addColorStop(1, d);
        c.fillStyle = g; c.beginPath(); c.arc(64, 64, 63, 0, Math.PI * 2); c.fill();
      });
    }
    this.vignette = scene.add.image(BASE_W / 2, BASE_H / 2, 'hud_vignette').setDisplaySize(BASE_W, BASE_H).setAlpha(0);
    this.root.add(this.vignette);
    this.left = scene.add.container(0, 0);
    this.root.add(this.left);
    this.xpG = scene.add.graphics();
    this.cdG = scene.add.graphics();
    this.mana = new Bar(this.left, scene, BAR_X, BASE_H - 56, BAR_W, 10, 0x3a64d8, 0x9cc0ff, 0xdfe8ff);
    this.stam = new Bar(this.left, scene, BAR_X, BASE_H - 40, BAR_W, 7, 0xd8a838, 0xfff0a8, 0xffffff);
    this.build();
    const on = <K extends keyof GameEvents>(e: K, fn: (p: GameEvents[K]) => void) => this.unsub.push(EventBus.on(e, fn));
    on('player:vitals', (v) => { this.vit = v; });
    on('player:xp', (v) => { this.xp = v; this.drawXp(); this.refreshInfo(); });
    on('player:gold', () => this.refreshInfo());
    on('skills:changed', () => this.refresh());
    on('stats:changed', () => this.refresh());
    on('player:levelup', () => this.refresh());
    on('inventory:changed', () => this.refreshBelt());
    on('player:damaged', () => { this.flash = Math.min(0.6, this.flash + 0.3); });
    on('quests:updated', (l) => { this.quests = l; this.refreshQuest(); });
    on('skill:cooldown', ({ skillId, remaining, total }) => this.cd.set(skillId, { end: performance.now() + remaining, total: Math.max(1, total) }));
    this.unsub.push(anyOn('player:stamina', ((v: { stamina: number; max: number }) => { this.stamV = { s: v.stamina, max: v.max }; }) as never));
    this.unsub.push(anyOn('ui:cinematic', ((v: { on: boolean }) => this.setHidden(!!v.on)) as never));
    this.refresh();
    this.drawXp();
  }

  private zone(parent: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, tip: () => TipLine[] | null, click?: (right: boolean) => void): Phaser.GameObjects.Zone {
    const s = this.scene;
    const z = s.add.zone(x, y, w, h).setInteractive({ useHandCursor: !!click });
    parent.add(z);
    z.on('pointerover', (p: Phaser.Input.Pointer) => { const t = tip(); if (t) s.tooltip.show(t, p.x, p.y); if (click) AudioManager.sfx('ui_hover', { volume: 0.3, pitchVar: 60 }); });
    z.on('pointermove', (p: Phaser.Input.Pointer) => { const t = tip(); if (t && !s.held) s.tooltip.show(t, p.x, p.y); });
    z.on('pointerout', () => s.tooltip.hide());
    if (click) z.on('pointerdown', (p: Phaser.Input.Pointer) => { s.consumeClick(); AudioManager.sfx('ui_click'); click(p.rightButtonDown()); });
    return z;
  }

  private build(): void {
    const s = this.scene, L = this.left, R = this.root;
    // soft floor shade so the cluster reads on bright terrain without a bar
    const shade = s.add.graphics();
    shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.5, 0.5).fillRect(0, BASE_H - 130, BASE_W, 130);
    R.addAt(shade, 1);

    // --- life orb
    const key = has(s, 'ui2_orb_life_small') ? 'ui2_orb_life_small' : 'hud_orb_life';
    L.add(s.add.circle(ORB_X, ORB_Y, ORB_R + 3, 0x120606, 0.85));
    const chip = s.add.image(ORB_X, ORB_Y, key).setDisplaySize(ORB_R * 2, ORB_R * 2).setTint(0xffe6dc).setAlpha(0.9);
    const fill = s.add.image(ORB_X, ORB_Y, key).setDisplaySize(ORB_R * 2, ORB_R * 2);
    const mc = s.make.graphics({ x: 0, y: 0 }, false), mf = s.make.graphics({ x: 0, y: 0 }, false);
    chip.setMask(mc.createGeometryMask()); fill.setMask(mf.createGeometryMask());
    L.add([chip, fill]);
    L.add(s.add.ellipse(ORB_X - 14, ORB_Y - 20, 26, 11, 0xffffff, 0.22).setRotation(-0.55));
    const ring = s.add.graphics();
    ring.lineStyle(3, 0x0a0504, 0.9).strokeCircle(ORB_X, ORB_Y, ORB_R + 2).lineStyle(1.5, 0xc8a46a, 0.85).strokeCircle(ORB_X, ORB_Y, ORB_R + 1);
    L.add(ring);
    this.lifeBar = { chip, fill, mc, mf };
    this.zone(L, ORB_X, ORB_Y, ORB_R * 2, ORB_R * 2, () => [{ text: `Vida: ${Math.ceil(this.vit.life)} / ${this.vit.maxLife}`, color: '#ff8c80', size: 15 }]);
    this.zone(L, BAR_X + BAR_W / 2, BASE_H - 52, BAR_W, 20, () => [
      { text: `Maná: ${Math.ceil(this.vit.mana)} / ${this.vit.maxMana}`, color: '#8fa8ff', size: 15 },
      { text: `Aguante: ${Math.ceil(this.stamV.s)} / ${Math.ceil(this.stamV.max)}`, color: '#f0d080', size: 13 }]);
    this.info = tx(L, s, BAR_X, BASE_H - 72, '', 14, COL.text, 0, 0.5);
    this.info.setFontFamily(DISPLAY).setAlpha(0.92);

    // --- skill slots (index = skillSlots index): M1 M2 1..6
    const labels = ['M1', 'M2', '1', '2', '3', '4', '5', '6'];
    for (let i = 0; i < 8; i++) {
      const x = SLOT_X0 + i * SLOT_STEP;
      this.slots[i] = this.mkSlot(R, x, SLOT_Y, SLOT_R, labels[i]);
      const idx = i;
      this.zone(R, x, SLOT_Y, 46, 46, () => this.skillTip(idx));
    }
    R.add(this.cdG);
    for (let i = 0; i < BELT_SIZE; i++) {
      const x = POT_X0 + i * POT_STEP;
      this.belt[i] = this.mkSlot(R, x, SLOT_Y, POT_R, BELT_KEYS[i]);
      this.zone(R, x, SLOT_Y, 44, 44, () => { const it = GameState.hasProfile ? GameState.profile.belt[i] : null; return it && !s.held ? itemTooltip(it) : null; }, () => { if (!s.held) useBelt(i); });
    }

    // --- XP line
    R.add(this.xpG);
    this.zone(R, BASE_W / 2, BASE_H - 4, BASE_W, 10, () => [
      { text: `Nivel ${this.xp.level}`, color: COL.gold, size: 15 },
      { text: `Experiencia: ${this.xp.xp} / ${this.xp.xpNext}`, color: '#ffffff', size: 13 }]);

    // --- top-right icon buttons
    const defs: [PanelId | 'menu', string, string][] = [['inventory', 'Inventario', 'I'], ['character', 'Personaje', 'C'], ['skills', 'Habilidades', 'T'], ['quests', 'Misiones', 'Q'], ['map', 'Mapa', 'M'], ['menu', 'Menú', 'Esc']];
    defs.forEach(([id, name, k], i) => {
      const x = BASE_W - 16 - BTN_R - (defs.length - 1 - i) * 48, y = 16 + BTN_R;
      const g = s.add.graphics();
      const draw = (h: boolean) => {
        g.clear().fillStyle(0x0c0806, h ? 0.9 : 0.62).fillCircle(x, y, BTN_R).lineStyle(1.5, h ? 0xf0d090 : 0x9a7e50, h ? 1 : 0.8).strokeCircle(x, y, BTN_R);
        this.icon(g, id, x, y, h ? 0xfff0c8 : 0xd8c090);
      };
      draw(false);
      R.add(g);
      R.add(tx(null, s, x, y + BTN_R + 8, k, 10, COL.dim, 0.5, 0.5).setFontFamily(DISPLAY).setAlpha(0.8));
      const z = this.zone(R, x, y, 44, 44, () => [{ text: name, color: COL.gold, size: 15 }, { text: `Tecla ${k}`, color: COL.dim, size: 12 }],
        () => { if (id === 'menu') EventBus.emit('ui:menu'); else EventBus.emit('ui:togglePanel', { panel: id }); });
      z.on('pointerover', () => draw(true));
      z.on('pointerout', () => draw(false));
      if (id === 'character' || id === 'skills') {
        const d = s.add.graphics();
        d.fillStyle(0xffe680, 1).fillCircle(0, 0, 5).lineStyle(1.5, 0x4a2c08, 1).strokeCircle(0, 0, 5).setPosition(x + 14, y - 14).setVisible(false);
        R.add(d);
        this.dots[id] = d;
      }
    });

    // --- gold + quest tracker (compact, right aligned)
    this.goldT = tx(R, s, BASE_W - 18, 82, '', 15, '#f0cc60', 1, 0.5).setFontFamily(DISPLAY);
    this.questT = tx(R, s, BASE_W - 18, 104, '', 13, COL.gold, 1, 0).setFontFamily(DISPLAY).setAlign('right').setWordWrapWidth(250);
    this.questStep = tx(R, s, BASE_W - 18, 122, '', 14, '#e8dcc0', 1, 0).setFontFamily(DISPLAY).setAlign('right').setWordWrapWidth(250);
    this.questT.setLetterSpacing(1.2);
  }

  private icon(g: Phaser.GameObjects.Graphics, id: string, x: number, y: number, c: number): void {
    g.lineStyle(1.8, c, 1).fillStyle(c, 1);
    const V = (a: number, b: number) => new Phaser.Math.Vector2(x + a, y + b);
    switch (id) {
      case 'inventory': g.strokeRoundedRect(x - 7, y - 4, 14, 11, 3).beginPath().arc(x, y - 4, 4, Math.PI, 0).strokePath(); break;
      case 'character': g.strokeCircle(x, y - 4, 4).beginPath().arc(x, y + 9, 8, Math.PI * 1.15, Math.PI * 1.85).strokePath(); break;
      case 'skills': g.fillTriangle(x, y - 9, x + 3, y, x - 3, y).fillTriangle(x, y + 9, x + 3, y, x - 3, y).fillTriangle(x - 9, y, x, y - 3, x, y + 3).fillTriangle(x + 9, y, x, y - 3, x, y + 3); break;
      case 'quests': g.strokeRoundedRect(x - 6, y - 8, 12, 16, 2).lineBetween(x - 3, y - 3, x + 3, y - 3).lineBetween(x - 3, y + 1, x + 3, y + 1).lineBetween(x - 3, y + 5, x + 1, y + 5); break;
      case 'map': g.strokePoints([V(-8, -5), V(-3, -7), V(3, -4), V(8, -6), V(8, 6), V(3, 8), V(-3, 5), V(-8, 7)], true); break;
      default: g.lineBetween(x - 7, y - 5, x + 7, y - 5).lineBetween(x - 7, y, x + 7, y).lineBetween(x - 7, y + 5, x + 7, y + 5);
    }
  }

  private mkSlot(parent: Phaser.GameObjects.Container, x: number, y: number, r: number, label: string): Slot {
    const s = this.scene;
    const ring = s.add.graphics();
    if (has(s, 'ui2_slot_round')) parent.add(s.add.image(x, y, 'ui2_slot_round').setDisplaySize(r * 2 + 8, r * 2 + 8));
    parent.add(ring);
    parent.add(tx(null, s, x, y + r + 8, label, 10, COL.dim, 0.5, 0.5).setFontFamily(DISPLAY).setAlpha(0.85));
    const sl: Slot = { x, y, r, ring };
    this.drawRing(sl, false);
    return sl;
  }

  private drawRing(sl: Slot, on: boolean): void {
    const hasTex = has(this.scene, 'ui2_slot_round');
    sl.ring.clear();
    if (!hasTex) sl.ring.fillStyle(0x0a0705, 0.72).fillCircle(sl.x, sl.y, sl.r);
    sl.ring.lineStyle(on ? 1.8 : 1.2, on ? 0xd0aa68 : 0x6a5838, on ? 0.95 : 0.7).strokeCircle(sl.x, sl.y, sl.r);
  }

  private skillTip(idx: number): TipLine[] | null {
    if (!GameState.hasProfile) return null;
    const id = GameState.profile.skillSlots[idx];
    const d = id ? SKILL_BY_ID[id] : null;
    if (id === 'attack') return [{ text: 'Ataque básico', color: COL.gold, size: 16 }, { text: 'Golpea o dispara con tu arma. No cuesta maná.', size: 13 }];
    if (!d) return [{ text: idx === 0 ? 'Botón izquierdo del ratón' : idx === 1 ? 'Botón derecho del ratón' : `Tecla ${idx - 1}`, color: COL.dim, size: 13 },
      { text: 'Asigna una habilidad en el árbol (T)', color: COL.dim, size: 12 }];
    return [{ text: d.name, color: COL.gold, size: 16 }, { text: describeSkill(d.id), size: 13 }, { text: `Maná: ${manaCostOf(d, Math.max(1, GameState.profile.skills[d.id] ?? 1))}`, color: '#7aa8ff', size: 13 }];
  }

  refresh(): void {
    if (!GameState.hasProfile) return;
    const p = GameState.profile;
    this.slots.forEach((sl, i) => {
      const id = p.skillSlots[i];
      const key = id === 'attack' ? `icon_item_${{ knight: 'sword', mage: 'staff', ranger: 'bow' }[p.classId] ?? 'sword'}` : id ? `icon_skill_${id}` : '';
      if (key && this.scene.textures.exists(key)) {
        if (!sl.icon) { sl.icon = this.scene.add.image(sl.x, sl.y, key); this.root.addAt(sl.icon, this.root.getIndex(sl.ring) + 1); }
        sl.icon.setTexture(key).setDisplaySize(sl.r * 1.62, sl.r * 1.62).setVisible(true);
      } else sl.icon?.setVisible(false);
      this.drawRing(sl, !!key);
    });
    this.refreshBelt();
    this.refreshInfo();
  }

  private refreshBelt(): void {
    if (!GameState.hasProfile) return;
    const belt = GameState.profile.belt;
    this.belt.forEach((sl, i) => {
      const it = belt[i];
      this.beltIcons[i]?.destroy();
      this.beltIcons[i] = null;
      if (it) { const im = this.scene.add.image(sl.x, sl.y, this.scene.textures.exists(it.icon) ? it.icon : 'icon_item_potion_health').setDisplaySize(POT_R * 1.7, POT_R * 1.7); this.root.add(im); this.beltIcons[i] = im; }
      this.drawRing(sl, !!it);
    });
  }

  private refreshInfo(): void {
    if (!GameState.hasProfile) return;
    const p = GameState.profile;
    this.info.setText(`${p.name}  ·  Nv ${p.level}`);
    this.goldT.setText(`${p.gold}  oro`);
    this.dots.character?.setVisible(p.statPoints > 0);
    this.dots.skills?.setVisible(p.skillPoints > 0);
  }

  private refreshQuest(): void {
    const q = this.quests.find((x) => !x.done);
    if (!q) { this.questT.setText(''); this.questStep.setText(''); return; }
    const st = q.steps.find((x) => !x.done);
    this.questT.setText(q.title.toUpperCase());
    this.questStep.setText(st ? st.text : 'Vuelve para entregar la misión').setY(this.questT.y + this.questT.height + 3);
  }

  private drawXp(): void {
    const f = Math.min(1, this.xp.xp / Math.max(1, this.xp.xpNext));
    this.xpG.clear().fillStyle(0x000000, 0.45).fillRect(0, BASE_H - 3, BASE_W, 3).fillStyle(0xd8a838, 0.95).fillRect(0, BASE_H - 3, BASE_W * f, 3)
      .fillStyle(0xfff0b0, 0.6).fillRect(0, BASE_H - 3, BASE_W * f, 1);
  }

  /** Fade the whole HUD out/in (dialogues, cutscenes). */
  setHidden(h: boolean): void {
    if (h === this.hidden) return;
    this.hidden = h;
    this.scene.tweens.killTweensOf(this.root);
    if (!h) this.root.setVisible(true);
    this.scene.tweens.add({ targets: this.root, alpha: h ? 0 : 1, duration: 260, onComplete: () => { if (this.hidden) this.root.setVisible(false); } });
  }

  /**
   * Touch hook: reserves the bottom-left corner for a virtual joystick by shifting the vitals cluster to the right.
   * (Skill slots stay centred; hit zones are >=44px.) Call again with false to restore.
   */
  layoutForTouch(on = true): void {
    this.lx = on ? 150 : 0;
    this.left.x = this.lx;
    this.lifeBar.mc.x = this.lx; this.lifeBar.mf.x = this.lx;
  }

  /** Index of the potion slot under a point, or -1. */
  beltIndexAt(px: number, py: number): number {
    if (this.hidden) return -1;
    return this.belt.findIndex((b) => Math.hypot(px - b.x, py - b.y) <= 24);
  }

  covers(px: number, py: number): boolean {
    if (this.hidden) return false;
    if (py >= BASE_H - 14) return true;
    if (py >= BASE_H - 90 && px >= 4 + this.lx && px <= POT_X0 + POT_STEP * BELT_SIZE) return true;
    return py <= 60 && px >= BASE_W - 300;
  }

  update(dtMs: number): void {
    if (this.hidden && this.root.alpha <= 0) return;
    this.phase += dtMs * 0.004;
    const v = this.vit;
    const lf = Phaser.Math.Clamp(v.life / Math.max(1, v.maxLife), 0, 1);
    // life orb: fast fill, slow white-red chip
    if (lf < this.lifeShown - 0.001 && lf < this.lifeChip) this.lifeHold = 450;
    this.lifeShown += (lf - this.lifeShown) * Math.min(1, dtMs * 0.014);
    if (this.lifeShown >= this.lifeChip) this.lifeChip = this.lifeShown;
    else if (this.lifeHold > 0) this.lifeHold -= dtMs;
    else this.lifeChip += (this.lifeShown - this.lifeChip) * Math.min(1, dtMs * 0.005);
    const orbMask = (g: Phaser.GameObjects.Graphics, f: number, wave: number) => {
      g.clear().fillStyle(0xffffff, 1);
      const top = ORB_Y + ORB_R - f * ORB_R * 2, pts: Phaser.Math.Vector2[] = [];
      for (let x = ORB_X - ORB_R; x <= ORB_X + ORB_R; x += 4) pts.push(new Phaser.Math.Vector2(x, top + Math.sin(this.phase * 1.3 + x * 0.09) * wave));
      pts.push(new Phaser.Math.Vector2(ORB_X + ORB_R, ORB_Y + ORB_R + 2), new Phaser.Math.Vector2(ORB_X - ORB_R, ORB_Y + ORB_R + 2));
      g.fillPoints(pts, true);
    };
    orbMask(this.lifeBar.mf, this.lifeShown, this.lifeShown < 0.98 ? 1.8 : 0);
    orbMask(this.lifeBar.mc, this.lifeChip, 0);
    this.mana.set(v.mana / Math.max(1, v.maxMana)); this.mana.step(dtMs);
    this.stam.set(this.stamV.s / Math.max(1, this.stamV.max)); this.stam.step(dtMs);

    // low-HP vignette
    this.flash = Math.max(0, this.flash - dtMs * 0.0012);
    const low = lf < 0.3 ? (0.3 - lf) / 0.3 : 0;
    this.vignette.setAlpha(Math.min(1, low * 1.5 * (0.6 + 0.3 * Math.sin(this.phase * 2.2)) + this.flash));

    // cooldown sweeps, mana tint
    const g = this.cdG.clear(), now = performance.now();
    if (!GameState.hasProfile) return;
    const prof = GameState.profile;
    this.slots.forEach((sl, i) => {
      const id = prof.skillSlots[i];
      const d = id ? SKILL_BY_ID[id] : undefined;
      if (sl.icon) {
        const lack = d && manaCostOf(d, Math.max(1, prof.skills[d.id] ?? 1)) > v.mana;
        if (lack) sl.icon.setTint(0x4a5a98); else sl.icon.clearTint();
      }
      const c = id ? this.cd.get(id) : undefined;
      if (!c) return;
      const rem = c.end - now;
      if (rem <= 0) { this.cd.delete(id!); return; }
      const a0 = -Math.PI / 2 + (1 - rem / c.total) * Math.PI * 2;
      g.fillStyle(0x000000, 0.62).beginPath().moveTo(sl.x, sl.y).arc(sl.x, sl.y, sl.r - 1, a0, Math.PI * 1.5, false).closePath().fillPath();
    });
  }

  pulse(time: number): void {
    const k = 1 + Math.sin(time * 0.006) * 0.18;
    for (const d of Object.values(this.dots)) d.setScale(k);
  }

  destroy(): void {
    this.unsub.forEach((u) => u());
    this.lifeBar.mc.destroy(); this.lifeBar.mf.destroy();
    this.root.destroy();
  }
}