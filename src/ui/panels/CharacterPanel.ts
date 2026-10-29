import { EventBus } from '../../core/EventBus';
import { GameState, xpForLevel } from '../../core/GameState';
import { CLASSES } from '../../data/classes';
import { S } from '../../data/strings';
import { Panel, type UiHost } from '../Panel';
import { COL } from '../theme';
import { getDerived } from '../derived';

export class CharacterPanel extends Panel {
  constructor(host: UiHost) { super(host, 'character', 420, 520, 'left', 'Personaje'); }

  protected build(): void {
    const p = GameState.profile, d = getDerived(), cls = CLASSES[p.classId];
    this.text(this.w / 2, 62, p.name, 22, COL.gold, 0.5, 0.5);
    this.text(this.w / 2, 86, `${cls.name} - Nivel ${p.level}`, 15, COL.text, 0.5, 0.5);
    // XP bar
    const next = xpForLevel(p.level);
    const g = this.add(this.host.add.graphics());
    g.fillStyle(0x1c1410).fillRoundedRect(30, 104, this.w - 60, 12, 6).fillStyle(0xd8a030).fillRoundedRect(30, 104, Math.max(12, (this.w - 60) * Math.min(1, p.xp / next)), 12, 6)
      .lineStyle(1, 0x8a6e44).strokeRoundedRect(30, 104, this.w - 60, 12, 6);
    this.text(this.w / 2, 110, `Experiencia ${p.xp} / ${next}`, 11, '#ffffff', 0.5, 0.5);

    // attributes
    this.text(30, 134, 'Atributos', 17, COL.gold);
    if (p.statPoints > 0) this.text(this.w - 30, 136, `Puntos: ${p.statPoints}`, 16, '#ffe680', 1, 0);
    const keys = ['str', 'dex', 'vit', 'ene'] as const;
    keys.forEach((k, i) => {
      const y = 164 + i * 34;
      const gear = d[k] - p.stats[k];
      this.text(36, y, S.stats[k], 16);
      this.text(210, y, String(p.stats[k]), 16, '#ffffff', 1, 0);
      if (gear) this.text(216, y, `+${gear}`, 14, COL.blue);
      if (p.statPoints > 0) {
        this.button(this.w - 64, y - 4, 32, 28, '+', () => {
          if (p.statPoints <= 0) return;
          p.statPoints--;
          p.stats[k]++;
          EventBus.emit('stats:changed');
          GameState.emitVitals();
        }, true, 20);
      }
    });

    // derived
    this.text(30, 308, 'Estadísticas', 17, COL.gold);
    const rows: [string, string, string?][] = [
      ['Vida', `${Math.ceil(GameState.life)} / ${d.maxLife}`],
      ['Maná', `${Math.ceil(GameState.mana)} / ${d.maxMana}`],
      ['Daño', `${d.damage[0]} - ${d.damage[1]}`],
      ['Armadura', String(d.armor)],
      ['Res. fuego', `${d.fireRes}%`, '#ff9060'],
      ['Res. frío', `${d.coldRes}%`, '#80c0ff'],
      ['Res. rayo', `${d.lightRes}%`, '#ffee70'],
      ['Vel. movimiento', `+${d.moveSpeed}%`],
      ['Prob. crítico', `${d.critChance}%`],
      ['Oro', String(p.gold), '#ffd24a'],
    ];
    rows.forEach(([l, v, c], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 36 + col * 190, y = 336 + row * 30;
      this.text(x, y, l, 14, COL.dim);
      this.text(x + 170, y, v, 14, c ?? '#ffffff', 1, 0);
    });
    if (p.skillPoints > 0) this.text(this.w / 2, 494, `Puntos de habilidad: ${p.skillPoints} (T)`, 15, '#ffe680', 0.5, 0.5);
  }
}