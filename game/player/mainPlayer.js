export class MainPlayerManager {
    constructor(scene) {
        this.scene = scene;
        this.movementEnabled = true;

        this.player = this.scene.physics.add.sprite(400, 300, 'player');
        this.player.setCollideWorldBounds(true);
        this.player.body.setSize(28, 28);
        this.player.body.setOffset(6, 6);
        this.player.setData('baseRadius', 24); // <-- add stable radius

        this.eyes = this.scene.add.sprite(400, 300, 'eyes').setScale(0.1).setDepth(10);

        this.name = '';
        this.nameText = this.scene.add.text(
            this.player.x,
            this.player.y + this.player.displayHeight / 2 + 4,
            '',
            {
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#000000',
                stroke: '#002744',
                strokeThickness: 0.6
            }
        ).setOrigin(0.5, 0).setDepth(11);

        this._lastX = this.player.x;
        this._lastY = this.player.y;

        // Auto-move state
        this._autoMove = false;
        this._moveTarget = null;
        this.clickMoveSpeed = 280;     // px/s
        this.arrivalRadius = 6;        // arrival threshold
        this._stuckFrames = 0;
        this._prevDist = null;

        // Net throttle
        this._lastNetSend = 0;
        this._netInterval = 60; // ms

        this.rollRadius = 24;          // DIAMETER / 2 (keep in sync with sprite.js)
        this._prevX = this.player.x;
        this._prevY = this.player.y;
        this._maxStepForRoll = 160;    // if teleport bigger than this, don't spin crazy

        this.scene.events.on('player-input', this.handleInput, this);
        this.scene.events.on('player-move-to-target', this.moveToTarget, this);
    }

    playAnim() {}
    updateDirectionalAnim(vx, vy) {
        if (vx < -1) this.player.setFlipX(true);
        else if (vx > 1) this.player.setFlipX(false);
    }

    disableMovement() {
        this.movementEnabled = false;
        this.cancelAutoMove();
        this.player.setVelocity(0, 0);
    }
    enableMovement() { this.movementEnabled = true; }

    cancelAutoMove() {
        this._autoMove = false;
        this._moveTarget = null;
    }

    setName(name) {
        this.name = name || '';
        if (this.nameText) this.nameText.setText(this.name);
    }

    handleInput(inputState) {
        if (!this.movementEnabled) return;

        // Cancel auto-move on manual input
        if (this._autoMove && (inputState.left || inputState.right || inputState.up || inputState.down)) {
            this.cancelAutoMove();
        }
        if (this._autoMove) return;

        const speed = 160;
        let vx = 0, vy = 0;
        if (inputState.left) vx = -speed;
        else if (inputState.right) vx = speed;
        if (inputState.up) vy = -speed;
        else if (inputState.down) vy = speed;

        if (vx && vy) {
            const d = Math.SQRT1_2;
            vx *= d; vy *= d;
        }

        this.player.setVelocity(vx, vy);
        this.updateDirectionalAnim(vx, vy);
    }

    moveToTarget(target) {
        // BLOCK if click originated in chat area
        const p = this.scene?.input?.activePointer;
        if (p && this.scene.ui?.isPointerInChatArea?.(p)) return;

        if (!this.movementEnabled) return;
        this._autoMove = true;
        this._moveTarget = { x: target.x, y: target.y };
        // Stop any current manual velocity first
        this.player.setVelocity(0, 0);
    }

    _autoMoveStep(deltaSec) {
        if (!this._autoMove || !this._moveTarget) return;

        const dx = this._moveTarget.x - this.player.x;
        const dy = this._moveTarget.y - this.player.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        // Arrival check
        if (dist <= this.arrivalRadius) {
            this.player.setVelocity(0, 0);
            this.cancelAutoMove();
            return;
        }

        // Direction + velocity
        const nx = dx / dist;
        const ny = dy / dist;
        const vx = nx * this.clickMoveSpeed;
        const vy = ny * this.clickMoveSpeed;
        this.player.setVelocity(vx, vy);
        this.updateDirectionalAnim(vx, vy);

        // Stuck detection (blocked but distance not decreasing)
        if (this._prevDist !== null) {
            if (dist > this._prevDist - 0.5) {
                // Not progressing meaningfully
                if (this.player.body.blocked.left || this.player.body.blocked.right ||
                    this.player.body.blocked.up || this.player.body.blocked.down) {
                    this._stuckFrames++;
                    if (this._stuckFrames > 10) { // ~10 frames stuck
                        this.player.setVelocity(0, 0);
                        this.cancelAutoMove();
                        return;
                    }
                }
            } else {
                this._stuckFrames = 0;
            }
        }
        this._prevDist = dist;
    }

    _maybeEmitNetMove() {
        const now = performance.now();
        if (now - this._lastNetSend >= this._netInterval) {
            this.scene.events.emit('player-moved', { x: this.player.x, y: this.player.y });
            this._lastNetSend = now;
        }
    }

    update(time, delta) {
        // Eyes sync
        this.eyes.x = this.player.x;
        this.eyes.y = this.player.y;

        // Use fixed radius so name doesn't drift when any scaling/rotation changes bounds
        const R = this.player.getData('baseRadius') || 24;
        this.nameText.x = this.player.x;
        this.nameText.y = this.player.y + R + 4;

        if (!this.movementEnabled) return;

        const deltaSec = delta / 1000;

        // Auto-move steering
        this._autoMoveStep(deltaSec);

        // Networking (manual or auto)
        if (this._autoMove) {
            this._maybeEmitNetMove();
        } else {
            if (this._lastX !== this.player.x || this._lastY !== this.player.y) {
                this._maybeEmitNetMove();
            }
        }

        // Rolling effect based on distance moved
        const dx = this.player.x - this._prevX;
        const dy = this.player.y - this._prevY;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < this._maxStepForRoll) {
            const dr = dist / this.rollRadius; // theta = s / r
            this.player.rotation += dr;
            if (this.eyes) this.eyes.rotation = -this.player.rotation; // keep eyes upright
        } else if (dist >= this._maxStepForRoll) {
            // teleport: reset rotation smoothing (optional)
            // this.player.rotation = 0;
            if (this.eyes) this.eyes.rotation = -this.player.rotation;
        }

        this._prevX = this.player.x;
        this._prevY = this.player.y;

        this._lastX = this.player.x;
        this._lastY = this.player.y;
    }
}