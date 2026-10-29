import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import type { VfxManager } from '../vfx/VfxManager';
import { RARITY_HEX, RARITY_COLOR } from '../data/items';
import { gridToWorld } from '../iso/iso';
import type { Item } from '../items/types';

const BEAM_DEPTH = 1_000_001;
const LABEL_DEPTH = 1_000_002;

/** An item or gold pile lying on the ground: bobbing icon, rarity light beam and name label. */
export class LootDrop {
  gx: number;
  gy: number;
  readonly item: Item | null;
  readonly gold: number;
  private shadow: Phaser.GameObjects.Ellipse;
  private icon: Phaser.GameObjects.Image;
  private beam?: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private landed = false;
  private baseY = 0;
  private lastSparkle = 0;
  private tall = 0;
  private col = 0xffffff;
  private label: Phaser.GameObjects.Text;
  private hover = false;
  private alwaysShow: boolean;
  readonly bornAt: number;

  constructor(private scene: Phaser.Scene, o: { gx: number; gy: number; item?: Item; gold?: number; from?: { gx: number; gy: number } }, onClick: (d: LootDrop, p: Phaser.Input.Pointer) => void) {
    this.gx = o.gx;
    this.gy = o.gy;
    this.item = o.item ?? null;
    this.gold = o.gold ?? 0;
    this.bornAt = scene.time.now;
    const w = gridToWorld(this.gx, this.gy);
    const rarity = this.item?.rarity ?? 'normal';
    this.alwaysShow = this.gold > 0 || rarity !== 'normal';
    this.shadow = scene.add.ellipse(w.x, w.y, 34, 14, 0x000000, 0.45).setDepth(w.y - 1);
    const key = this.item ? this.item.icon : 'icon_item_gold';
    this.icon = scene.add.image(w.x, w.y - 70, scene.textures.exists(key) ? key : 'icon_item_sword').setDisplaySize(40, 40).setDepth(w.y);
    if (rarity === 'unique') this.icon.setTint(0xffeec0);
    this.baseY = w.y - 16;
    this.popOut(w, o.from ? gridToWorld(o.from.gx, o.from.gy) : null, rarity);
    if (this.item && rarity !== 'normal') {
      const col = RARITY_HEX[rarity];
      const tall = rarity === 'magic' ? 90 : rarity === 'rare' ? 140 : 190;
      this.tall = tall; this.col = col;
      if (scene.textures.exists('fx_pillar')) {
        this.beam = scene.add.image(w.x, w.y - 2, 'fx_pillar').setOrigin(0.5, 1).setTint(col).setDepth(BEAM_DEPTH).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(rarity === 'magic' ? 0.5 : rarity === 'rare' ? 0.7 : 1, tall / 256);
        scene.tweens.add({ targets: this.beam, alpha: 0.85, duration: 300, delay: 450 });
        scene.time.delayedCall(800, () => { if (this.beam) scene.tweens.add({ targets: this.beam, alpha: 0.4, yoyo: true, repeat: -1, duration: 900 + Math.random() * 400 }); });
      } else {
        this.beam = scene.add.rectangle(w.x, w.y - 2, rarity === 'magic' ? 8 : 12, tall, col, 0.32).setOrigin(0.5, 1).setDepth(BEAM_DEPTH).setBlendMode(Phaser.BlendModes.ADD);
        scene.tweens.add({ targets: this.beam, alpha: 0.12, yoyo: true, repeat: -1, duration: 900 + Math.random() * 400 });
      }
    }
    const text = this.item ? this.item.name : `${this.gold} oro`;
    const color = this.item ? RARITY_COLOR[rarity] : '#ffd24a';
    this.label = scene.add.text(w.x, w.y - 44, text, {
      fontFamily: 'Georgia, serif', fontSize: '15px', color, stroke: '#000', strokeThickness: 3, backgroundColor: '#000000b0', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 1).setDepth(LABEL_DEPTH);
    this.label.setVisible(this.alwaysShow);
    for (const t of [this.label, this.icon]) {
      t.setInteractive({ useHandCursor: true });
      t.on('pointerover', () => { this.hover = true; });
      t.on('pointerout', () => { this.hover = false; });
      t.on('pointerdown', (p: Phaser.Input.Pointer) => onClick(this, p));
    }
  }

  private get vfx(): VfxManager | undefined { return (this.scene as unknown as { vfx?: VfxManager }).vfx; }

  /** Item pops out of the corpse in an arc with spin, lands with a puff and a small bounce. */
  private popOut(w: { x: number; y: number }, from: { x: number; y: number } | null, rarity: string): void {
    const sc = this.scene, ic = this.icon;
    const sx = from ? from.x : w.x, sy = (from ? from.y : w.y) - 40;
    const gy = w.y - 16, vfx = this.vfx;
    ic.setPosition(sx, sy).setAngle(0).setScale(ic.scaleX * 0.5);
    const full = 40 / Math.max(1, ic.width);
    sc.tweens.add({ targets: ic, scaleX: full, scaleY: full, duration: 200, ease: 'Back.easeOut' });
    const dist = Math.hypot(w.x - sx, w.y - sy), h = 50 + Math.min(70, dist * 0.5);
    const st = { k: 0 };
    const spin = (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 360);
    sc.tweens.add({
      targets: st, k: 1, duration: 480, ease: 'Linear',
      onUpdate: () => {
        const k = st.k, base = sy + (gy - sy) * k;
        ic.setPosition(sx + (w.x - sx) * k, base - 4 * h * k * (1 - k)).setAngle(spin * k);
        const air = Math.max(0, (base - ic.y) / 120);
        this.shadow.setPosition(sx + (w.x - sx) * k, w.y + (sy + 40 - w.y) * (1 - k) * 0).setScale(1 - air * 0.4).setAlpha(0.45 * (1 - air * 0.5));
      },
      onComplete: () => {
        ic.setAngle(0);
        sc.tweens.add({ targets: ic, y: { from: gy - 26, to: gy }, duration: 300, ease: 'Bounce.easeOut', onComplete: () => { this.landed = true; } });
        if (vfx) {
          vfx.emit('smoke', w.x, w.y, 3, { tint: 0xb8a890, scale: 0.12, scaleEnd: 0.32, alpha: 0.5, life: 450, speed: [20, 70] });
          if (this.gold > 0) {
            vfx.emit('sparks', w.x, w.y - 14, 10, { tint: 0xffd24a, scale: 0.15, speed: [90, 240], angle: [220, 320], life: 600 });
            vfx.emit('stars', w.x, w.y - 14, 4, { tint: 0xfff0a0, scale: 0.16, speed: [40, 140], life: 600 });
            AudioManager.sfx('gold_pickup', { volume: 0.3 });
            this.coins(w, gy);
          } else if (rarity === 'rare') { vfx.fx.hitSpark(w.x, w.y - 20, -Math.PI / 2, 'holy', true); AudioManager.sfx('heart_sparkle', { volume: 0.5 }); }
          else if (rarity === 'unique') { vfx.fx.hitSpark(w.x, w.y - 20, -Math.PI / 2, 'holy', true); vfx.shockwave(w.x, w.y, { element: 'holy', radius: 120, duration: 600 }); AudioManager.sfx('quest_complete', { volume: 0.45 }); }
          else if (rarity !== 'normal') { vfx.emit('stars', w.x, w.y - 14, 4, { tint: 0x8fb8ff, scale: 0.14, speed: [40, 120], life: 500 }); }
        }
      },
    });
  }

  /** A few tiny coins bouncing around a gold pile. */
  private coins(w: { x: number; y: number }, gy: number): void {
    const sc = this.scene;
    const key = sc.textures.exists('icon_item_gold') ? 'icon_item_gold' : null;
    if (!key) return;
    for (let i = 0; i < 4; i++) {
      const c = sc.add.image(w.x, gy, key).setDisplaySize(14, 14).setDepth(w.y + 1);
      const tx = w.x + (Math.random() - 0.5) * 80, st = { k: 0 };
      sc.tweens.add({ targets: st, k: 1, duration: 420 + Math.random() * 120, onUpdate: () => c.setPosition(w.x + (tx - w.x) * st.k, gy - 40 * 4 * st.k * (1 - st.k) + 8 * st.k).setAngle(st.k * 540), onComplete: () => sc.tweens.add({ targets: c, alpha: 0, duration: 250, onComplete: () => c.destroy() }) });
    }
  }

  /** Called every frame; `alt` shows every label. */
  refresh(alt: boolean): void {
    const now = this.scene.time.now;
    if (this.landed) {
      this.icon.y = this.baseY + Math.sin(now / 320 + this.bornAt) * 3;
      const v = this.vfx;
      if (v && this.alwaysShow && now - this.lastSparkle > (this.item ? 650 : 1400)) {
        this.lastSparkle = now;
        const w = gridToWorld(this.gx, this.gy);
        v.emit('stars', w.x + (Math.random() - 0.5) * 30, w.y - 20 - Math.random() * (this.tall * 0.7 || 20), 1, { tint: this.item ? this.col : 0xffe680, scale: 0.12, scaleEnd: 0.02, speed: [5, 25], life: 800, angle: [250, 290] });
      }
    }
    this.label.setVisible(this.alwaysShow || alt || this.hover);
    this.label.setBackgroundColor(this.hover ? '#403020e0' : '#000000b0');
  }

  destroy(): void {
    this.scene.tweens.killTweensOf([this.icon, this.beam].filter(Boolean) as object[]);
    this.shadow.destroy();
    this.icon.destroy();
    this.beam?.destroy();
    this.label.destroy();
  }
}