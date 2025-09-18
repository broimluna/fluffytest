import { loadTextures } from '../textures.js';
import { createPlayerTexture } from '../player/assets/sprite.js';
import { registerPuffleFromGifs } from '../player/assets/puffleGif.js';

export class PreloadScene extends Phaser.Scene {
    constructor() { super('PreloadScene'); }

    preload() {
        const w = this.scale.width;
        const h = this.scale.height;
        const barBg = this.add.rectangle(w/2, h/2, 320, 20, 0x0a4060, 0.6);
        const bar = this.add.rectangle(w/2 - 158, h/2, 4, 14, 0x22a8ff, 1).setOrigin(0,0.5);
        const pct = this.add.text(w/2, h/2 + 26, '0%', { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);

        loadTextures(this);
        // eyes image needed before createPlayerTexture compose
        this.load.binary('puf_back_gif',           'game/player/assets/puf_back.gif');
        this.load.binary('puf_back_left_gif',      'game/player/assets/puf_back_left.gif');
        this.load.binary('puf_side_gif',           'game/player/assets/puf_side.gif');
        this.load.binary('puf_three_quarter_gif',  'game/player/assets/puf_three_quarter.gif');
        this.load.binary('puf_front_gif',          'game/player/assets/puf_front.gif');

        this.load.once(Phaser.Loader.Events.COMPLETE, async () => {
            // Fallback player texture
            createPlayerTexture(this);

            try {
                await registerPuffleFromGifs(this);
                console.log('[Puffle] ready:', this.registry.get('pufReady'), this.registry.get('pufFirstFrame'));
            } catch (e) {
                console.warn('[Puffle] failed:', e);
            }
        });

        this.load.on('progress', (p) => {
            bar.width = 4 + 312 * p;
            pct.setText(Math.round(p * 100) + '%');
        });
    }

    create() {
        this.scene.start('WelcomeScene');
    }
}