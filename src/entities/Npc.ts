import Phaser from 'phaser';
import { NPCS, type NpcDef } from '../data/npcs';
import { Entity } from './Entity';

export class Npc extends Entity {
  readonly def: NpcDef;
  private lineIdx = 0;

  constructor(scene: Phaser.Scene, npcId: string, gx: number, gy: number) {
    const def = NPCS[npcId];
    super(scene, { kind: 'npc', textureKey: def.textureKey, gx: gx + 0.5, gy: gy + 0.5, id: `npc_${npcId}`, radius: 0.7 });
    this.def = def;
    this.addLabel(def.name, '#e8d9a0');
  }

  /** Next line of placeholder dialogue (the dialogue module replaces this). */
  nextLine(): string {
    const l = this.def.lines[this.lineIdx % this.def.lines.length];
    this.lineIdx++;
    return l;
  }

  tick(_time: number, dtMs: number): void { this.anim.update(dtMs, false); }
}