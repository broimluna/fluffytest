import { ChatUI } from '../ui/ChatUI.js';

export class UIOverlayScene extends Phaser.Scene {
    constructor() { super('UIOverlayScene'); }

    create() {
        this.chat = null;

        // When name accepted create chat
        this.game.events.on('nameAccepted', () => {
            if (!this.chat) {
                this.chat = new ChatUI(this, {
                    onSend: (msg) => {
                        const world = this.scene.get('WorldScene');
                        world?.roomConnector?.sendChatMessage(msg);
                    }
                });
            }
        });

        // Incoming chat from world
        this.game.events.on('chatMessage', (msg) => {
            if (!this.chat) return;
            const myId = this.scene.get('WorldScene')?.roomConnector?.getPlayerId?.();
            if (msg.playerId === myId) return; // already shown locally
            this.chat.appendRemote(msg.playerId, msg.message);
        });
    }

    appendLocal(text) { this.chat?.appendLocal(text); }
    isPointerInChatArea(pointer) { return this.chat?.isPointerInChatArea(pointer) || false; }

    update(time, delta) { this.chat?.update(time, delta); }
}