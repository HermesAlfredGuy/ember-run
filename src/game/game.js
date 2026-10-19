// EMBER RUN — demo game wiring every engine system. Replace this file for a new game,
// keep the structure: state machine, fixed update, render with interpolation, QA hooks.
import * as THREE from 'three';
import { ChaseCamera, Particles, hitStop } from '../engine/juice.js';
import { createTerrainTile, sandMaterial, createCraft, createEmber, createSpire, duneHeight, TILE } from './world.js';

const TUNING = {
  speed: 34, boostSpeed: 60, boostDrain: 0.45, boostRegen: 0.12,
  lateralAccel: 9, lateralMax: 22, climb: 9, minAlt: 1.6, maxAlt: 10,
  roundTime: 60, hitsAllowed: 3, comboWindow: 1.6,
};

export function createGame({ scene, camera, env, audio, input, loop, ui }) {
  const terrainMat = sandMaterial();
  const tiles = [0, 1, 2].map((i) => { const t = createTerrainTile(terrainMat); t.userData.rebuild(-i * TILE); scene.add(t); return t; });

  const craft = createCraft(); scene.add(craft);
  const cam = new ChaseCamera(camera, { offset: new THREE.Vector3(0, 2.6, 7.5), lookAhead: 10, stiffness: 5 });
  const fx = new Particles(scene); fx.camera = camera;

  const embers = Array.from({ length: 36 }, () => { const e = createEmber(); e.visible = false; scene.add(e); return e; });
  const spires = Array.from({ length: 28 }, (_, i) => { const s = createSpire(i * 7.3); s.visible = false; scene.add(s); return s; });

  const S = {
    state: 'title', score: 0, best: 0, combo: 0, comboT: 0, time: TUNING.roundTime, hits: 0, invuln: 0, boost: 1,
    pos: new THREE.Vector3(0, 4, 0), prev: new THREE.Vector3(0, 4, 0), vel: new THREE.Vector3(), bank: 0, pitch: 0,
    nextSpawnZ: -60, nextSpireZ: -80, autoplay: false,
  };
  try { S.best = +localStorage.getItem('best') || 0; } catch {}
  const q = new THREE.Quaternion(), e3 = new THREE.Euler();
  const heading = new THREE.Quaternion(); // camera follows heading only (no roll), so the horizon stays readable

  function reset() {
    Object.assign(S, { score: 0, combo: 0, comboT: 0, time: TUNING.roundTime, hits: 0, invuln: 0, boost: 1, bank: 0, pitch: 0, nextSpawnZ: -60, nextSpireZ: -80 });
    S.pos.set(0, 4, 0); S.prev.copy(S.pos); S.vel.set(0, 0, 0);
    tiles.forEach((t, i) => t.userData.rebuild(-i * TILE));
    embers.forEach((e) => (e.visible = false)); spires.forEach((s) => (s.visible = false));
    cam.snap({ position: S.pos, quaternion: heading });
  }

  // Embers spawn as flowing ribbons — patterns the player can read and chase, not random dots.
  function spawnRibbon(z0) {
    const x0 = (Math.random() - 0.5) * 30, amp = 4 + Math.random() * 8, n = 7, freq = 0.5 + Math.random() * 0.6;
    for (let i = 0; i < n; i++) {
      const e = embers.find((k) => !k.visible); if (!e) return;
      const z = z0 - i * 5, x = x0 + Math.sin(i * freq) * amp;
      e.position.set(x, Math.max(duneHeight(x, z) + 2.5, 2.5) + Math.sin(i * 0.8) * 1.5, z);
      e.visible = true; e.userData.phase = Math.random() * 6;
    }
  }
  function spawnSpire(z) {
    const s = spires.find((k) => !k.visible); if (!s) return;
    const x = (Math.random() - 0.5) * 50;
    s.position.set(x, duneHeight(x, z), z); s.rotation.y = Math.random() * 6; s.visible = true;
  }

  function collect(e) {
    e.visible = false;
    S.combo = S.comboT > 0 ? S.combo + 1 : 1; S.comboT = TUNING.comboWindow;
    const mult = 1 + Math.floor(S.combo / 5);
    S.score += 10 * mult; S.time = Math.min(TUNING.roundTime, S.time + 0.4);
    fx.burst(e.position, { count: 26, speed: 9, color: new THREE.Color(5, 2.4, 0.8), life: 0.6, size: 0.4 });
    audio.play('pickup', S.combo);
    cam.addTrauma(0.12); cam.fovKick += 3;
    ui.pop(`+${10 * mult}`, mult > 1 ? `x${mult}` : '');
  }
  function crash(s) {
    S.hits++; S.invuln = 1.5; S.combo = 0; S.comboT = 0;
    fx.burst(S.pos, { count: 60, speed: 14, color: new THREE.Color(3, 1.2, 0.6), life: 0.9, size: 0.5, grav: -8 });
    audio.play('hit'); cam.addTrauma(0.85); hitStop(loop, 90);
    S.vel.x = Math.sign(S.pos.x - s.position.x || 1) * 18; // knock-back away from the spire
    ui.flash();
    if (S.hits >= TUNING.hitsAllowed) end();
  }
  function end() {
    S.state = 'over'; audio.play('over');
    if (S.score > S.best) { S.best = S.score; try { localStorage.setItem('best', S.best); } catch {} }
    ui.show('over', S);
  }
  function start() { reset(); S.state = 'play'; audio.play('start'); ui.show('play', S); }

  function bot() {
    // simple autopilot for QA captures: chase the nearest ember ahead, dodge spires
    let tx = 0, ty = 0, best = 1e9;
    for (const e of embers) if (e.visible && e.position.z < S.pos.z - 4 && S.pos.z - e.position.z < 70) {
      const d = S.pos.z - e.position.z; if (d < best) { best = d; tx = e.position.x - S.pos.x; ty = e.position.y - S.pos.y; }
    }
    for (const s of spires) if (s.visible && s.position.z < S.pos.z && S.pos.z - s.position.z < 28 && Math.abs(s.position.x - S.pos.x) < s.userData.radius + 3) tx = (S.pos.x > s.position.x ? 1 : -1) * 10;
    input.injected.x = THREE.MathUtils.clamp(tx / 6, -1, 1);
    input.injected.y = THREE.MathUtils.clamp(ty / 3, -1, 1);
    if (S.boost > 0.6 && best > 40) input.injected.actions.add('boost'); else input.injected.actions.delete('boost');
  }

  function update(dt) {
    input.poll();
    if (S.state !== 'play') {
      if (input.pressed('confirm')) { audio.play('ui'); start(); }
      // idle flyover keeps the title/over screens alive
      S.prev.copy(S.pos); S.pos.z -= 14 * dt; S.pos.y = 5 + Math.sin(loop.time * 0.6) * 0.8;
    } else {
      if (S.autoplay) bot();
      if (input.pressed('pause')) { loop.paused = !loop.paused; ui.show(loop.paused ? 'pause' : 'play', S); }
      S.prev.copy(S.pos);
      const ax = input.axis('moveX'), ay = input.axis('moveY');
      const boosting = input.down('boost') && S.boost > 0.02;
      if (input.pressed('boost') && S.boost > 0.1) { audio.play('boost'); cam.addTrauma(0.15); }
      S.boost = THREE.MathUtils.clamp(S.boost + (boosting ? -TUNING.boostDrain : TUNING.boostRegen) * dt, 0, 1);
      const speed = boosting ? TUNING.boostSpeed : TUNING.speed;
      // lateral: accelerate toward target velocity (responsive, but with weight)
      S.vel.x = THREE.MathUtils.damp(S.vel.x, ax * TUNING.lateralMax, TUNING.lateralAccel * 0.35, dt);
      S.vel.z = THREE.MathUtils.damp(S.vel.z, -speed, 2.5, dt);
      S.pos.x = THREE.MathUtils.clamp(S.pos.x + S.vel.x * dt, -55, 55);
      S.pos.z += S.vel.z * dt;
      const ground = duneHeight(S.pos.x, S.pos.z);
      S.pos.y = THREE.MathUtils.clamp(S.pos.y + ay * TUNING.climb * dt, ground + TUNING.minAlt, ground + TUNING.maxAlt);
      S.bank = THREE.MathUtils.damp(S.bank, -S.vel.x * 0.045, 6, dt);
      S.pitch = THREE.MathUtils.damp(S.pitch, ay * 0.25, 5, dt);

      S.time -= dt; S.comboT -= dt; S.invuln -= dt;
      if (S.comboT <= 0) S.combo = 0;
      if (S.time <= 0) end();

      for (const e of embers) if (e.visible && e.position.distanceToSquared(S.pos) < 2.6) collect(e);
      if (S.invuln <= 0) for (const s of spires) if (s.visible) {
        const dx = s.position.x - S.pos.x, dz = s.position.z - S.pos.z;
        if (dx * dx + dz * dz < (s.userData.radius + 0.9) ** 2 && S.pos.y < s.position.y + s.userData.height - 1.5) { crash(s); break; }
      }
      if (boosting) fx.trail(craft.position.clone().add(new THREE.Vector3(0, 0, 1.9)), new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 8), new THREE.Color(4, 1.8, 0.6), 0.45, 0.4);
      ui.hud(S, boosting);
    }
    // world streaming: spawn ahead, recycle behind
    while (S.nextSpawnZ > S.pos.z - 220) { spawnRibbon(S.nextSpawnZ); S.nextSpawnZ -= 55 + Math.random() * 30; }
    while (S.nextSpireZ > S.pos.z - 260) { spawnSpire(S.nextSpireZ); S.nextSpireZ -= 9 + Math.random() * 14; }
    for (const k of [...embers, ...spires]) if (k.visible && k.position.z > S.pos.z + 30) k.visible = false;
    for (const t of tiles) if (t.position.z > S.pos.z + TILE) t.userData.rebuild(Math.min(...tiles.map((o) => o.position.z)) - TILE);
    fx.update(dt);
  }

  function render(frameDt, alpha) {
    const p = craft.position.lerpVectors(S.prev, S.pos, alpha);
    e3.set(S.pitch, 0, S.bank); q.setFromEuler(e3); craft.quaternion.copy(q);
    craft.visible = !(S.invuln > 0 && Math.floor(S.invuln * 12) % 2 === 0);
    const t = performance.now() / 1000;
    craft.userData.flame.scale.set(1, 0.8 + Math.random() * 0.4 + (input.down('boost') ? 0.9 : 0), 1);
    for (const e of embers) if (e.visible) { e.rotation.y = t * 1.5 + e.userData.phase; e.userData.halo.rotation.x = t * 2 + e.userData.phase; e.position.y += Math.sin(t * 3 + e.userData.phase) * 0.004; }
    const speed01 = THREE.MathUtils.clamp((-S.vel.z - TUNING.speed) / (TUNING.boostSpeed - TUNING.speed), 0, 1);
    cam.update({ position: p, quaternion: heading }, Math.max(frameDt, 1e-4), speed01);
    env.follow(p);
  }

  return { S, update, render, start, reset, cam, tuning: TUNING };
}
