import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { BASE_H, BASE_W } from '../constants';
import { EventBus, type GameEvents } from '../core/EventBus';
import { GameState } from '../core/GameState';
import { SKILL_BY_ID } from '../data/skills';
import { S } from '../data/strings';
import { makeButton, textStyle } from '../ui/widgets';

type PanelId = GameEvents['ui:togglePanel']['panel'];

/**
 * HUD overlay running in parallel above GameScene. This is the stub: orbs, XP bar, hotbar, area name,
 * placeholder panels and the Esc menu. UI agents replace panels by registering into `panels`.
 *
 * Hook points for later modules:
 *  - React to EventBus ('player:vitals', 'player:xp', 'player:gold', 'area:entered', 'ui:togglePanel').
 *  - Call `coversPoint` registrations via `addBlocker` so clicks on UI don't walk the hero.
 */
export class UIScene extends Phaser.Scene {
  private orbs: { life: Phaser.GameObjects.Image; mana: Phaser.GameObjects.Image } | null = null;
  private lifeText!: Phaser.GameObjects.Text;
  private manaText!: Phaser.GameObjects.Text;
  private xpBar!: Phaser.GameObjects.Graphics;
  private info!: Phaser.GameObjects.Text;
  private areaText!: Phaser.GameObjects.Text;
  private panel?: Phaser.GameObjects.Container;
  private panelId?: PanelId;
  private menu?: Phaser.GameObjects.Container;
  private vit = { life: 1, maxLife: 1, mana: 1, maxMana: 1 };
  private xp = { level: 1, xp: 0, xpNext: 1 };
  private blockers: ((x: number, y: number) => boolean)[] = [];
  private unsub: (() => void)[] = [];

  constructor() { super('UI'); }

  /** Register a predicate telling GameScene input that a screen point is over UI. */
  addBlocker(fn: (x: number, y: number) => boolean): void { this.blockers.push(fn); }

  coversPoint(x: number, y: number): boolean {
    if (y > BASE_H - 120) return true;
    if (this.menu) return true;
    if (this.panel && x > BASE_W / 2 - 250 && x < BASE_W / 2 + 250 && y > 60 && y < 600) return true;
    return this.blockers.some((b) => b(x, y));
  }

  create(): void {
    this.drawHud();
    const on = <K extends keyof GameEvents>(e: K, fn: (p: GameEvents[K]) => void) => this.unsub.push(EventBus.on(e, fn));
    on('player:vitals', (v) => { this.vit = v; this.refreshOrbs(); });
    on('player:xp', (v) => { this.xp = v; this.refreshXp(); });
    on('player:gold', () => this.refreshInfo());
    on('area:entered', (a) => { this.areaText.setText(a.name); this.refreshInfo(); this.closePanel(); });
    on('ui:togglePanel', ({ panel }) => this.togglePanel(panel));
    on('ui:closePanels', () => { this.closePanel(); this.closeMenu(); });
    on('ui:menu', () => (this.menu ? this.closeMenu() : this.openMenu()));
    on('player:levelup', ({ level }) => { AudioManager.sfx('levelup'); this.areaText.setText(`${S.hud.level} ${level}`); });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsub.forEach((u) => u()));
    if (GameState.hasProfile) { GameState.emitVitals(); GameState.emitProgress(); }
  }

  private drawHud(): void {
    const g = this.add.graphics();
    g.fillStyle(0x0c0806, 0.92).fillRect(0, BASE_H - 110, BASE_W, 110);
    g.lineStyle(3, 0x6a5a40).lineBetween(0, BASE_H - 110, BASE_W, BASE_H - 110);
    const mk = (key: string, x: number) => {
      const img = this.add.image(x, BASE_H - 62, key);
      img.setDisplaySize(100, 100);
      return img;
    };
    const life = mk('ui_orb_health', 110), mana = mk('ui_orb_mana', BASE_W - 110);
    this.orbs = { life, mana };
    this.add.image(110, BASE_H - 62, 'ui_orb_frame').setDisplaySize(112, 112);
    this.add.image(BASE_W - 110, BASE_H - 62, 'ui_orb_frame').setDisplaySize(112, 112);
    this.lifeText = this.add.text(110, BASE_H - 62, '', textStyle(16, '#fff')).setOrigin(0.5);
    this.manaText = this.add.text(BASE_W - 110, BASE_H - 62, '', textStyle(16, '#fff')).setOrigin(0.5);
    for (let i = 0; i < 8; i++) {
      const x = BASE_W / 2 - 250 + i * 66 + (i >= 2 ? 0 : 0);
      this.add.image(x + 33, BASE_H - 44, 'ui_slot').setDisplaySize(58, 58);
      const sid = GameState.hasProfile ? GameState.profile.skillSlots[i] : null;
      if (sid && SKILL_BY_ID[sid]) this.add.image(x + 33, BASE_H - 44, `icon_skill_${sid}`).setDisplaySize(52, 52);
      const label = i === 0 ? 'M1' : i === 1 ? 'M2' : String(i - 1);
      this.add.text(x + 33, BASE_H - 12, label, textStyle(13)).setOrigin(0.5);
    }
    this.xpBar = this.add.graphics();
    this.info = this.add.text(BASE_W / 2, BASE_H - 100, '', textStyle(18)).setOrigin(0.5, 1);
    this.areaText = this.add.text(BASE_W / 2, 16, '', textStyle(28, '#d8b060')).setOrigin(0.5, 0);
    this.refreshOrbs();
    this.refreshXp();
  }

  private fillOrb(img: Phaser.GameObjects.Image, p: number): void {
    const f = img.frame;
    const h = f.height * Phaser.Math.Clamp(p, 0, 1);
    img.setCrop(0, f.height - h, f.width, h);
  }

  private refreshOrbs(): void {
    if (!this.orbs) return;
    this.fillOrb(this.orbs.life, this.vit.life / this.vit.maxLife);
    this.fillOrb(this.orbs.mana, this.vit.mana / this.vit.maxMana);
    this.lifeText.setText(`${Math.ceil(this.vit.life)}/${this.vit.maxLife}`);
    this.manaText.setText(`${Math.ceil(this.vit.mana)}/${this.vit.maxMana}`);
  }

  private refreshXp(): void {
    const w = 380, x = BASE_W / 2 - w / 2, y = BASE_H - 8;
    this.xpBar.clear().fillStyle(0x201810).fillRect(x, y - 6, w, 6).fillStyle(0xd8a030).fillRect(x, y - 6, w * Math.min(1, this.xp.xp / this.xp.xpNext), 6);
    this.refreshInfo();
  }

  private refreshInfo(): void {
    if (!GameState.hasProfile) return;
    const p = GameState.profile;
    this.info.setText(`${p.name}  -  ${S.hud.level} ${p.level}  -  ${p.gold} oro`);
  }

  private togglePanel(id: PanelId): void {
    const was = this.panelId;
    this.closePanel();
    if (was === id) return;
    AudioManager.sfx('ui_open');
    this.panelId = id;
    const c = this.add.container(BASE_W / 2, BASE_H / 2 - 30);
    c.add(this.add.rectangle(0, 0, 500, 540, 0x120c0a, 0.96).setStrokeStyle(4, 0x6a5a40));
    c.add(this.add.text(0, -240, S.panels[id], textStyle(32, '#d8b060')).setOrigin(0.5));
    c.add(this.add.text(0, 0, '(en construcción)', textStyle(20, '#8a7a60')).setOrigin(0.5));
    this.panel = c;
  }

  private closePanel(): void {
    if (this.panel) AudioManager.sfx('ui_close');
    this.panel?.destroy();
    this.panel = undefined;
    this.panelId = undefined;
  }

  private openMenu(): void {
    const c = this.add.container(BASE_W / 2, BASE_H / 2);
    c.add(this.add.rectangle(0, 0, BASE_W, BASE_H, 0x000000, 0.6).setInteractive());
    c.add(makeButton(this, 0, -40, 'Volver al juego', () => this.closeMenu()));
    c.add(makeButton(this, 0, 40, 'Guardar y salir', () => {
      GameState.save();
      this.closeMenu();
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