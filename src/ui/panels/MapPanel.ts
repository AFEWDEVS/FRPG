import type { AutoMap, GameLike } from '../AutoMap';
import { Panel, type UiHost } from '../Panel';
import { COL } from '../theme';

export class MapPanel extends Panel {
  areaName = '';
  constructor(host: UiHost, private automap: AutoMap, private getGame: () => GameLike | undefined) {
    super(host, 'map', 560, 520, 'left', 'Mapa');
  }

  protected build(): void {
    this.text(this.w / 2, 60, this.areaName, 16, COL.text, 0.5, 0.5);
    const g = this.add(this.host.add.graphics());
    g.fillStyle(0x050304, 0.9).fillRect(20, 76, this.w - 40, 400).lineStyle(1, 0x5a4a34).strokeRect(20, 76, this.w - 40, 400);
    this.automap.drawPanel(this.getGame(), this.x + 28, this.y + 84, this.w - 56, 384);
    this.text(this.w / 2, 494, 'Tab: mapa transparente   -   Amarillo: escaleras   Azul: portal', 12, COL.dim, 0.5, 0.5);
  }
  protected onClose(): void { this.automap.hidePanel(); }
}