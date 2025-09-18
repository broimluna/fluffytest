// OnlinePlayerManager.js
import { createPlayerTexture } from './assets/sprite.js';

export { createPlayerTexture };

export class OnlinePlayerManager {
    constructor(scene) {
        this.scene = scene;
        this.otherPlayers = new Map(); // playerId -> player sprite data
        this.scene.registry.events.on('changedata', (parent, key, value) => {
            if (key === 'pufReady' && value) this._upgradeAllToPuffle();
        });
    }

    _applyPufScale(sprite, desiredHeight = 48) {
        const h = sprite.height;
        if (h > 0) sprite.setScale(desiredHeight / h);
    }

    _syncBodyToSprite(sprite) {
        if (!sprite?.body) return;
        const w = Math.max(1, Math.round(sprite.displayWidth));
        const h = Math.max(1, Math.round(sprite.displayHeight));
        sprite.body.setSize(w, h, true);
    }

    _upgradeAllToPuffle() {
        const first = this.scene.registry.get('pufFirstFrame');
        const hasIdle = this.scene.anims.exists('puf-front'); // use front as idle
        this.otherPlayers.forEach(p => {
            if (!p || !p.sprite || !first) return;
            p.sprite.setTexture(first);
            this._applyPufScale(p.sprite, 48);
            this._syncBodyToSprite(p.sprite); // <-- match hitbox to GIF
            p.sprite.rotation = 0;
            if (p.eyes) { p.eyes.destroy(); p.eyes = null; }
            if (hasIdle && p.sprite.anims) p.sprite.anims.play('puf-front', true);
        });
    }

    addPlayer(playerData) {
        if (!playerData || !playerData.id) return;
        const selfId = this.scene.roomConnector?.getPlayerId?.();
        if (playerData.id === selfId) return;
        if (this.otherPlayers.has(playerData.id)) return; // prevent duplicate ghost

        console.log('Adding other player:', playerData);

        const usePuf = !!this.scene.registry.get('pufReady');
        const startKey = usePuf ? (this.scene.registry.get('pufFirstFrame') || 'player') : 'player';

        // Create player sprite
        const playerSprite = this.scene.physics.add.sprite(
            playerData.x || 400, 
            playerData.y || 300, 
            startKey
        );
        playerSprite.setOrigin(0.5);
        playerSprite.setData('baseRadius', 24); // stable radius for labels/bubbles
        playerSprite.rotation = 0; // ensure clean start

        if (usePuf) {
            this._applyPufScale(playerSprite, 48);
            this._syncBodyToSprite(playerSprite); // <-- match hitbox to GIF
            playerSprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, () => this._syncBodyToSprite(playerSprite));
        } else {
            playerSprite.body.setSize(28, 28);
            playerSprite.body.setOffset(6, 6);
        }

        if (usePuf && this.scene.anims.exists('puf-front') && playerSprite.anims) {
            playerSprite.anims.play('puf-front');
            const ts = this.scene.registry.get('pufAnimTimeScale') || 1;
            playerSprite.anims.timeScale = ts;
        }

        // Create eyes sprite
        const eyesSprite = usePuf ? null : this.scene.add.sprite(
            playerSprite.x, 
            playerSprite.y, 
            'eyes'
        ).setScale(0.1);

        const nameText = this.scene.add.text(
            playerData.x || 400,
            (playerData.y || 300) + playerSprite.getData('baseRadius') + 4,
            playerData.name || '',
            {
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#000000',
                stroke: '#002744',
                strokeThickness: 0.6
            }
        ).setOrigin(0.5, 0).setDepth(11);
        
        // Store player data
        this.otherPlayers.set(playerData.id, {
            id: playerData.id,
            name: playerData.name,
            sprite: playerSprite,
            eyes: eyesSprite,
            nameText,
            x: playerData.x,
            y: playerData.y,
            prevX: playerSprite.x,
            prevY: playerSprite.y,
            rollRadius: 24,
            maxStepForRoll: 160
        });
    }

    removePlayer(playerId) {
        const id = typeof playerId === 'string' ? playerId : playerId?.playerId;
        if (!id) return;
        const player = this.otherPlayers.get(id);
        if (player) {
            // Kill any running tweens before destroying sprites
            this.scene.tweens.killTweensOf(player.sprite);
            if (player.eyes) this.scene.tweens.killTweensOf(player.eyes);

            player.sprite.destroy();
            if (player.eyes) player.eyes.destroy();
            player.nameText.destroy();
            this.otherPlayers.delete(id);
            console.log('Removed player:', id);
        }
    }

    movePlayer(playerId, x, y) {
        const p = this.otherPlayers.get(playerId);
        if (!p || !p.sprite) return;

        const usePuf = !!this.scene.registry.get('pufReady');
        const baseFacesRight = this.scene.registry.get('pufBaseFacesRight');
        const faceRightFlip = (wantRight) => (baseFacesRight === true ? !wantRight : !!wantRight);

        const dx = x - p.sprite.x;
        const dy = y - p.sprite.y;
        const absX = Math.abs(dx), absY = Math.abs(dy);
        const DIAG_TOL_RATIO = 10;

        const guardAlive = () => p && p.sprite && p.sprite.active && p.sprite.scene;

        const chooseRunAnim = () => {
            if (!usePuf || !guardAlive()) return;
            let anim = 'puf-front';
            let flipX = false;

            if (absY >= absX * DIAG_TOL_RATIO) {
                if (dy < 0 && this.scene.anims.exists('puf-back')) {
                    anim = 'puf-back';
                } else if (this.scene.anims.exists('puf-front')) {
                    anim = 'puf-front';
                }
            } else if (absX >= absY * DIAG_TOL_RATIO) {
                anim = this.scene.anims.exists('puf-side') ? 'puf-side' : 'puf-front';
                flipX = faceRightFlip(dx > 0);
            } else {
                if (this.scene.anims.exists('puf-threeQuarter')) {
                    anim = 'puf-threeQuarter';
                    flipX = faceRightFlip(dx > 0);
                } else if (dy < 0 && this.scene.anims.exists('puf-back')) {
                    anim = 'puf-back';
                } else if (this.scene.anims.exists('puf-front')) {
                    anim = 'puf-front';
                }
            }

            p.sprite.setFlipX(!!flipX);
            if (this.scene.anims.exists(anim) && p.sprite.anims) {
                p.sprite.anims.play(anim, true);
                const ts = this.scene.registry.get('pufAnimTimeScale') || 1;
                p.sprite.anims.timeScale = ts;
            }
        };

        // Only tween non-null targets
        const targets = p.eyes ? [p.sprite, p.eyes] : [p.sprite];

        // Kill existing tweens on these targets
        this.scene.tweens.killTweensOf(targets);

        this.scene.tweens.add({
            targets,
            x, y,
            duration: 110,
            ease: 'Linear',
            onStart: () => chooseRunAnim(),
            onUpdate: () => {
                if (!guardAlive()) return;

                const R = p.sprite.getData('baseRadius') || 24;
                p.nameText.x = p.sprite.x;
                p.nameText.y = p.sprite.y + R + 4;

                if (!usePuf) {
                    const ddx = p.sprite.x - p.prevX;
                    const ddy = p.sprite.y - p.prevY;
                    const dist = Math.hypot(ddx, ddy);
                    if (dist > 0 && dist < p.maxStepForRoll) {
                        const dr = dist / p.rollRadius;
                        p.sprite.rotation += dr;
                        if (p.eyes) p.eyes.rotation = -p.sprite.rotation;
                    }
                } else {
                    p.sprite.rotation = 0;
                    if (p.eyes) p.eyes.rotation = 0;
                }
                p.prevX = p.sprite.x;
                p.prevY = p.sprite.y;
            },
            onComplete: () => {
                if (!guardAlive()) return;

                const R = p.sprite.getData('baseRadius') || 24;
                p.nameText.x = p.sprite.x;
                p.nameText.y = p.sprite.y + R + 4;
                p.prevX = p.sprite.x;
                p.prevY = p.sprite.y;

                if (usePuf && this.scene.anims.exists('puf-front') && p.sprite.anims) {
                    p.sprite.anims.play('puf-front', true);
                    const ts = this.scene.registry.get('pufAnimTimeScale') || 1;
                    p.sprite.anims.timeScale = ts;
                }
            }
        });

        p.x = x;
        p.y = y;
    }

    updatePlayers(players) {
        // Update all players in current room
        const currentPlayerIds = new Set();
        
        players.forEach(playerData => {
            if (playerData.id === this.scene.roomConnector?.getPlayerId?.()) return;
            
            currentPlayerIds.add(playerData.id);
            
            if (this.otherPlayers.has(playerData.id)) {
                // Update existing player
                this.movePlayer(playerData.id, playerData.x, playerData.y);
            } else {
                // Add new player
                this.addPlayer(playerData);
            }
        });
        
        // Remove players no longer in room
        this.otherPlayers.forEach((player, playerId) => {
            if (!currentPlayerIds.has(playerId)) {
                this.removePlayer(playerId);
            }
        });
    }

    clearAllPlayers() {
        this.otherPlayers.forEach((player, playerId) => {
            this.removePlayer(playerId);
        });
    }

    updatePlayerName(playerId, name) {
        const p = this.otherPlayers.get(playerId);
        if (p) {
            p.name = name;
            p.nameText.setText(name);
        }
    }
}
