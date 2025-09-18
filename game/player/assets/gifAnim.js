export async function createAnimationFromGif(scene, binaryKey, {
  animKey,
  textureKeyPrefix
}) {
  const buf = scene.cache.binary.get(binaryKey);
  if (!buf) throw new Error(`GIF binary not found: ${binaryKey}`);

  const { parseGIF, decompressFrames } = await resolveGifuct();

  const gif = parseGIF(buf);
  const frames = decompressFrames(gif, true);
  if (!frames?.length) {
    console.warn('[GIF] no frames for', binaryKey);
    return { textureKeys: [], animKey, width: 0, height: 0 };
  }
  console.log('[GIF] decoded', binaryKey, 'frames:', frames.length);

  const textureKeys = [];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const c = document.createElement('canvas');
    c.width = f.dims.width;
    c.height = f.dims.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const img = ctx.createImageData(f.dims.width, f.dims.height);
    img.data.set(f.patch);
    ctx.putImageData(img, 0, 0);

    const texKey = `${textureKeyPrefix}${i}`;
    if (scene.textures.exists(texKey)) scene.textures.remove(texKey);
    scene.textures.addImage(texKey, c);
    textureKeys.push(texKey);
  }

  const animFrames = frames.map((f, i) => ({
    key: textureKeys[i],
    duration: Math.max(30, (f.delay || 8) * 10)
  }));

  if (scene.anims.exists(animKey)) scene.anims.remove(animKey);
  scene.anims.create({ key: animKey, frames: animFrames, repeat: -1 });

  return { textureKeys, animKey, width: frames[0]?.dims.width, height: frames[0]?.dims.height };
}

async function resolveGifuct() {
  const g = window;
  // UMD (window.gifuct.parseGIF / decompressFrames)
  if (g.gifuct?.parseGIF && g.gifuct?.decompressFrames) return g.gifuct;
  // Functions exported directly to window (rare)
  if (g.parseGIF && g.decompressFrames) return { parseGIF: g.parseGIF, decompressFrames: g.decompressFrames };
  // UMD default export wrapper
  if (g.gifuct?.default?.parseGIF && g.gifuct?.default?.decompressFrames) return g.gifuct.default;
  // Fallback to ESM dynamic import
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/gifuct-js@2.1.2/+esm');
    return mod;
  } catch (e) {
    throw new Error('gifuct-js not available. Include the CDN <script> before Phaser or allow ESM import.');
  }
}