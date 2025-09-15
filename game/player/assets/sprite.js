// player/assets/sprite.js
export function createPlayerTexture(scene) {
    const DIAMETER = 48;
    const R = DIAMETER / 2;
    const BASE_KEY = 'playerBase';

    // Remove old if exists
    if (scene.textures.exists(BASE_KEY)) scene.textures.remove(BASE_KEY);
    if (scene.textures.exists('player')) scene.textures.remove('player');

    // Canvas texture for gradient + shading
    const tex = scene.textures.createCanvas(BASE_KEY, DIAMETER, DIAMETER);
    const ctx = tex.context;

    // Radial gradient (light from top‑left)
    const grad = ctx.createRadialGradient(R - 8, R - 8, 4, R, R, R);
    grad.addColorStop(0, '#7fd3ff');   // bright highlight
    grad.addColorStop(0.35, '#1e8dd6');
    grad.addColorStop(0.65, '#0a5ea5');
    grad.addColorStop(1, '#04345c');   // darkest rim
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(R, R, R - 1, 0, Math.PI * 2);
    ctx.fill();

    // Subtle rim light (thin outer stroke)
    ctx.strokeStyle = 'rgba(180,230,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(R, R, R - 1.5, 0, Math.PI * 2);
    ctx.stroke();

    // Bottom inner ambient occlusion ring
    const aoGrad = ctx.createRadialGradient(R, R + 6, R * 0.1, R, R + 6, R * 0.9);
    aoGrad.addColorStop(0, 'rgba(0,0,0,0)');
    aoGrad.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = aoGrad;
    ctx.beginPath();
    ctx.arc(R, R, R - 4, 0, Math.PI * 2);
    ctx.fill();

    // Specular highlight (small glossy spot)
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(R - 10, R - 11, 7, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Soft reflection streak
    const streak = ctx.createLinearGradient(R - 14, R - 20, R, R + 4);
    streak.addColorStop(0, 'rgba(255,255,255,0.55)');
    streak.addColorStop(0.5, 'rgba(255,255,255,0.10)');
    streak.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = streak;
    ctx.beginPath();
    ctx.ellipse(R - 6, R - 2, 10, 18, -0.25, 0, Math.PI * 2);
    ctx.fill();

    // Refresh canvas texture so Phaser uploads it
    tex.refresh();

    // Optional drop shadow (separate texture if you want)
    if (!scene.textures.exists('playerShadow')) {
        const shadow = scene.make.graphics({ x: 0, y: 0, add: false });
        shadow.fillStyle(0x000000, 0.25);
        shadow.fillEllipse(R, R, DIAMETER * 0.9, DIAMETER * 0.35);
        shadow.generateTexture('playerShadow', DIAMETER, DIAMETER);
        shadow.destroy();
    }

    // Composite final player texture (base + eyes) into 'player'
    const rt = scene.make.renderTexture({ width: DIAMETER, height: DIAMETER, add: false });
    rt.draw(BASE_KEY, 0, 0);

    // Ensure eyes texture exists before calling this (load or generate separately)
    if (scene.textures.exists('eyes')) {
        rt.draw('eyes', 14, 12, DIAMETER * 0.42, DIAMETER * 0.42);
    }

    rt.saveTexture('player');
    rt.destroy();
}
