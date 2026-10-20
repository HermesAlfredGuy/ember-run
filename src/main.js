import './style.css';
import * as THREE from 'three';
import { createRenderer } from './engine/renderer.js';
import { createLoop } from './engine/loop.js';
import { createInput } from './engine/input.js';
import { createAudio } from './engine/audio.js';
import { createEnvironment } from './engine/environment.js';
import { createUI } from './ui/ui.js';
import { createGame } from './game/game.js';

const params = new URLSearchParams(location.search);
const canvas = document.querySelector('#gl');
const gfx = createRenderer(canvas, { quality: params.get('quality') || 'auto' });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1200);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

const env = createEnvironment(gfx.renderer, scene, { palette: params.get('palette') || 'dusk' });
gfx.setScene(scene, camera);

const input = createInput();
input.bindTouch(document.querySelector('#app'));
const audio = createAudio();
const ui = createUI(document.querySelector('#app'));

let game;
const loop = createLoop({
  update: (dt) => game.update(dt),
  render: (frameDt, alpha) => { game.render(frameDt, alpha); gfx.render(frameDt); },
});
game = createGame({ scene, camera, env, audio, input, loop, ui });
game.reset();
ui.show('title', game.S);

document.querySelector('#btn-start').addEventListener('click', () => game.start());
document.querySelector('#btn-retry').addEventListener('click', () => game.start());
document.querySelectorAll('[data-mute]').forEach((b) => {
  b.setAttribute('aria-pressed', String(audio.muted));
  b.addEventListener('click', () => b.setAttribute('aria-pressed', String(audio.toggleMute())));
});
// Motion is always full: the OS reduced-motion setting is deliberately not consulted (owner decision, 2026-10-20).

// QA hooks: deterministic stepping + autopilot so agents can capture real gameplay.
//   ?autoplay=1  -> starts immediately with the bot flying
window.__game = { S: game.S, loop, start: game.start, autoplay(on = true) { game.S.autoplay = on; }, advance: (n) => loop.advance(n), tuning: game.tuning };
if (params.has('autoplay')) { game.S.autoplay = true; game.start(); }
loop.start();
