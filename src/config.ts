import Phaser from 'phaser';
import { BASE_H, BASE_W } from './constants';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { CharacterCreateScene } from './scenes/CharacterCreateScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { IntroScene } from './scenes/IntroScene';
import { EndingScene } from './scenes/EndingScene';
import { CreditsScene } from './scenes/CreditsScene';

export { BASE_W, BASE_H, ISO } from './constants';

export function createGameConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.WEBGL,
    parent: 'game',
    width: BASE_W,
    height: BASE_H,
    backgroundColor: '#050304',
    pixelArt: false,
    antialias: true,
    roundPixels: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    dom: { createContainer: true },
    input: { mouse: { preventDefaultWheel: true }, touch: { capture: true } },
    scene: [BootScene, PreloadScene, MainMenuScene, CharacterCreateScene, GameScene, UIScene, IntroScene, EndingScene, CreditsScene],
  };
}
