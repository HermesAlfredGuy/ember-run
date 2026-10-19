// Atmosphere = sky gradient + matching fog + key/fill light + image-based reflections.
// Most "cheap-looking" three.js scenes fail here: black/flat background, no fog, single light,
// no environment map (so metal/roughness materials look like plastic). Fix all four together.
import * as THREE from 'three';

const skyVert = /* glsl */`
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }`;
const skyFrag = /* glsl */`
uniform vec3 top; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunSize;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(horizon, top, smoothstep(0.0, 0.55, h));
  col = mix(col, ground, smoothstep(0.0, -0.25, h));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * (pow(s, 6.0) * 0.35 + pow(s, 64.0) * 1.2);   // glow + halo
  col += sunColor * smoothstep(1.0 - sunSize, 1.0 - sunSize * 0.6, s) * 6.0; // HDR disc -> blooms
  gl_FragColor = vec4(col, 1.0);
}`;

export const PALETTES = {
  dusk:   { top: '#1b1a3a', horizon: '#f08a5d', ground: '#2a1b2e', sun: '#ffcf8a', fog: '#c46d5c', hemiSky: '#8fa6ff', hemiGround: '#5a2f2a' },
  dawn:   { top: '#6fa3d9', horizon: '#ffd9b0', ground: '#c9b39b', sun: '#fff1d6', fog: '#e8c9b2', hemiSky: '#cfe3ff', hemiGround: '#a08a70' },
  night:  { top: '#030512', horizon: '#1b2a5c', ground: '#05060d', sun: '#9fb8ff', fog: '#121a38', hemiSky: '#3a4c9a', hemiGround: '#0a0a14' },
  desert: { top: '#2f6fb3', horizon: '#f3d7a8', ground: '#c99a5b', sun: '#fff4dd', fog: '#e9cfa3', hemiSky: '#bcd7ff', hemiGround: '#b98a4f' },
};

export function createEnvironment(renderer, scene, { palette = 'dusk', sunElevation = 6, sunAzimuth = 200, fogDensity = 0.012 } = {}) {
  const p = PALETTES[palette] || palette;
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - sunElevation), THREE.MathUtils.degToRad(sunAzimuth));
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 16),
    new THREE.ShaderMaterial({
      vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(p.top) }, horizon: { value: new THREE.Color(p.horizon) }, ground: { value: new THREE.Color(p.ground) },
        sunDir: { value: sunDir }, sunColor: { value: new THREE.Color(p.sun) }, sunSize: { value: 0.0015 },
      },
    }),
  );
  sky.scale.setScalar(900); sky.frustumCulled = false; sky.renderOrder = -1;
  scene.add(sky);
  scene.fog = new THREE.FogExp2(p.fog, fogDensity);

  // Reflections: bake the sky into a PMREM env map once.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); const envSky = sky.clone(); envSky.scale.setScalar(10); envScene.add(envSky);
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  scene.environmentIntensity = 0.8;
  pmrem.dispose();

  const hemi = new THREE.HemisphereLight(p.hemiSky, p.hemiGround, 0.6);
  const sun = new THREE.DirectionalLight(p.sun, 2.6);
  sun.position.copy(sunDir).multiplyScalar(80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = sun.shadow.camera; s.left = -40; s.right = 40; s.top = 40; s.bottom = -40; s.near = 1; s.far = 220;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(hemi, sun, sun.target);

  return {
    sky, sun, hemi, sunDir,
    // keep the shadow frustum centred on the player so shadows stay crisp everywhere
    follow(pos) { sky.position.copy(pos); sun.target.position.copy(pos); sun.position.copy(pos).addScaledVector(sunDir, 80); },
  };
}
