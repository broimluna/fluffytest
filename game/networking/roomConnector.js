// PATCH: unify event shapes & prevent duplicate double-binding + fix playerLeft param shape
export class RoomConnector {
    constructor(socket) {
        if (!socket) throw new Error('RoomConnector requires existing socket from ServerConnector.');
        this.socket = socket;
        this.playerId = socket.id;
        this.currentRoom = null;
        this.connected = socket.connected;
        this.callbacks = {};
        this._debug = false;

        this.authenticated = false;          // <--- NEW
        this._authQueue = [];                // <--- NEW (functions waiting for auth)
        this._boundCore = false;
        this._bindCore();
    }

    runAfterAuth(fn) {                       // <--- NEW
        if (this.authenticated) fn();
        else this._authQueue.push(fn);
    }
    _flushAuthQueue() {                      // <--- NEW
        const q = this._authQueue.splice(0);
        q.forEach(f => { try { f(); } catch(e){ console.error(e); } });
    }

    isAuthenticated() { return this.authenticated; } // <--- NEW

    _log(...a) { if (this._debug) console.log('[RoomConnector]', ...a); }

    _bindCore() {
        if (this._boundCore) return;
        this._boundCore = true;

        // SINGLE set of listeners (removed duplicates from previous setupEventListeners)
        this.socket.on('connect', () => {
            this.playerId = this.socket.id;
            this.connected = true;
            this._log('connected', this.playerId);
            this.callbacks.onPlayerIdReady && this.callbacks.onPlayerIdReady(this.playerId);
        });

        this.socket.on('disconnect', () => {
            this.connected = false;
            this._log('disconnected');
            this.callbacks.onDisconnect && this.callbacks.onDisconnect();
        });

        this.socket.on('gameState', (data) => {
            // Normalized: initial state
            this._log('gameState', data);
            this.playerId = data.playerId;
            this.currentRoom = data.currentRoom;
            this.authenticated = true;       // <--- mark authed here
            this._flushAuthQueue();          // <--- release queued ops
            // Provide both (backwards compatibility)
            this.callbacks.onGameState && this.callbacks.onGameState(data);
            this.callbacks.onInitialState && this.callbacks.onInitialState(data);
        });

        this.socket.on('roomChanged', (data) => {
            this._log('roomChanged', data);
            this.currentRoom = data.newRoom;
            this.callbacks.onRoomChanged && this.callbacks.onRoomChanged(data);
        });

        this.socket.on('roomPlayers', (players) => {
            this._log('roomPlayers', players);
            this.callbacks.onPlayersUpdate && this.callbacks.onPlayersUpdate(players);
        });

        this.socket.on('playerJoined', (player) => {
            this._log('playerJoined', player);
            this.callbacks.onPlayerJoined && this.callbacks.onPlayerJoined(player);
        });

        this.socket.on('playerLeft', (data) => {
            // Always pass object {playerId}
            this._log('playerLeft', data);
            this.callbacks.onPlayerLeft && this.callbacks.onPlayerLeft(data);
        });

        this.socket.on('playerMoved', (data) => {
            this.callbacks.onPlayerMoved && this.callbacks.onPlayerMoved(data);
        });

        this.socket.on('playerRenamed', (data) => {
            this.callbacks.onPlayerRenamed && this.callbacks.onPlayerRenamed(data);
        });
        this.socket.on('nameAccepted', (data) => {
            this.callbacks.onNameAccepted && this.callbacks.onNameAccepted(data);
        });
        this.socket.on('nameRejected', (data) => {
            this.callbacks.onNameRejected && this.callbacks.onNameRejected(data);
        });

        this.socket.on('chatMessage', (data) => {
            this._log('chat RX', data);
            this.callbacks.onChatMessage && this.callbacks.onChatMessage(data);
        });
    }

    enableDebug(on = true) { this._debug = !!on; }

    switchRoom(targetRoom, fromRoom, spawnPoint) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected()) return reject(new Error('Not connected to server.'));
            this.runAfterAuth(() => {
                this._log('switchRoom emit', { fromRoom, targetRoom });
                this.socket.emit('switchRoom', { targetRoom, fromRoom, spawnPoint }, (response) => {
                    this._log('switchRoom ack', response);
                    if (response && response.success) {
                        resolve(response.data || { newRoom: targetRoom });
                    } else {
                        reject(new Error(response?.error || 'Room switch failed'));
                    }
                });
            });
        });
    }

    updatePlayerPosition(x, y) {
        if (!this.isConnected()) return;
        this.socket.emit('playerMove', { x, y });
    }

    sendChatMessage(message) {
        if (!message || !this.socket) return;
        const clean = ('' + message).trim();
        if (!clean) return;
        this.socket.emit('chatMessage', { message: clean });
    }

    sendSetName(name) {
        if (!this.isConnected()) return;
        const clean = (name || '').trim();
        this.socket.emit('setName', { name: clean });
    }

    setCallbacks(callbacks) {
        this.callbacks = { ...(this.callbacks || {}), ...(callbacks || {}) };
    }

    isConnected() { return this.socket && this.socket.connected; }
    getPlayerId() { return this.playerId; }
    getCurrentRoom() { return this.currentRoom; }
}