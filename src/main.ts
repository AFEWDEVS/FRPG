import Phaser from 'phaser';
import { createGameConfig } from './config';

const game = new Phaser.Game(createGameConfig());
// Disable browser context menu (right click = right skill).
window.addEventListener('contextmenu', (e) => e.preventDefault());
(window as unknown as { __game: Phaser.Game }).__game = game;
