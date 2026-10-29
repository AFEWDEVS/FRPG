import Phaser from 'phaser';
import { CHAR_SCALE, ISO } from '../constants';
import { gridToWorld } from '../iso/iso';
import { ProcAnim } from './ProcAnim';
import { CharacterAnimator, animMetaKey, animSheetKey, isValidMeta } from '../anim/CharacterAnimator';

export type EntityKind = 'player' | 'enemy' | 'npc';

let uid = 0;
export const nextEntityId = (prefix: string) => `${prefix}_${++uid}`;

export interface EntityOptions {
  id?: string;
  kind: EntityKind;
  textureKey: string;
  gx: number;
  gy: number;
  /** Extra scale on top of ART_SCALE. */
  scale?: number;
  /** Radius in tiles for picking / melee range. */
  radius?: number;
}

/**
 * Base for everything that stands on the map. Position of truth is (gx, gy) in continuous grid space;
 * the Container's x/y/depth are derived. Depth = world y so iso sorting just works.
 */
export abstract class Entity extends Phaser.GameObjects.Container {
  readonly id: string;
  readonly kind: EntityKind;
  gx: number;
  gy: number;
  hp = 1;
  maxHp = 1;
  /** Tiles per second. */
  speed = 3;
  facingLeft = false;
  facingUp = false;
  readonly radius: number;
  readonly sprite: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Ellipse;
  readonly anim: ProcAnim;
  protected moving = false;
  protected label?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, o: EntityOptions) {
    super(scene, 0, 0);
    this.id = o.id ?? nextEntityId(o.kind);
    this.kind = o.kind;
    this.gx = o.gx;
    this.gy = o.gy;
    this.radius = o.radius ?? 0.5;
    const sc = ISO.ART_SCALE * CHAR_SCALE * (o.scale ?? 1);
    this.shadow = scene.add.ellipse(0, 0, 70 * CHAR_SCALE * (o.scale ?? 1), 28 * CHAR_SCALE * (o.scale ?? 1), 0x000000, 0.4);
    this.sprite = scene.add.image(0, 0, o.textureKey).setOrigin(0.5, 1).setScale(sc);
    this.add([this.shadow, this.sprite]);
    this.anim = new ProcAnim(this.sprite, this.shadow, sc);
    const meta = scene.cache.json.get(animMetaKey(o.textureKey));
    if (isValidMeta(meta) && scene.textures.exists(animSheetKey(o.textureKey))) {
      this.anim.setAnimator(new CharacterAnimator(this.sprite, o.textureKey, meta, this.sprite.height));
    }
    scene.add.existing(this);
    this.syncPosition();
  }

  /** Teleport on the grid. */
  setGrid(gx: number, gy: number): void {
    this.gx = gx;
    this.gy = gy;
    this.syncPosition();
  }

  protected syncPosition(): void {
    const w = gridToWorld(this.gx, this.gy);
    this.setPosition(w.x, w.y);
    this.setDepth(w.y);
  }

  /** Set facing from a grid-space movement vector (art faces down-right; flip for left). */
  faceGrid(dgx: number, dgy: number): void {
    const sx = dgx - dgy; // screen x direction
    if (Math.abs(sx) > 0.01) {
      this.facingLeft = sx < 0;
      this.anim.setFacingLeft(this.facingLeft);
    }
    const sy = dgx + dgy; // screen y direction (negative = walking away from camera)
    if (Math.abs(sy) > 0.2 * Math.hypot(sx, sy)) {
      this.facingUp = sy < 0;
      this.anim.setFacingUp(this.facingUp);
    }
  }

  protected addLabel(text: string, color = '#ffffff'): void {
    this.label = this.scene.add.text(0, -this.sprite.displayHeight - 10, text, {
      fontFamily: 'Georgia, serif', fontSize: '14px', color, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 1);
    this.add(this.label);
  }

  distanceTo(o: { gx: number; gy: number }): number { return Math.hypot(this.gx - o.gx, this.gy - o.gy); }

  /** Called every frame by GameScene. */
  abstract tick(time: number, dtMs: number): void;
}