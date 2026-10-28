import type Phaser from 'phaser';
import { EventBus } from './core/EventBus';
import { GameState } from './core/GameState';

/** Dev-only hook for tools/playtest. Exposed as window.__dbg. */
export function installDebug(game: Phaser.Game): void {
  const gs = () => game.scene.getScene('Game') as any;
  const dbg = {
    game, GameState, EventBus,
    get scene() { return gs(); },
    fps: () => game.loop.actualFps,
    giveXp: (n: number) => GameState.gainXp(n),
    giveGold: (n: number) => GameState.addGold(n),
    heal: () => { GameState.life = GameState.maxLife; GameState.mana = GameState.maxMana; GameState.emitVitals(); },
    teleport: (gx: number, gy: number) => { const p = gs().player; p.warp(gx, gy); },
    go: (areaId: string, floor = 0) => { const s = gs(); s.scene.restart({ areaId, entry: "start", floor }); },
  };
  (window as unknown as { __dbg: typeof dbg }).__dbg = dbg;
}
