import { Controls } from '../input/InputSystem.js';
import { getServerSocket } from '../networking/serverConnector.js';
import { RoomConnector } from '../networking/roomConnector.js';
import { OnlinePlayerManager } from '../player/onlinePlayer.js';
import { MainPlayerManager } from '../player/mainPlayer.js';
import { RoomManager } from '../rooms/RoomManager.js';
import { registerRooms } from '../rooms/roomList.js';

export class WorldScene extends Phaser.Scene {
    constructor() { super('WorldScene'); }

    init(data) {
        this.pendingPlayerName = data?.playerName || null;
        this.initialGameState = data?.initialGameState || null; // <--- capture
    }

    create() {
        const socket = getServerSocket(); // singleton
        this.roomConnector = new RoomConnector(socket);

        // If gameState was already received before this RoomConnector bound, bootstrap manually
        if (this.initialGameState) this._bootstrapFromInitialGameState(this.initialGameState);

        this._initCore();
    }

    _bootstrapFromInitialGameState(gs) {
        // Emulate what RoomConnector would set when receiving 'gameState'
        this.roomConnector.playerId = gs.playerId;
        this.roomConnector.currentRoom = gs.currentRoom;
        this.roomConnector.authenticated = true;
        // Flush any queued runAfterAuth calls
        if (this.roomConnector._flushAuthQueue) this.roomConnector._flushAuthQueue();
        // Provide callbacks if already set later (we buffer gs for RoomManager)
        this._preBootstrapState = gs;
    }

    _initCore() {
        this.roomConnector.enableDebug(false);

        this.mainPlayerManager = new MainPlayerManager(this);
        this.onlinePlayerManager = new OnlinePlayerManager(this);
        this.roomManager = new RoomManager(this);
        registerRooms(this.roomManager);
        this.roomManager.setRoomConnector(this.roomConnector);

        this.controls = new Controls(this);

        this.roomConnector.setCallbacks({
            onGameState: (gs) => {
                // If we already bootstrapped, avoid duplicate
                if (this._handledInitial) return;
                this._handledInitial = true;
                this._onInitialState(gs);
            },
            onInitialState: (gs) => {
                if (this._handledInitial) return;
                this._handledInitial = true;
                this._onInitialState(gs);
            },
            onPlayerIdReady: () => this.roomManager?.tryProcessInitialState?.(),
            onNameAccepted: (data) => {
                if (data?.name) {
                    this.mainPlayerManager?.setName?.(data.name);
                    this.game.events.emit('nameAccepted', data.name);
                }
            },
            onPlayerRenamed: (d) => {
                if (!d?.playerId) return;
                if (d.playerId === this.roomConnector.getPlayerId()) {
                    this.mainPlayerManager?.setName?.(d.name);
                } else {
                    this.onlinePlayerManager?.updatePlayerName(d.playerId, d.name);
                }
            },
            onChatMessage: (msg) => {
                if (!msg?.message) return;
                this.game.events.emit('chatMessage', msg);
            },
            onPlayerMoved: (data) => this.onlinePlayerManager?.movePlayer(data.playerId, data.x, data.y),
            onPlayerJoined: (p) => this.roomManager?.addRemotePlayer(p),
            onPlayerLeft: (d) => this.onlinePlayerManager?.removePlayer(d.playerId || d)
        });

        // If we had a pre bootstrap state (passed in), feed it now
        if (this._preBootstrapState) {
            this._onInitialState(this._preBootstrapState);
            this._preBootstrapState = null;
        }

        // Ensure room exists locally even if server already placed us
        this.roomConnector.runAfterAuth(() => {
            if (!this.roomManager.currentRoom) {
                const r = this.initialGameState?.currentRoom || 'town';
                this.roomManager.switchRoomLocal(r);
            }
            if (this.pendingPlayerName) {
                this.roomConnector.sendSetName(this.pendingPlayerName);
            }
        });

        this.events.on('player-moved', (pos) => {
            this.roomConnector?.updatePlayerPosition(pos.x, pos.y);
        });

        this.input.on('pointerdown', (pointer) => {
            const overlay = this.scene.get('UIOverlayScene');
            if (overlay?.isPointerInChatArea?.(pointer)) return;
            this.mainPlayerManager.moveToTarget({
                x: pointer.worldX ?? pointer.x,
                y: pointer.worldY ?? pointer.y
            });
        });
    }

    _onInitialState(gs) {
        // Provide players/currentRoom to RoomManager
        this.roomManager._initialStateBuffer = {
            currentRoom: gs.currentRoom,
            players: gs.players || []
        };
        this.roomManager.tryProcessInitialState();
    }

    update(time, delta) {
        this.controls?.update();
        this.mainPlayerManager?.update(time, delta);
    }
}