// Renderer + post stack tuned for "looks finished" by default.
// Colour pipeline: linear lighting -> HalfFloat buffers -> bloom -> AgX tone map -> sRGB.
// Never set renderer.toneMapping when using postprocessing; ToneMappingEffect does it.
import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode,
  VignetteEffect, SMAAEffect, NoiseEffect, BlendFunction, ChromaticAberrationEffect,
} from 'postprocessing';

export function createRenderer(canvas, { quality = 'auto' } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas, powerPreference: 'high-performance', antialias: false, stencil: false, depth: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const maxDpr = Math.min(window.devicePixelRatio, quality === 'low' ? 1 : 2);
  let dpr = maxDpr;
  renderer.setPixelRatio(dpr);

  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  const bloom = new BloomEffect({ intensity: 1.1, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, radius: 0.7 });
  const chroma = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0, 0), radialModulation: true, modulationOffset: 0.3 });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
  const vignette = new VignetteEffect({ darkness: 0.55, offset: 0.3 });
  const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
  noise.blendMode.opacity.value = 0.12;
  const smaa = new SMAAEffect();

  let renderPass = null;
  function setScene(scene, camera) {
    composer.removeAllPasses();
    renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    // Order matters: bloom/chroma in linear HDR, tone map, then display-space effects.
    composer.addPass(new EffectPass(camera, bloom, chroma));
    composer.addPass(new EffectPass(camera, tone, vignette, noise, smaa));
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h, false);
  }
  window.addEventListener('resize', resize);
  resize();

  // Adaptive resolution: drop DPR when frames are slow, recover when fast.
  let acc = 0, frames = 0;
  function adapt(dt) {
    acc += dt; frames++;
    if (acc < 1) return;
    const fps = frames / acc; acc = 0; frames = 0;
    if (fps < 50 && dpr > 0.75) dpr = Math.max(0.75, dpr - 0.25);
    else if (fps > 58 && dpr < maxDpr) dpr = Math.min(maxDpr, dpr + 0.25);
    else return;
    renderer.setPixelRatio(dpr); resize();
  }

  return {
    renderer, composer, bloom, chroma, vignette, setScene, resize,
    render(dt) { adapt(dt); composer.render(dt); },
  };
}
