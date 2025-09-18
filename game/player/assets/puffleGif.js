import { createAnimationFromGif } from './gifAnim.js';

export async function registerPuffleFromGifs(scene) {
  const parts = {
    front:        { bin: 'puf_front_gif',          anim: 'puf-front',        prefix: 'puf_front_' },
    threeQuarter: { bin: 'puf_three_quarter_gif',  anim: 'puf-threeQuarter', prefix: 'puf_threeQ_' },
    side:         { bin: 'puf_side_gif',           anim: 'puf-side',         prefix: 'puf_side_' },
    backLeft:     { bin: 'puf_back_left_gif',      anim: 'puf-backLeft',     prefix: 'puf_backL_' },
    back:         { bin: 'puf_back_gif',           anim: 'puf-back',         prefix: 'puf_back_' }
  };

  for (const v of Object.values(parts)) {
    if (!scene.cache.binary.get(v.bin)) throw new Error(`Missing GIF: ${v.bin}`);
  }

  const loaded = {};
  for (const [k, v] of Object.entries(parts)) {
    loaded[k] = await createAnimationFromGif(scene, v.bin, { animKey: v.anim, textureKeyPrefix: v.prefix });
  }

  scene.registry.set('pufAnims', {
    front: 'puf-front',
    side: 'puf-side',
    back: 'puf-back',
    backLeft: 'puf-backLeft',
    threeQuarter: 'puf-threeQuarter'
  });
  scene.registry.set('pufBaseFacesRight', false);
  scene.registry.set('pufFirstFrame', loaded.front.textureKeys[0]);
  scene.registry.set('pufReady', true);

  // Speed multiplier for all puffle animations (tune 1.2–2.5)
  scene.registry.set('pufAnimTimeScale', 10.0);
}