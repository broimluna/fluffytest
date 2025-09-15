import { Room } from './Room.js';

export class RoomManager {
    constructor(scene) {
        this.scene = scene;
        this.rooms = new Map();
        this.currentRoom = null;
        this.switching = false;
        this.colliders = [];
        this.roomConnector = null;
        this.pendingRemotePlayers = []; // queue until main player exists
        this.portalCooldownMs = 600;
        this.lastPortalTime = 0;
        this._initialStateBuffer = null;
        this._didInitialSpawn = false;
        this._pendingPrevRoom = null; // <--- NEW
    }

    addRoom(name, roomData) {
        const room = new Room(this.scene, roomData);
        this.rooms.set(name, room);
    }

    setRoomConnector(roomConnector) {
        this.roomConnector = roomConnector;
        this.roomConnector.setCallbacks({
            onInitialState: (data) => {
                console.log('[RoomManager] Initial state:', data);
                // Store for later in case playerId not ready yet
                this._initialStateBuffer = data;
                this.tryProcessInitialState();
            },
            onRoomChanged: (data) => {
                // Prefer server supplied fromRoom, else pending from portal, else current (before switch)
                const from = data.fromRoom ?? this._pendingPrevRoom ?? this.currentRoom?.name ?? null;
                this._pendingPrevRoom = null;
                console.log('[RoomManager] onRoomChanged', { newRoom: data.newRoom, from });
                this.performLocalSwitch(from, data);
            },
            onPlayersUpdate: (players) => this.enqueueOrApplyPlayers(players),
            onPlayerJoined: (player) => this.addRemotePlayer(player),
            onPlayerLeft: (payload) => {
                const id = typeof payload === 'string' ? payload : payload?.playerId;
                if (id) this.scene.onlinePlayerManager.removePlayer(id);
            },
            onPlayerMoved: (data) => this.scene.onlinePlayerManager.movePlayer(data.playerId, data.x, data.y)
        });
    }

    tryProcessInitialState() {
        if (!this._initialStateBuffer) return;
        const data = this._initialStateBuffer;
        const myId = this.roomConnector?.getPlayerId?.();
        // Require both playerId and main player sprite
        if (!myId || !this.scene.mainPlayerManager?.player) return;

        if (data.currentRoom && (!this.currentRoom || this.currentRoom.name !== data.currentRoom)) {
            this.switchRoomLocal(data.currentRoom);
        }
        this.enqueueOrApplyPlayers(data.players);
        this.flushPendingPlayers();
        this._initialStateBuffer = null;
    }

    addRemotePlayer(player) {
        if (!player || !player.id) return;
        const myId = this.roomConnector?.getPlayerId?.();
        if (!myId) { // defer until we know self id
            this.pendingRemotePlayers.push(player);
            return;
        }
        if (player.id === myId) return;
        if (!this.scene.mainPlayerManager?.player) {
            this.pendingRemotePlayers.push(player);
            return;
        }
        this.scene.onlinePlayerManager.addPlayer(player);
    }

    enqueueOrApplyPlayers(players) {
        if (!Array.isArray(players) || players.length === 0) return;
        const myId = this.roomConnector?.getPlayerId?.();
        if (!myId || !this.scene.mainPlayerManager?.player) {
            // Defer everything until both exist
            this.pendingRemotePlayers.push(...players);
            return;
        }
        const filtered = players.filter(p => p && p.id && p.id !== myId);
        if (filtered.length) {
            this.scene.onlinePlayerManager.updatePlayers(filtered);
        }
        // Purge any accidental self ghost
        this.scene.onlinePlayerManager.removePlayer?.(myId);
    }

    flushPendingPlayers() {
        if (this.pendingRemotePlayers.length && this.scene.mainPlayerManager?.player) {
            const batch = [...this.pendingRemotePlayers];
            this.pendingRemotePlayers.length = 0;
            this.enqueueOrApplyPlayers(batch);
        }
    }

    handlePortalOverlap(portal) {
        if (!this.roomConnector || !this.roomConnector.isConnected || !this.roomConnector.isConnected()) return;
        if (this.switching) return;
        if (!portal?.targetRoom) return;

        const now = Date.now();
        if (now - this.lastPortalTime < this.portalCooldownMs) return;
        this.lastPortalTime = now;

        this.switching = true;
        this.scene.mainPlayerManager.disableMovement();

        // Capture previous room once
        this._pendingPrevRoom = this.currentRoom?.name || null;

        this.roomConnector.switchRoom(portal.targetRoom, this._pendingPrevRoom, null)
            .catch(err => {
                console.error('Room switch failed:', err);
                this.scene.mainPlayerManager.enableMovement();
                this.switching = false;
            })
            .finally(() => {
                this.scene.time.delayedCall(400, () => { this.switching = false; });
            });
    }

    performLocalSwitch(prevRoomName, data) {
        if (!data || !data.newRoom) {
            console.error('[RoomManager] performLocalSwitch invalid payload:', data);
            return;
        }
        console.log('[RoomManager] switching to', data.newRoom, 'from', prevRoomName);
        this.scene.onlinePlayerManager.clearAllPlayers();
        this.switchRoomLocal(data.newRoom, prevRoomName, data);
        this.enqueueOrApplyPlayers(data.players);
    }

    // Force spawn logic on portal-based switches (ignore server coords except initial login)
    switchRoomLocal(name, fromRoomName, ackData) {
        if (this.currentRoom) this.currentRoom.exit();
        const room = this.rooms.get(name);
        if (!room) {
            console.error('[RoomManager] Unknown room:', name);
            return;
        }
        this.currentRoom = room;
        room.enter();

        const player = this.scene.mainPlayerManager.player;
        let usedServerPos = false;
        const isInitial = !this._didInitialSpawn;

        if (isInitial && ackData && Array.isArray(ackData.players)) {
            const myId = this.roomConnector?.getPlayerId();
            const me = ackData.players.find(p => p.id === myId);
            if (me && typeof me.x === 'number' && typeof me.y === 'number') {
                player.setPosition(me.x, me.y);
                usedServerPos = true;
                console.log('[SpawnDebug] server authoritative (initial)', { x: me.x, y: me.y });
            }
        }

        if (!usedServerPos) {
            const sp = room.getSpawnPointFor(fromRoomName);
            if (sp) {
                player.setPosition(sp.x, sp.y);
                console.log('[SpawnDebug] client spawn', { room: name, from: fromRoomName, pos: sp });
            } else {
                console.warn('[SpawnDebug] no spawn resolved', { room: name, from: fromRoomName });
            }
        }

        if (isInitial) this._didInitialSpawn = true;

        this.scene.time.delayedCall(50, () => {
            this.setupCollisions();
            this.scene.mainPlayerManager.enableMovement();
            this.flushPendingPlayers();
            this.tryProcessInitialState();
        });
    }

    setupCollisions() {
        this.colliders.forEach(c => c.destroy());
        this.colliders = [];
        if (!this.currentRoom) return;

        const player = this.scene.mainPlayerManager.player;
        if (!player) return;

        const now = () => Date.now();

        // Single collider vs wall group
        const wallGroup = this.currentRoom.getWallGroup();
        this.colliders.push(
            this.scene.physics.add.collider(
                player,
                wallGroup,
                (playerSprite, wall) => {
                    const t = now();
                    if (!wall._lastTouchLog || t - wall._lastTouchLog > 150) {
                        wall._lastTouchLog = t;
                        console.log(
                            `touched wall! world=(${wall.x},${wall.y}) tile=(${wall._tileX},${wall._tileY})`
                        );
                    }
                }
            )
        );

        // Portals
        this.currentRoom.getPortals().forEach(portal => {
            this.colliders.push(
                this.scene.physics.add.overlap(
                    player,
                    portal,
                    () => this.handlePortalOverlap(portal),
                    null,
                    this
                )
            );
        });
    }
}