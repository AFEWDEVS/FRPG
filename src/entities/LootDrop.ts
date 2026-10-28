import Phaser from 'phaser';
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
  private beam?: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private hover = false;
  private alwaysShow: boolean;
  readonly bornAt: number;

  constructor(private scene: Phaser.Scene, o: { gx: number; gy: number; item?: Item; gold?: number }, onClick: (d: LootDrop, p: Phaser.Input.Pointer) => void) {
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
    scene.tweens.add({ targets: this.icon, y: w.y - 16, duration: 480, ease: 'Bounce.easeOut' });
    if (this.item && rarity !== 'normal') {
      const col = RARITY_HEX[rarity];
      const tall = rarity === 'magic' ? 90 : rarity === 'rare' ? 140 : 190;
      this.beam = scene.add.rectangle(w.x, w.y - 2, rarity === 'magic' ? 8 : 12, tall, col, 0.32).setOrigin(0.5, 1).setDepth(BEAM_DEPTH).setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({ targets: this.beam, alpha: 0.12, yoyo: true, repeat: -1, duration: 900 + Math.random() * 400 });
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

  /** Called every frame; `alt` shows every label. */
  refresh(alt: boolean): void {
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