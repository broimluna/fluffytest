const BUBBLE_COLOR = 0xeaeaea;
const BUBBLE_ALPHA = 0.8;
const BUBBLE_DEDUP_WINDOW = 1000; // ms

// NEW: bubble border config
const BUBBLE_BORDER_COLOR = 0xf2f2f2;
const BUBBLE_BORDER_ALPHA = 1;
const BUBBLE_BORDER_THICKNESS = 1;

// Stylized pill toolbar (Club-Penguin–like) with a dark inner chat slot (no extra buttons).
export class ChatUI {
    constructor(scene, {
        width = scene.scale.width - 32,   // total pill width
        height = 44,                      // total pill height
        marginX = 16,                     // left/right screen margin
        bottomPadding = 6,                // distance from bottom of screen
        slotHorizontalPadding = 90,       // space left/right before input slot begins (adjust to taste)
        slotRadius = 12,
        onSend = null,                    // <-- NEW callback injection
        worldScene = null                 // <-- NEW: reference to WorldScene
    } = {}) {
        this.scene = scene;               // UIOverlayScene
        this.world = worldScene || scene.scene.get('WorldScene'); // <-- store WorldScene
        this.onSend = onSend;             // <-- store callback

        // Layout
        this.width = width;
        this.height = height;
        this.marginX = marginX;
        this.bottomPadding = bottomPadding;
        this.slotPad = slotHorizontalPadding;
        this.slotRadius = slotRadius;

        // Chat state
        this.currentInput = '';
        this.maxInputLen = 180;
        this.caretVisible = true;
        this._lastCaretSwap = 0;
        this.caretInterval = 450;
        this.isFocused = false;           // NEW: focus state
        this.placeholder = 'Press Enter to chat';

        // Bubbles
        this.bubbles = [];
        this._recentMessages = new Map(); // key: playerId|message -> timestamp

        // Derived placement
        const h = this.scene.scale.height;
        this.x = this.marginX;
        this.y = h - this.height - this.bottomPadding;

        // Input slot geometry (dark area)
        this.slotX = this.x + this.slotPad;
        this.slotW = this.width - this.slotPad * 2;
        this.slotY = this.y + (this.height - 28) / 2; // vertical centering, slot height 28
        this.slotH = 28;

        this._createGraphics();
        this._createText();
        this._createPointerBlock();

        this._bindKeys();

        // For pointer hit test
        this._bounds = { x: this.x, y: this.y, w: this.width, h: this.height };

        // Optional resize handling
        this.scene.scale.on('resize', (gameSize) => this._relayout(gameSize));
    }

    _relayout(gameSize) {
        const { width, height } = gameSize;
        this.width = width - this.marginX * 2;
        this.x = this.marginX;
        this.y = height - this.height - this.bottomPadding;
        this.slotX = this.x + this.slotPad;
        this.slotW = this.width - this.slotPad * 2;
        this.slotY = this.y + (this.height - this.slotH) / 2;

        this._redraw();
        this._positionText();
        this.blockZone.setPosition(this.x + this.width / 2, this.y + this.height / 2);
        this.blockZone.setSize(this.width, this.height);
        this._bounds = { x: this.x, y: this.y, w: this.width, h: this.height };
    }

    _createGraphics() {
        this.g = this.scene.add.graphics().setDepth(1500).setScrollFactor(0);
        this._redraw();
    }

    _redraw() {
        const g = this.g;
        g.clear();

        // Colors
        const outer = 0x0199ff;   // bright edge
        const mid   = 0x007bcf;   // body
        const slotBg = 0x022a49;  // inner dark slot
        const slotOutline = 0x0199ff;

        const r = this.height / 2;

        // Outer pill (edge / border)
        g.fillStyle(outer, 1);
        this._roundRect(g, this.x, this.y, this.width, this.height, r);

        // Inner pill (body)
        g.fillStyle(mid, 1);
        this._roundRect(g, this.x + 2, this.y + 2, this.width - 4, this.height - 4, r - 2);

        // Input slot
        g.lineStyle(2, slotOutline, 1);
        g.fillStyle(slotBg, 1);
        this._roundRect(g, this.slotX, this.slotY, this.slotW, this.slotH, this.slotRadius);
    }

    _roundRect(g, x, y, w, h, r) {
        const rr = Math.min(r, h / 2, w / 2);
        g.beginPath();
        g.moveTo(x + rr, y);
        g.lineTo(x + w - rr, y);
        g.arc(x + w - rr, y + rr, rr, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(0));
        g.lineTo(x + w, y + h - rr);
        g.arc(x + w - rr, y + h - rr, rr, Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(90));
        g.lineTo(x + rr, y + h);
        g.arc(x + rr, y + h - rr, rr, Phaser.Math.DegToRad(90), Phaser.Math.DegToRad(180));
        g.lineTo(x, y + rr);
        g.arc(x + rr, y + rr, rr, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(270));
        g.closePath();
        g.fillPath();
        if (g.defaultStrokeWidth > 0) g.strokePath();
    }

    _createText() {
        // Removed the 'Chat' label. Shift input further left.
        this.inputText = this.scene.add.text(
            this.slotX + 14,                      // was + 60
            this.slotY + (this.slotH - 14) / 2 - 1,
            '',
            {
                fontFamily: 'monospace',
                fontSize: '14px',
                color: '#ffffff'
            }
        ).setDepth(1502).setScrollFactor(0);

        this._refreshInputText();
    }

    _positionText() {
        // Adjust only input text (prompt removed)
        this.inputText.setPosition(this.slotX + 14, this.slotY + (this.slotH - 14) / 2 - 1);
    }

    _createPointerBlock() {
        this.blockZone = this.scene.add.zone(
            this.x + this.width / 2,
            this.y + this.height / 2,
            this.width,
            this.height
        ).setOrigin(0.5).setScrollFactor(0).setInteractive().setDepth(1503);
        this.blockZone.on('pointerdown', () => {
            if (!this.isFocused) this._focus();
        });
    }

    _bindKeys() {
        this.scene.input.keyboard.on('keydown', (e) => {
            if (e.repeat) return;
            const key = e.key;

            // Not focused: only Enter focuses (do NOT eat other keys)
            if (!this.isFocused) {
                if (key === 'Enter') {
                    this._focus();
                    e.stopPropagation();
                }
                return;
            }

            // Focused:
            if (key === 'Enter') {
                this._commitMessage();
                e.stopPropagation();
                return;
            }
            if (key === 'Escape') {
                this.currentInput = '';
                this._blur();
                e.stopPropagation();
                return;
            }
            if (key === 'Backspace') {
                if (this.currentInput.length > 0) {
                    this.currentInput = this.currentInput.slice(0, -1);
                    this._refreshInputText();
                }
                e.stopPropagation();
                return;
            }
            if (key.length === 1) {
                if (this.currentInput.length < this.maxInputLen) {
                    this.currentInput += key;
                    this._refreshInputText();
                }
                e.stopPropagation();
            }
        });
    }

    _focus() {
        this.isFocused = true;
        this.caretVisible = true;
        this._lastCaretSwap = 0;
        this._refreshInputText();
    }

    _blur() {
        this.isFocused = false;
        this._refreshInputText();
    }

    _commitMessage() {
        const msg = this.currentInput.trim();
        if (msg) {
            this.appendLocal(msg);
            if (this.onSend) this.onSend(msg); // <-- delegate sending
        }
        this.currentInput = '';
        this._blur();
    }

    _refreshInputText() {
        if (!this.isFocused && !this.currentInput) {
            this.inputText.setAlpha(0.55);
            this.inputText.setText(this.placeholder);
            return;
        }
        this.inputText.setAlpha(1);
        const caret = (this.isFocused && this.caretVisible) ? '|' : ' ';
        this.inputText.setText(this.currentInput + caret);
    }

    appendLocal(text) {
        // use world scene player id
        const pid = this.world?.roomConnector?.getPlayerId?.();
        this._createBubble(pid, text);
    }

    appendRemote(playerId, text) {
        this._createBubble(playerId, text);
    }

    _createBubble(playerId, message) {
        if (!message || !playerId) return;
        let txt = message;
        if (txt.length > 60) txt = txt.slice(0, 60) + '…';

        const sprite = this._resolveSpriteForPlayer(playerId);
        if (!sprite) return;

        // De-dup
        const now = this.scene.time.now;
        const key = playerId + '|' + txt;
        const prev = this._recentMessages.get(key);
        if (prev && (now - prev) < BUBBLE_DEDUP_WINDOW) return;
        this._recentMessages.set(key, now);

        const padX = 6;
        const padY = 4;

        // IMPORTANT: treat bubble objects as screen-space (scrollFactor 0) in overlay scene
        const textObj = this.scene.add.text(0, 0, txt, {
            fontFamily: 'monospace',
            fontSize: '12px',
            fontStyle: 'normal',
            color: '#000000',
            padding: { x: 0, y: 0 }
        }).setOrigin(0.5, 1).setDepth(2001).setScrollFactor(0);

        const bg = this.scene.add.graphics()
            .setDepth(2000)
            .setBlendMode(Phaser.BlendModes.NORMAL)
            .setScrollFactor(0);

        const expire = now + 4000;
        const bubble = { sprite, textObj, bg, expire, padX, padY, color: BUBBLE_COLOR, alpha: BUBBLE_ALPHA, key };
        this._layoutBubble(bubble);
        this.bubbles.push(bubble);
    }

    _resolveSpriteForPlayer(playerId) {
        if (!this.world) return null;
        const selfId = this.world.roomConnector?.getPlayerId?.();
        if (playerId === selfId) {
            return this.world.mainPlayerManager?.player;
        }
        const entry = this.world.onlinePlayerManager?.otherPlayers?.get?.(playerId);
        return entry?.sprite || null;
    }

    _layoutBubble(b) {
        const sprite = b.sprite;
        if (!sprite || !b.textObj) return;

        const cam = this.world?.cameras?.main;
        let screenX = cam ? (sprite.x - cam.scrollX) : sprite.x;
        let screenY = cam ? (sprite.y - cam.scrollY) : sprite.y;

        // Round to whole pixels to remove tween sub‑pixel vertical jitter
        screenX = Math.round(screenX);
        screenY = Math.round(screenY);

        const R = sprite.getData('baseRadius') || 24;
        const gap = 6;
        const bubbleBottomY = screenY - R - gap;

        b.textObj.x = screenX;
        b.textObj.y = bubbleBottomY;

        const w = b.textObj.displayWidth + b.padX * 2;
        const h = b.textObj.displayHeight + b.padY * 2;
        const left = screenX - w / 2;
        const top = bubbleBottomY - b.textObj.displayHeight - b.padY;

        b.bg.clear();
        this._drawRoundedRectWithBorder(
            b.bg,
            left,
            top,
            w,
            h,
            8,
            b.color,
            b.alpha,
            BUBBLE_BORDER_COLOR,
            BUBBLE_BORDER_ALPHA,
            BUBBLE_BORDER_THICKNESS
        );

        const tailW = 10;
        const tailH = 6;
        b.bg.fillStyle(b.color, b.alpha);
        b.bg.lineStyle(BUBBLE_BORDER_THICKNESS, BUBBLE_BORDER_COLOR, BUBBLE_BORDER_ALPHA);
        b.bg.beginPath();
        b.bg.moveTo(screenX - tailW / 2, bubbleBottomY - 2);
        b.bg.lineTo(screenX + tailW / 2, bubbleBottomY - 2);
        b.bg.lineTo(screenX, bubbleBottomY + tailH);
        b.bg.closePath();
        b.bg.fillPath();
        b.bg.strokePath();
    }

    // NEW helper for bubble (does not affect toolbar drawing)
    _drawRoundedRectWithBorder(g, x, y, w, h, r, fillColor, fillAlpha, borderColor, borderAlpha, borderWidth) {
        const rr = Math.min(r, w / 2, h / 2);
        g.fillStyle(fillColor, fillAlpha);
        g.lineStyle(borderWidth, borderColor, borderAlpha);
        g.beginPath();
        g.moveTo(x + rr, y);
        g.lineTo(x + w - rr, y);
        g.arc(x + w - rr, y + rr, rr, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(0));
        g.lineTo(x + w, y + h - rr);
        g.arc(x + w - rr, y + h - rr, rr, Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(90));
        g.lineTo(x + rr, y + h);
        g.arc(x + rr, y + h - rr, rr, Phaser.Math.DegToRad(90), Phaser.Math.DegToRad(180));
        g.lineTo(x, y + rr);
        g.arc(x + rr, y + rr, rr, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(270));
        g.closePath();
        g.fillPath();
        g.strokePath();
    }

    update(time) {
        if (this.isFocused && (time - this._lastCaretSwap >= this.caretInterval)) {
            this.caretVisible = !this.caretVisible;
            this._lastCaretSwap = time;
            this._refreshInputText();
        }

        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const b = this.bubbles[i];
            if (!b.sprite?.active) {
                b.textObj.destroy();
                b.bg.destroy();
                this.bubbles.splice(i, 1);
                continue;
            }
            this._layoutBubble(b); // <- keep bubble above moving player
            if (time >= b.expire) {
                b.textObj.destroy();
                b.bg.destroy();
                this.bubbles.splice(i, 1);
            }
        }

        // purge stale dedup keys
        for (const [k, t] of this._recentMessages) {
            if (time - t > BUBBLE_DEDUP_WINDOW) this._recentMessages.delete(k);
        }
    }

    isPointerInChatArea(pointer) {
        return (
            pointer.x >= this._bounds.x &&
            pointer.x <= this._bounds.x + this._bounds.w &&
            pointer.y >= this._bounds.y &&
            pointer.y <= this._bounds.y + this._bounds.h
        );
    }
}

