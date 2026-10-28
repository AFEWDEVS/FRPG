import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { BASE_H, BASE_W } from '../constants';
import { EventBus, type GameEvents } from '../core/EventBus';
import { GameState } from '../core/GameState';
import { NPCS } from '../data/npcs';
import { S } from '../data/strings';
import { worldToGrid } from '../iso/iso';
import { BELT_SIZE, addItem, dropOnGround } from '../items/inventory';
import type { Item } from '../items/types';
import { AutoMap, type GameLike } from '../ui/AutoMap';
import { BossBar } from '../ui/BossBar';
import { DialogueBox } from '../ui/DialogueBox';
import { Hud } from '../ui/Hud';
import { Panel, type UiHost } from '../ui/Panel';
import { CharacterPanel } from '../ui/panels/CharacterPanel';
import { InventoryPanel } from '../ui/panels/InventoryPanel';
import { MapPanel } from '../ui/panels/MapPanel';
import { QuestPanel } from '../ui/panels/QuestPanel';
import { ShopPanel } from '../ui/panels/ShopPanel';
import { SkillPanel } from '../ui/panels/SkillPanel';
import { CELL, itemIcon } from '../ui/theme';
import { Toasts } from '../ui/Toasts';
import { Tooltip } from '../ui/Tooltip';
import { makeButton } from '../ui/widgets';
import { useBelt } from '../items/inventory';
import { RARITY_HEX } from '../data/items';

type PanelId = GameEvents['ui:togglePanel']['panel'];

let instance: UIScene | null = null;
/** Open the merchant panel (hero must be in a running UI scene). */
export function openShop(): void { instance?.openShop(); }

const GREETINGS: Record<string, string[]> = {
  merchant: ['¡Pasa, pasa! Pociones para el corazón y la espada. Para el corazón no tengo, pero ánimo.', 'Todo a buen precio... según mi humor de hoy.'],
  healer: ['Tienes cara de haber peleado con un oso... o con una suegra.', 'Que la luz de las dos lunas cierre esas heridas.'],
};

/**
 * HUD overlay running in parallel above GameScene: bottom bar, panels (inventory, character, skills, quests, map, shop),
 * dialogue box, boss bar, toasts, automap overlay and the Esc menu.
 */
export class UIScene extends Phaser.Scene implements UiHost {
  held: Item | null = null;
  tooltip!: Tooltip;
  private hud!: Hud;
  private automap!: AutoMap;
  private panels!: Record<PanelId | 'shop', Panel>;
  private dialogue!: DialogueBox;
  private boss!: BossBar;
  private toasts!: Toasts;
  private heldC!: Phaser.GameObjects.Container;
  private areaText!: Phaser.GameObjects.Text;
  private menu?: Phaser.GameObjects.Container;
  private blockers: ((x: number, y: number) => boolean)[] = [];
  private unsub: (() => void)[] = [];
  private consumedAt = -1000;
  private press: { x: number; y: number; hadHeld: boolean } | null = null;
  private keys: Phaser.Input.Keyboard.Key[] = [];

  constructor() { super('UI'); }

  // ------------------------------------------------------------ public API

  addBlocker(fn: (x: number, y: number) => boolean): void { this.blockers.push(fn); }

  coversPoint(x: number, y: number): boolean {
    if (this.menu) return true;
    if (this.held) return true;
    if (performance.now() - this.consumedAt < 80) return true;
    if (this.hud?.covers(x, y)) return true;
    if (this.dialogue?.covers(x, y)) return true;
    if (this.panels && Object.values(this.panels).some((p) => p.contains(x, y))) return true;
    return this.blockers.some((b) => b(x, y));
  }

  consumeClick(): void { this.consumedAt = performance.now(); }
  pointerPos(): { x: number; y: number } { const p = this.input.activePointer; return { x: p.x, y: p.y }; }
  shopIsOpen(): boolean { return !!this.panels?.shop.isOpen; }

  openShop(): void {
    this.closeSide('left', this.panels.shop);
    (this.panels.shop as ShopPanel).openShop();
    if (!this.panels.inventory.isOpen) this.panels.inventory.open();
  }

  setHeld(item: Item | null): void {
    this.held = item;
    this.heldC.removeAll(true);
    if (item) {
      const w = item.w * CELL, h = item.h * CELL;
      const g = this.add.graphics();
      g.fillStyle(RARITY_HEX[item.rarity], 0.35).fillRect(-w / 2, -h / 2, w, h).lineStyle(2, RARITY_HEX[item.rarity], 1).strokeRect(-w / 2, -h / 2, w, h);
      this.heldC.add([g, itemIcon(this, item, 0, 0, w, h)]);
      this.heldC.setVisible(true);
      const p = this.input.activePointer;
      this.heldC.setPosition(p.x, p.y);
    } else this.heldC.setVisible(false);
    this.tooltip.hide();
    this.updateHover();
  }

  // ------------------------------------------------------------ lifecycle

  create(): void {
    instance = this;
    this.held = null;
    this.menu = undefined;
    this.unsub = [];
    this.keys = [];
    this.tooltip = new Tooltip(this);
    this.hud = new Hud(this);
    this.automap = new AutoMap(this);
    this.panels = {
      inventory: new InventoryPanel(this), character: new CharacterPanel(this), skills: new SkillPanel(this),
      quests: new QuestPanel(this), map: new MapPanel(this, this.automap, () => this.game3()), shop: new ShopPanel(this),
    };
    this.dialogue = new DialogueBox(this);
    this.boss = new BossBar(this);
    this.toasts = new Toasts(this);
    this.heldC = this.add.container(0, 0).setDepth(20000).setVisible(false);
    this.areaText = this.add.text(BASE_W / 2, 14, '', { fontFamily: 'Georgia, serif', fontSize: '28px', color: '#d8b060', stroke: '#1a0c08', strokeThickness: 5 }).setOrigin(0.5, 0).setDepth(5);

    const on = <K extends keyof GameEvents>(e: K, fn: (p: GameEvents[K]) => void) => this.unsub.push(EventBus.on(e, fn));
    on('area:entered', (a) => {
      this.areaText.setText(a.name);
      this.closePanels();
      this.dialogue.hide();
      (this.panels.map as MapPanel).areaName = a.name;
      this.returnHeld();
    });
    on('ui:togglePanel', ({ panel }) => this.togglePanel(panel));
    on('ui:closePanels', () => { this.closePanels(); this.closeMenu(); });
    on('ui:menu', () => {
      if (this.menu) this.closeMenu();
      else if (this.held) this.returnHeld();
      else if (Object.values(this.panels).some((p) => p.isOpen)) this.closePanels();
      else this.openMenu();
    });
    on('player:levelup', ({ level }) => {
      AudioManager.sfx('levelup');
      this.toast(`¡Nivel ${level}!`, '#ffe680');
    });
    for (const e of ['inventory:changed', 'equipment:changed', 'player:gold', 'stats:changed', 'skills:changed', 'player:xp'] as const) {
      on(e, () => this.refreshPanels());
    }
    on('quests:updated', () => this.panels.quests.refresh());
    on('dialogue:show', (p) => this.dialogue.show(p));
    on('dialogue:hide', () => this.dialogue.hide());
    on('dialogue:choice', ({ id }) => this.onChoice(id));
    on('boss:engaged', ({ name, hp, maxHp }) => { this.boss.engage(name); if (hp !== undefined && maxHp) this.boss.setHp(hp, maxHp); });
    on('boss:hp', ({ hp, maxHp }) => this.boss.setHp(hp, maxHp));
    on('boss:defeated', () => this.boss.defeat());
    on('boss:taunt', ({ text }) => this.boss.say(text));
    on('ui:toast', ({ text, color }) => this.toast(text, color));
    on('npc:interact', ({ npcId }) => this.onNpc(npcId));

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointermove', this.onMove, this);
    const kb = this.input.keyboard;
    if (kb) {
      ['A', 'S', 'D', 'F'].slice(0, BELT_SIZE).forEach((k, i) => {
        const key = kb.addKey(k, false);
        key.on('down', () => { if (GameState.hasProfile) useBelt(i); });
        this.keys.push(key);
      });
      const tab = kb.addKey('TAB', true);
      tab.on('down', () => this.automap.setOverlay(!this.automap.overlayOn));
      this.keys.push(tab);
      kb.on('keydown', this.onKey, this);
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsub.forEach((u) => u());
      this.hud.destroy();
      this.input.off('pointerdown', this.onDown, this);
      this.input.off('pointerup', this.onUp, this);
      this.input.off('pointermove', this.onMove, this);
      kb?.off('keydown', this.onKey, this);
      this.keys.forEach((k) => { k.removeAllListeners(); kb?.removeKey(k, true); });
      if (instance === this) instance = null;
    });
    if (GameState.hasProfile) { GameState.emitVitals(); GameState.emitProgress(); this.hud.refresh(); }
  }

  update(time: number, dtMs: number): void {
    this.hud.update(dtMs);
    this.hud.pulse(time);
    this.dialogue.update(dtMs);
    this.boss.update(dtMs);
    if (this.held) { const p = this.input.activePointer; this.heldC.setPosition(p.x, p.y); }
    const gs = this.game3();
    const moved = this.automap.update(dtMs, gs);
    if (moved && this.panels.map.isOpen) this.panels.map.refresh();
  }

  private game3(): GameLike | undefined {
    const g = this.scene.get('Game') as unknown as GameLike & { sys: Phaser.Scenes.Systems };
    return g?.sys?.isActive() ? g : undefined;
  }

  // ------------------------------------------------------------ panels

  private togglePanel(id: PanelId): void {
    if (!GameState.hasProfile) return;
    const p = this.panels[id];
    if (p.isOpen) { p.close(); return; }
    this.closeSide(p.side, p);
    p.open();
  }

  private closeSide(side: 'left' | 'right', except: Panel): void {
    for (const p of Object.values(this.panels)) if (p !== except && p.side === side && p.isOpen) p.close();
  }

  private closePanels(): void { for (const p of Object.values(this.panels)) p.close(); }

  private refreshPanels(): void {
    for (const p of Object.values(this.panels)) if (p.isOpen) p.refresh();
    this.updateHover();
  }

  private updateHover(): void {
    const p = this.input.activePointer;
    let over = false;
    for (const pn of Object.values(this.panels)) {
      if (pn.contains(p.x, p.y)) { pn.pointerMove(p.x, p.y); over = true; }
    }
    if (!over && this.held) this.tooltip.hide();
  }

  private returnHeld(): void {
    const it = this.held;
    if (!it) return;
    this.setHeld(null);
    if (!addItem(it)) { const g = this.game3(); if (g?.player) dropOnGround(it, g.player.gx, g.player.gy); }
    EventBus.emit('inventory:changed');
  }

  // ------------------------------------------------------------ input

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.held) this.heldC.setPosition(p.x, p.y);
    let over = false;
    for (const pn of Object.values(this.panels)) {
      if (pn.contains(p.x, p.y)) { pn.pointerMove(p.x, p.y); over = true; }
    }
    if (!over && this.held) this.tooltip.hide();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key >= '1' && e.key <= '6') {
      const p = this.input.activePointer;
      for (const pn of Object.values(this.panels)) if (pn.contains(p.x, p.y)) pn.numberKey(Number(e.key), p.x, p.y);
    }
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.menu) return;
    this.press = { x: p.x, y: p.y, hadHeld: !!this.held };
    this.clickAt(p.x, p.y, p.rightButtonDown(), false);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const pr = this.press;
    this.press = null;
    if (!pr || pr.hadHeld || !this.held || this.menu) return;
    if (Math.hypot(p.x - pr.x, p.y - pr.y) < 14) return; // plain click: item stays on the cursor
    this.clickAt(p.x, p.y, false, true);
  }

  /** Shared by click and drag-release: route a pointer action to panels, belt or the ground. */
  private clickAt(x: number, y: number, right: boolean, fromDrag: boolean): void {
    if (this.dialogue.covers(x, y)) return;
    for (const pn of Object.values(this.panels)) {
      if (pn.contains(x, y)) {
        this.consumeClick();
        pn.pointerDown(x, y, right);
        this.updateHover();
        return;
      }
    }
    const bi = this.hud.beltIndexAt(x, y);
    if (bi >= 0) {
      this.consumeClick();
      if (this.held) this.placeInBelt(bi);
      return;
    }
    if (this.hud.covers(x, y)) { this.consumeClick(); return; }
    if (this.held && !right) {
      // drop on the ground at the hero's feet
      const g = this.game3();
      if (g?.player) {
        dropOnGround(this.held, g.player.gx, g.player.gy);
        this.setHeld(null);
        this.consumeClick();
        EventBus.emit('inventory:changed');
      }
    }
    void fromDrag;
  }

  private placeInBelt(i: number): void {
    const it = this.held;
    if (!it) return;
    if (!it.potion) { this.toast('El cinturón solo admite pociones.', '#ff7060'); return; }
    const p = GameState.profile;
    const prev = p.belt[i];
    p.belt[i] = it;
    this.setHeld(prev);
    AudioManager.sfx('ui_click');
    EventBus.emit('inventory:changed');
  }

  // ------------------------------------------------------------ dialogue / NPC

  private onNpc(npcId: string): void {
    const n = NPCS[npcId];
    if (!n || (npcId !== 'merchant' && npcId !== 'healer')) return;
    const lines = GREETINGS[npcId];
    const text = lines[Math.floor(Math.random() * lines.length)];
    this.dialogue.show({
      speaker: n.name, portrait: n.portraitKey, text,
      choices: npcId === 'merchant'
        ? [{ id: 'shop:trade', text: 'Comerciar' }, { id: 'shop:bye', text: 'Adiós' }]
        : [{ id: 'shop:heal', text: 'Sanar mis heridas' }, { id: 'shop:bye', text: 'Adiós' }],
    });
  }

  private onChoice(id: string): void {
    if (id === 'shop:trade') this.openShop();
    else if (id === 'shop:heal') {
      const gs = GameState;
      gs.life = gs.maxLife;
      gs.mana = gs.maxMana;
      gs.emitVitals();
      AudioManager.sfx('heal');
      this.toast('Hermana Melisa te sana por completo.', '#80ff80');
    }
  }

  toast(text: string, color?: string): void { this.toasts.push(text, color); }

  // ------------------------------------------------------------ menu

  private openMenu(): void {
    const c = this.add.container(BASE_W / 2, BASE_H / 2).setDepth(30000);
    c.add(this.add.rectangle(0, 0, BASE_W, BASE_H, 0x000000, 0.6).setInteractive());
    c.add(makeButton(this, 0, -40, 'Volver al juego', () => this.closeMenu()));
    c.add(makeButton(this, 0, 40, 'Guardar y salir', () => {
      GameState.save();
      this.closeMenu();
      this.returnHeld();
      EventBus.emit('ui:closePanels');
      const mgr = this.game.scene;
      mgr.stop('Game');
      mgr.start('MainMenu');
      mgr.stop('UI');
    }));
    this.menu = c;
  }
  private closeMenu(): void { this.menu?.destroy(); this.menu = undefined; }
}

void S;
void worldToGrid;