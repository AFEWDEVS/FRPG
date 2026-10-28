import Phaser from 'phaser';
import { EventBus } from '../core/EventBus';
import { NPCS, type NpcDef } from '../data/npcs';
import { QuestManager } from '../quests/QuestManager';
import { Entity } from './Entity';

export class Npc extends Entity {
  readonly def: NpcDef;
  private lineIdx = 0;
  private mark?: Phaser.GameObjects.Text;
  private markTween?: Phaser.Tweens.Tween;
  private bubble?: Phaser.GameObjects.Container;
  private chatterIn = 2000 + Math.random() * 6000;
  private unsub: (() => void)[] = [];

  constructor(scene: Phaser.Scene, npcId: string, gx: number, gy: number) {
    const def = NPCS[npcId];
    super(scene, { kind: 'npc', textureKey: def.textureKey, gx: gx + 0.5, gy: gy + 0.5, id: `npc_${npcId}`, radius: 0.7 });
    this.def = def;
    this.addLabel(def.name, '#e8d9a0');
    this.refreshMarker();
    this.unsub.push(EventBus.on('quests:updated', () => this.refreshMarker()));
    this.unsub.push(EventBus.on('quest:update', () => this.refreshMarker()));
  }

  /** Quest marker above the head: gold '!' = quest to give / talk, '?' = turn-in. */
  private refreshMarker(): void {
    if (!this.active) return;
    const m = QuestManager.markerFor(this.def.id);
    if (!m) {
      this.markTween?.stop();
      this.mark?.destroy();
      this.mark = undefined;
      return;
    }
    const txt = m === 'turnin' ? '?' : '!';
    const y = -this.sprite.displayHeight - 44;
    if (!this.mark) {
      this.mark = this.scene.add.text(0, y, txt, {
        fontFamily: 'Georgia, serif', fontSize: '40px', fontStyle: 'bold', color: '#ffd24a', stroke: '#3a2200', strokeThickness: 6,
      }).setOrigin(0.5, 1);
      this.add(this.mark);
      this.markTween = this.scene.tweens.add({ targets: this.mark, y: y - 10, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      this.mark.setText(txt);
    }
  }

  /** Next line of placeholder dialogue (kept for compatibility; the dialogue module drives conversations). */
  nextLine(): string {
    const l = this.def.lines[this.lineIdx % this.def.lines.length];
    this.lineIdx++;
    return l;
  }

  private say(text: string): void {
    this.bubble?.destroy();
    const t = this.scene.add.text(0, 0, text, {
      fontFamily: 'Georgia, serif', fontSize: '15px', color: '#2a1a0a', align: 'center', wordWrap: { width: 230 },
    }).setOrigin(0.5, 1);
    const w = t.width + 20, h = t.height + 14;
    const bg = this.scene.add.rectangle(0, 6, w, h, 0xf0e2b8, 0.96).setOrigin(0.5, 1).setStrokeStyle(2, 0x6a4a28);
    t.setY(-1);
    const c = this.scene.add.container(0, -this.sprite.displayHeight - (this.mark ? 100 : 40), [bg, t]);
    this.add(c);
    this.bubble = c;
    c.setAlpha(0);
    this.scene.tweens.add({ targets: c, alpha: 1, duration: 250 });
    this.scene.tweens.add({
      targets: c, alpha: 0, delay: 3800, duration: 500,
      onComplete: () => { if (this.bubble === c) this.bubble = undefined; c.destroy(); },
    });
  }

  tick(_time: number, dtMs: number): void {
    this.anim.update(dtMs, false);
    this.chatterIn -= dtMs;
    if (this.chatterIn > 0) return;
    this.chatterIn = 9000 + Math.random() * 9000;
    const pl = (this.scene as unknown as { player?: { gx: number; gy: number } }).player;
    if (!pl || !this.def.chatter.length || Math.hypot(pl.gx - this.gx, pl.gy - this.gy) > 9) return;
    this.say(Phaser.Utils.Array.GetRandom(this.def.chatter));
  }

  destroy(fromScene?: boolean): void {
    this.unsub.forEach((u) => u());
    this.unsub = [];
    super.destroy(fromScene);
  }
}