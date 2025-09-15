import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { WelcomeScene } from './scenes/WelcomeScene.js';
import { WorldScene } from './scenes/WorldScene.js';
import { UIOverlayScene } from './scenes/UIOverlayScene.js';

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [BootScene, PreloadScene, WelcomeScene, WorldScene, UIOverlayScene]
};

const game = new Phaser.Game(config);
window.game = game;