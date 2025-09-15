export class WelcomeScene extends Phaser.Scene {
    constructor() { super('WelcomeScene'); }

    create() {
        this.cameras.main.setBackgroundColor('#0273b8');
        this._buildDOM();
    }

    _buildDOM() {
        this.root = document.createElement('div');
        Object.assign(this.root.style, {
            position: 'absolute', width: '800px', height: '600px',
            left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'flex-start',
            paddingTop: '60px',
            background: 'linear-gradient(180deg,#0088dd,#004c88)',
            fontFamily: 'Arial, sans-serif', zIndex: 9999,
            boxShadow: '0 0 40px rgba(0,0,0,0.45)', borderRadius: '8px'
        });

        const logo = document.createElement('div');
        logo.textContent = 'Experimental Fluffs';
        Object.assign(logo.style, {
            fontSize: '48px', fontWeight: '700', color: '#fff',
            textShadow: '0 4px 12px rgba(0,0,0,0.4)'
        });

        const tagline = document.createElement('div');
        tagline.textContent = 'Enter your username to roll in!';
        Object.assign(tagline.style, {
            marginTop: '10px', fontSize: '16px', color: '#e0f4ff'
        });

        const form = document.createElement('form');
        Object.assign(form.style, { marginTop: '40px', display: 'flex', gap: '12px' });

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Username (3-20 chars)';
        input.maxLength = 20;
        Object.assign(input.style, {
            padding: '10px 14px', fontSize: '16px', borderRadius: '24px',
            border: '2px solid #ffffff', outline: 'none', minWidth: '260px',
            background: '#ffffff', color: '#003e66', fontWeight: '600'
        });

        const btn = document.createElement('button');
        btn.type = 'submit';
        btn.textContent = 'Start';
        Object.assign(btn.style, {
            padding: '10px 26px', fontSize: '16px', borderRadius: '24px',
            border: 'none', background: '#ffcc00', color: '#004c75',
            fontWeight: '700', cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(0,0,0,0.25)'
        });

        const msg = document.createElement('div');
        Object.assign(msg.style, {
            marginTop: '18px', minHeight: '20px',
            fontSize: '14px', color: '#ffe28a', fontWeight: '600'
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = input.value.trim();
            if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) {
                msg.textContent = 'Invalid: use 3-20 letters, numbers, underscore.';
                msg.style.color = '#ff8080';
                return;
            }
            msg.textContent = 'Loading...';
            msg.style.color = '#ffe28a';
            this._fadeOut(() => {
                this.scene.start('WorldScene', { playerName: name });
                this.scene.launch('UIOverlayScene');
            });
        });

        form.appendChild(input);
        form.appendChild(btn);
        this.root.appendChild(logo);
        this.root.appendChild(tagline);
        this.root.appendChild(form);
        this.root.appendChild(msg);
        const container = document.getElementById('game-container');
        container.style.position = 'relative';
        container.appendChild(this.root);
        setTimeout(() => input.focus(), 80);
    }

    _fadeOut(done) {
        if (!this.root) { done(); return; }
        this.root.style.transition = 'opacity 240ms';
        this.root.style.opacity = '0';
        setTimeout(() => { this.root.remove(); done(); }, 260);
    }
}