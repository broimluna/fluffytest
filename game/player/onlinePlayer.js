// OnlinePlayerManager.js
import { createPlayerTexture } from './assets/sprite.js';

export { createPlayerTexture };

export class OnlinePlayerManager {
    constructor(scene) {
        this.scene = scene;
        this.otherPlayers = new Map(); // playerId -> player sprite data
    }

    addPlayer(playerData) {
        if (!playerData || !playerData.id) return;
        const selfId = this.scene.roomConnector?.getPlayerId?.();
        if (playerData.id === selfId) return;
        if (this.otherPlayers.has(playerData.id)) return; // prevent duplicate ghost
        
        console.log('Adding other player:', playerData);
        
        // Create player sprite
        const playerSprite = this.scene.physics.add.sprite(
            playerData.x || 400, 
            playerData.y || 300, 
            'player'
        );
        playerSprite.setOrigin(0.5);
        playerSprite.setData('baseRadius', 24); // stable radius for labels/bubbles
        playerSprite.rotation = 0; // ensure clean start
        
        // Create eyes sprite
        const eyesSprite = this.scene.add.sprite(
            playerData.x || 400, 
            playerData.y || 300, 
            'eyes'
        );
        eyesSprite.setScale(0.1);

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
            player.sprite.destroy();
            player.eyes.destroy();
            player.nameText.destroy();
            this.otherPlayers.delete(id);
            console.log('Removed player:', id);
        }
    }

    movePlayer(playerId, x, y) {
        const p = this.otherPlayers.get(playerId);
        if (!p) return;

        // Kill any existing tween on this sprite to avoid stacking jitter
        this.scene.tweens.killTweensOf([p.sprite, p.eyes]);

        const startX = p.sprite.x;
        const startY = p.sprite.y;

        this.scene.tweens.add({
            targets: [p.sprite, p.eyes],
            x,
            y,
            duration: 110,
            ease: 'Linear',
            onUpdate: () => {
                // Name follows
                const R = p.sprite.getData('baseRadius') || 24;
                p.nameText.x = p.sprite.x;
                p.nameText.y = p.sprite.y + R + 4;

                // Rolling animation (arc length / radius)
                const dx = p.sprite.x - p.prevX;
                const dy = p.sprite.y - p.prevY;
                const dist = Math.hypot(dx, dy);
                if (dist > 0 && dist < p.maxStepForRoll) {
                    const dr = dist / p.rollRadius;
                    p.sprite.rotation += dr;
                    p.eyes.rotation = -p.sprite.rotation; // keep eyes upright
                }
                p.prevX = p.sprite.x;
                p.prevY = p.sprite.y;
            },
            onComplete: () => {
                // Final alignment
                const R = p.sprite.getData('baseRadius') || 24;
                p.nameText.x = p.sprite.x;
                p.nameText.y = p.sprite.y + R + 4;
                p.prevX = p.sprite.x;
                p.prevY = p.sprite.y;
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
