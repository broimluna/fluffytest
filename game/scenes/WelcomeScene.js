import { ensureServerConnector, getServerSocket } from '../networking/serverConnector.js';

export class WelcomeScene extends Phaser.Scene {
    constructor() {
        super('WelcomeScene');
        this.mode = 'login';
    }

    create() {
        this.cameras.main.setBackgroundColor(0x0c4064);
        this._worldStarted = false;
        this._buildPhaserUI();
        this._initKeyboard();
        this._ensureSocketListener(); // <-- set early so we never miss gameState
        console.log('[WelcomeScene] children =', this.children.list.length);
    }

    _buildPhaserUI() {
        const centerX = 400;
        const centerY = 300;
        const panelW = 520;
        const panelH = 420;

        const DEPTH = { PANEL:1, UI:10, CARET:15, TOP:20 };

        const orphan = document.querySelector('#game-container > div[data-old-welcome]');
        if (orphan) orphan.remove();

        // NEW: rounded 8px panel
        const panelRadius = 8;
        const panelG = this.add.graphics({ x: centerX - panelW/2, y: centerY - panelH/2 }).setDepth(DEPTH.PANEL);
        const redrawPanel = () => {
            panelG.clear();
            panelG.fillStyle(0x006fae, 1);
            panelG.lineStyle(3, 0xffffff, 1);
            panelG.beginPath();
            panelG.fillRoundedRect(0, 0, panelW, panelH, panelRadius);
            panelG.strokeRoundedRect(0, 0, panelW, panelH, panelRadius);
        };
        redrawPanel();
        this.panel = panelG;

        this.title = this.add.text(centerX, centerY - panelH/2 + 60, 'Experimental Fluffs', {
            fontFamily:'Arial', fontSize:'40px', color:'#ffffff', stroke:'#002a44', strokeThickness:4
        }).setOrigin(0.5).setDepth(DEPTH.UI);

        this.loginTab = this._makeTab(centerX - 70, this.title.y + 50, 'Login', () => this._switchMode('login'), DEPTH.UI);
        this.registerTab = this._makeTab(centerX + 70, this.title.y + 50, 'Register', () => this._switchMode('register'), DEPTH.UI);

        // Added vertical spacing (was +50) so inputs don’t touch tabs
        let topY = this.loginTab.rect.y + 70;

        this.usernameField  = this._makeInputField(centerX, topY,        300, 'Username (3-20)', 20, false, DEPTH);
        this.passwordField  = this._makeInputField(centerX, topY + 60,   300, 'Password',        64, true,  DEPTH);
        this.password2Field = this._makeInputField(centerX, topY + 120,  300, 'Confirm Password',64, true,  DEPTH);
        this.password2Field.container.setVisible(false);
        this.password2Field.textObj.setVisible(false);
        this.password2Field.caret.setVisible(false);

        this.msg = this.add.text(centerX, this.password2Field.centerY + 60, '', {
            fontFamily:'Arial', fontSize:'14px', color:'#ffe28a'
        }).setOrigin(0.5).setDepth(DEPTH.UI);

        this.submitBtn = this._makeButton(centerX, this.msg.y + 38, 160, 40, 'Login', () => this._submit(), 0xffcc00, DEPTH.UI);

        this.focusField = null;
        [this.usernameField, this.passwordField, this.password2Field].forEach(f => {
            f.focused = false;
            f.caret.setVisible(false);
            this._redrawField(f);
            f.redraw(); // ensure correct border state
        });

        this._applyTabVisuals();
        this.input.setTopOnly(false);
    }

    _makeTab(x, y, label, cb, depth) {
        const w = 120, h = 34, radius = 8;
        const g = this.add.graphics({ x: x - w/2, y: y - h/2 }).setDepth(depth);

        const redraw = (color, alpha=1) => {
            g.clear();
            g.fillStyle(color, alpha);
            g.lineStyle(2, 0xffffff, 1);
            g.beginPath();
            g.fillRoundedRect(0, 0, w, h, radius);
            g.strokeRoundedRect(0, 0, w, h, radius);
        };
        // initial style (inactive)
        redraw(0x004d79, 0.9);

        // Make interactive area (rectangle hit area)
        g.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains)
         .on('pointerup', cb)
         .on('pointerover', () => { /* subtle hover only if not active (color swap handled elsewhere) */ });

        const t = this.add.text(x, y, label, {
            fontFamily: 'Arial',
            fontSize: '16px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(depth + 1);

        // Provide a compatible API for _applyTabVisuals (expects setFillStyle)
        g.setFillStyle = (color, alpha=1) => { redraw(color, alpha); return g; };

        return { rect: g, text: t };
    }

    _makeInputField(x, y, w, placeholder, maxLen, password, DEPTH) {
        // Reworked: rounded 8px inputs using Graphics; added internal padding
        const h = 38;
        const radius = 8;
        const g = this.add.graphics({ x: x - w/2, y: y - h/2 }).setDepth(DEPTH.UI);

        const redrawBox = (focused) => {
            g.clear();
            g.fillStyle(0xffffff, 1);
            g.lineStyle(2, focused ? 0x1185c3 : 0x0d3550, 1);
            g.beginPath();
            g.fillRoundedRect(0, 0, w, h, radius);
            g.strokeRoundedRect(0, 0, w, h, radius);
        };
        redrawBox(false);

        g.setInteractive(new Phaser.Geom.Rectangle(0,0,w,h), Phaser.Geom.Rectangle.Contains)
         .on('pointerup', () => this._focusField(field));

        const textLeftPad = 16;
        const text = this.add.text(x - w/2 + textLeftPad, y, placeholder, {
            fontFamily:'Arial', fontSize:'16px', color:'#5c6b78'
        }).setOrigin(0,0.5).setDepth(DEPTH.UI + 1);

        const caret = this.add.rectangle(x - w/2 + textLeftPad, y, 2, 20, 0x004c75, 1)
            .setOrigin(0,0.5).setVisible(false).setDepth(DEPTH.CARET);

        const field = {
            container: g,
            centerY: y,
            textObj: text,
            caret,
            placeholder,
            value: '',
            maxLen,
            password,
            focused: false,
            width: w,
            height: h,
            baseX: x - w/2 + textLeftPad,
            redraw: () => redrawBox(field.focused)
        };
        return field;
    }

    _makeButton(x, y, w, h, label, cb, color, depth) {
        const radius = 8;
        const g = this.add.graphics({ x: x - w/2, y: y - h/2 }).setDepth(depth);

        const redraw = (fillColor, alpha=1) => {
            g.clear();
            g.fillStyle(fillColor, alpha);
            g.lineStyle(2, 0x003652, 1);
            g.beginPath();
            g.fillRoundedRect(0, 0, w, h, radius);
            g.strokeRoundedRect(0, 0, w, h, radius);
        };
        redraw(color, 1);

        g.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains)
         .on('pointerover', () => redraw(color, 0.85))
         .on('pointerout', () => redraw(color, 1))
         .on('pointerup', cb);

        const text = this.add.text(x, y, label, {
            fontFamily: 'Arial',
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#004c75'
        }).setOrigin(0.5).setDepth(depth + 1);

        // Compatibility for existing code (if any future style changes call setFillStyle)
        g.setFillStyle = (c, a=1) => { redraw(c, a); return g; };

        return { rect: g, text };
    }

    _applyTabVisuals() {
        const activeStyle = (tab) => {
            tab.rect.setFillStyle(0xffffff, 1);
            tab.text.setColor('#004c75');
        };
        const inactiveStyle = (tab) => {
            tab.rect.setFillStyle(0x004d79, 0.9);
            tab.text.setColor('#ffffff');
        };
        if (this.mode === 'login') {
            activeStyle(this.loginTab);
            inactiveStyle(this.registerTab);
            this.password2Field.container.setVisible(false);
            this.password2Field.textObj.setVisible(false);
            this.password2Field.caret.setVisible(false);
            this.submitBtn.text.setText('Login');
        } else {
            inactiveStyle(this.loginTab);
            activeStyle(this.registerTab);
            this.password2Field.container.setVisible(true);
            this.password2Field.textObj.setVisible(true);
            this.submitBtn.text.setText('Register');
        }
    }

    _switchMode(m) {
        if (this.mode === m) return;
        this.mode = m;
        this._info('');
        this._applyTabVisuals();
    }

    _focusField(field) {
        if (this.focusField === field) return;
        if (this.focusField) {
            this.focusField.focused = false;
            this.focusField.caret.setVisible(false);
            this._redrawField(this.focusField);
            this.focusField.redraw();
        }
        this.focusField = field;
        field.focused = true;
        field.caret.setVisible(true);
        this._redrawField(field);
        field.redraw();
        this._positionCaret();
    }

    _redrawField(field) {
        // Placeholder only when not focused and empty
        const showPlaceholder = !field.value && !field.focused;
        let display = '';
        if (showPlaceholder) {
            display = field.placeholder;
            field.textObj.setColor('#5c6b78');
        } else if (field.value) {
            display = field.password ? '•'.repeat(field.value.length) : field.value;
            field.textObj.setColor('#002e48');
        } else {
            // focused & empty -> no placeholder text
            field.textObj.setColor('#002e48');
        }
        field.textObj.setText(display);
    }

    _positionCaret() {
        const f = this.focusField;
        if (!f) return;
        const afterText = f.value ? f.textObj.width : 0;
        f.caret.x = f.baseX + afterText + 2;
        f.caret.y = f.centerY;
    }

    _initKeyboard() {
        this.input.keyboard.on('keydown', (e) => {
            if (!this.focusField) return;
            if (e.key === 'Backspace') {
                if (this.focusField.value.length > 0) {
                    this.focusField.value = this.focusField.value.slice(0, -1);
                    this._redrawField(this.focusField);
                    this._positionCaret();
                }
                e.preventDefault();
            } else if (e.key === 'Enter') {
                if (this.focusField === this.usernameField) this._focusField(this.passwordField);
                else this._submit();
                e.preventDefault();
            } else if (e.key === 'Tab') {
                if (this.focusField === this.usernameField) this._focusField(this.passwordField);
                else if (this.focusField === this.passwordField && this.mode === 'register') this._focusField(this.password2Field);
                else this._focusField(this.usernameField);
                e.preventDefault();
            } else if (e.key.length === 1) {
                if (this.focusField.value.length < this.focusField.maxLen) {
                    this.focusField.value += e.key;
                    this._redrawField(this.focusField);
                    this._positionCaret();
                }
                e.preventDefault();
            }
        });

        this.time.addEvent({
            delay: 450,
            loop: true,
            callback: () => {
                if (this.focusField && this.focusField.caret.visible) {
                    this.focusField.caret.alpha = this.focusField.caret.alpha === 1 ? 0 : 1;
                }
            }
        });
    }

    _submit() {
        const u = this.usernameField.value.trim();
        const p1 = this.passwordField.value;
        const p2 = this.password2Field.value;
        if (!/^[A-Za-z0-9_]{3,20}$/.test(u)) return this._error('Bad username');
        if (p1.length < 4 || p1.length > 64) return this._error('Bad password');
        if (this.mode === 'register') {
            if (p1 !== p2) return this._error('Mismatch');
            this._apiRegister(u, p1);
        } else {
            this._apiLogin(u, p1);
        }
    }

    _error(t) { this.msg.setText(t).setColor('#ff7d7d'); }
    _info(t) { this.msg.setText(t).setColor('#ffe28a'); }

    async _apiRegister(username, password) {
        this._info('Registering...');
        try {
            const res = await fetch('https://testing12-2t2h.onrender.com/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const j = await res.json();
            if (!j.ok) return this._error(j.reason || 'Register failed');
            this._info('Registered. Logging in...');
            this._apiLogin(username, password);
        } catch {
            this._error('Network error');
        }
    }

    async _apiLogin(username, password) {
        this._info('Connecting...');
        this._ensureSocketListener();
        const socket = getServerSocket();
        if (!socket.connected) {
            return new Promise(r => socket.once('connect', r)).then(() => this._apiLogin(username, password));
        }

        this._armGameStateTimeout();
        socket.emit('login', { username, password }, (res) => {
            if (!res || !res.ok) {
                this._error(res?.reason || 'Login failed');
                return;
            }
            this._info('Loading world...');
        });
    }

    _guestFlow() {
        this._info('Guest...');
        this._ensureSocketListener();
        const socket = getServerSocket();
        if (!socket.connected) socket.once('connect', () => this._emitGuest(socket));
        else this._emitGuest(socket);
    }

    _emitGuest(socket) {
        this._armGameStateTimeout();
        socket.emit('guest', (res) => {
            if (!res || !res.ok) {
                this._error(res?.reason || 'Guest failed');
                return;
            }
            this._info('Loading world...');
        });
    }

    _armGameStateTimeout() {
        if (this._gsTimer) this._gsTimer.remove(false);
        this._gsTimer = this.time.delayedCall(5000, () => {
            if (!this._worldStarted) this._error('Server timeout (no gameState).');
        });
    }

    _ensureSocketListener() {
        // create / reuse singleton socket
        const socket = ensureServerConnector();
        this.socket = socket;
        if (this._socketBound) return;
        this._socketBound = true;

        socket.on('gameState', (gs) => {
            if (this._worldStarted) return;
            this._worldStarted = true;
            this._lastGameState = gs; // <--- store to pass to WorldScene
            this._info('Starting...');
            this.time.delayedCall(40, () => {
                this.scene.start('WorldScene', {
                    playerName: gs?.players?.find(p => p.id === gs.playerId)?.name || 'Player',
                    initialGameState: gs                // <--- pass along
                });
                this.scene.launch('UIOverlayScene');
            });
        });
    }

}
