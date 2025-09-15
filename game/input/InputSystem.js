export class Controls {
    constructor(scene) {
        this.scene = scene;
        this.cursors = null;
        this.wasd = null;
        this.setupControls();
    }

    setupControls() {
        // Input controls
        this.cursors = this.scene.input.keyboard.createCursorKeys();
        //this.wasd = this.scene.input.keyboard.addKeys('W,S,A,D');

        // Click control is fine, but could also be an event
        this.scene.input.on('pointerdown', (pointer) => {
            // Emit an internal event instead of directly controlling the player
            this.scene.events.emit('player-move-to-target', { x: pointer.x, y: pointer.y });
        });
    }

    update() {
        // Don't check for player here. This class only cares about input state.
        const inputState = {
            left: this.cursors.left.isDown,
            right: this.cursors.right.isDown,
            up: this.cursors.up.isDown,
            down: this.cursors.down.isDown,
        };

        // Emit a single event with the current input state for other systems to use.
        this.scene.events.emit('player-input', inputState);
    }
}