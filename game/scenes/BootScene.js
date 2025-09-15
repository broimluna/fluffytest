
export class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }

    create() {
        // Global debug-aware log shim (once)
        if (!window.__LOG_SHIM__) {
            window.__LOG_SHIM__ = true;
            const orig = { log: console.log, info: console.info, warn: console.warn, error: console.error };
            const debugEnabled = () =>
                window.__FORCE_LOG ||
                this.game.config.physics?.arcade?.debug ||
                Object.values(this.game.scene.keys).some(s => s.physics?.world?.drawDebug);
            const wrap = fn => (...a) => { if (debugEnabled()) fn.apply(console, a); };
            console.log = wrap(orig.log);
            console.info = wrap(orig.info);
            console.warn = wrap(orig.warn);
            window.enableLogs = (on) => { window.__FORCE_LOG = !!on; };
        }

        this.scene.start('PreloadScene');
    }
}