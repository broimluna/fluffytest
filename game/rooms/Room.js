export class Room {
    constructor(scene, roomData) {
        this.scene = scene;
        this.tileData = roomData.tileData;
        this.name = roomData.name || '(unnamed)'; // <--- add
        this.wallIndex = roomData.wallIndex || 1;
        this.portalIndex = roomData.portalIndex || 2;

        // NEW: multi‑spawn support
        // spawnIndexMap: tileValue -> spawnKey  (e.g. {3:'default',4:'fromTown',...})
        this.spawnIndexMap = roomData.spawnIndexMap || { 3: 'default' };
        this.arrivalMap = roomData.arrivalMap || {};          // fromRoomName -> spawnKey
        this.defaultSpawnKey = roomData.defaultSpawnKey || 'default';

        this.spawnPoints = {}; // spawnKey -> {x,y}

        this.portalTarget = roomData.portalTarget;
        this.backgroundMusic = roomData.backgroundMusic;
        this.backgroundKey = roomData.backgroundKey;
        this.walls = [];
        this.portals = [];
        this.spawnPoint = null; // kept for backwards compatibility (== default spawn)

        this.music = null;
        this.background = null;
        this.wallGroup = this.scene.physics.add.staticGroup();
        this.createFromTileData();
        this.hideAll();
    }

    createFromTileData() {
        if (this.backgroundKey) {
            this.background = this.scene.add.image(0, 0, this.backgroundKey)
                .setOrigin(0, 0)
                .setDepth(-1)
                .setVisible(false);
            this.background.setDisplaySize(
                this.scene.sys.game.config.width,
                this.scene.sys.game.config.height
            );
        }

        const spawnValues = Object.keys(this.spawnIndexMap).map(v => +v);

        for (let y = 0; y < this.tileData.length; y++) {
            for (let x = 0; x < this.tileData[y].length; x++) {
                const tile = this.tileData[y][x];
                const worldX = x * 32 + 16;
                const worldY = y * 32 + 16;

                if (tile === this.wallIndex) {
                    const wall = this.scene.add.rectangle(worldX, worldY, 32, 32, 0x1e6aff, 0); // blue (alpha 0 if debug off)
                    this.wallGroup.add(wall);
                    wall.body.setSize(32, 32);
                    wall._tileX = x;
                    wall._tileY = y;
                    wall._lastTouchLog = 0;
                    wall.setData('isWall', true);
                    // Keep visible flag true so we can tint quickly (alpha controls actual visibility)
                    wall.setVisible(true);
                    this.walls.push(wall);
                } else if (tile === this.portalIndex) {
                    const portal = this.scene.add.zone(worldX, worldY, 32, 32, 0x000000, 0); // invisible
                    this.scene.physics.add.existing(portal, true);
                    portal.targetRoom = this.portalTarget;
                    portal.setData('isPortal', true);
                    portal.body.enable = false;
                    portal._debugRect = null; // will create only in debug mode
                    this.portals.push(portal);
                } else if (spawnValues.includes(tile)) {
                    const key = this.spawnIndexMap[tile];
                    this.spawnPoints[key] = { x: worldX, y: worldY };
                    if (key === this.defaultSpawnKey) {
                        this.spawnPoint = { x: worldX, y: worldY };
                    }
                }
            }
        }
    }

    hideAll() {
        if (this.background) this.background.setVisible(false);
        // Keep walls technically visible; alpha managed by debug mode
        this.portals.forEach(p => {
            p.body.enable = false;
            if (p._debugRect) { p._debugRect.destroy(); p._debugRect = null; }
        });
        this.applyDebugVisuals(false);
    }

    enter() {
        if (this.background) this.background.setVisible(true);
        this.portals.forEach(p => p.body.enable = true);
        this.applyDebugVisuals(this.scene.physics.world.drawDebug);
        if (this.backgroundMusic) {
            if (!this.music) {
                this.music = this.scene.sound.add(this.backgroundMusic, { loop: true, volume: 0.5 });
            }
            if (this.music && !this.music.isPlaying) this.music.play();
        }
    }

    exit() {
        if (this.music) this.music.stop();
        this.hideAll();
    }

    // NEW: call whenever debug toggles
    syncDebugVisuals() {
        this.applyDebugVisuals(this.scene.physics.world.drawDebug);
    }

    // Internal: tint / show only when debug active
    applyDebugVisuals(debugOn) {
        // Walls: blue when debug, invisible otherwise
        this.walls.forEach(w => {
            w.fillColor = 0x1e6aff;
            w.fillAlpha = debugOn ? 0.35 : 0; // semi-transparent blue
        });

        // Portals: add/remove green overlay rect
        this.portals.forEach(p => {
            if (debugOn) {
                if (!p._debugRect) {
                    const r = this.scene.add.rectangle(p.x, p.y, 32, 32, 0x00c46b, 0.40); // green
                    r.setDepth(-0.5);
                    p._debugRect = r;
                }
            } else if (p._debugRect) {
                p._debugRect.destroy();
                p._debugRect = null;
            }
        });
    }

    getWalls() { return this.walls; }
    getWallGroup() { return this.wallGroup; }
    getPortals() { return this.portals; }
    getSpawnPoint() { return this.spawnPoint; }

    // NEW: resolve spawn based on previous room name
    getSpawnPointFor(fromRoomName) {
        const key = (fromRoomName && this.arrivalMap[fromRoomName]) || this.defaultSpawnKey;
        let sp = this.spawnPoints[key];
        if (!sp) {
            // Fallback to first defined spawn point
            const firstKey = Object.keys(this.spawnPoints)[0];
            sp = this.spawnPoints[firstKey];
        }
        if (!sp) return null;
        console.log('[SpawnDebug] resolve', {
            room: this.name,
            fromRoom: fromRoomName,
            key,
            pos: sp
        });
        return sp;
    }
}