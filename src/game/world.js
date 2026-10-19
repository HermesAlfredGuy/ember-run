// Procedural world pieces: dune terrain tiles, player craft, collectibles, hazards.
// Everything is smooth-shaded with real PBR values and an env map — no flat-shaded "blockout".
import * as THREE from 'three';

// cheap smooth value noise (deterministic)
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(xi, yi), hash(xi + 1, yi), u), THREE.MathUtils.lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v);
}
export function duneHeight(x, z) {
  // long ridges + rolling swell; a flat-ish corridor near x=0 keeps the play lane readable
  const ridge = 1 - Math.abs(Math.sin(x * 0.045 + vnoise(x * 0.02, z * 0.02) * 3));
  const swell = vnoise(x * 0.03, z * 0.03) * 6 + vnoise(x * 0.11, z * 0.11) * 1.2;
  const lane = THREE.MathUtils.smoothstep(Math.abs(x), 6, 30);
  return (ridge * 7 + swell) * (0.25 + 0.75 * lane) - 2;
}

export const TILE = 160;
export function createTerrainTile(material) {
  const geo = new THREE.PlaneGeometry(220, TILE, 110, 80);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.userData.rebuild = (zOffset) => {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, duneHeight(pos.getX(i), pos.getZ(i) + zOffset));
    pos.needsUpdate = true; geo.computeVertexNormals();
    mesh.position.z = zOffset;
  };
  return mesh;
}

export function sandMaterial() {
  // subtle ripple normal detail from a canvas texture; roughness high, warm albedo
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const r = Math.sin((y + Math.sin(x * 0.05) * 6) * 0.35) * 0.5 + 0.5, i = (y * 256 + x) * 4;
    img.data[i] = 128; img.data[i + 1] = 128 + (r - 0.5) * 90; img.data[i + 2] = 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const nrm = new THREE.CanvasTexture(c); nrm.wrapS = nrm.wrapT = THREE.RepeatWrapping; nrm.repeat.set(30, 22);
  return new THREE.MeshStandardMaterial({ color: '#d9a07a', roughness: 0.92, metalness: 0, normalMap: nrm, normalScale: new THREE.Vector2(0.35, 0.35) });
}

export function createCraft() {
  const g = new THREE.Group();
  const hull = new THREE.MeshPhysicalMaterial({ color: '#e9e4dc', roughness: 0.28, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1d1f26', roughness: 0.4, metalness: 0.8 });
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.6, 0.6), toneMapped: false });

  // fuselage: lathe profile = smooth teardrop, not a box
  const prof = [[0, -1.6], [0.22, -1.3], [0.42, -0.6], [0.48, 0.2], [0.36, 0.9], [0.18, 1.3], [0, 1.4]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), hull);
  body.rotation.x = -Math.PI / 2; body.scale.set(1, 1, 0.62); body.castShadow = true;
  // wings: bevelled extrusion of a swept planform
  const w = new THREE.Shape(); w.moveTo(0, 0.5); w.lineTo(2.4, -0.15); w.lineTo(2.5, -0.45); w.lineTo(0, -0.7); w.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(w, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.04, bevelSegments: 3 });
  wingGeo.rotateX(Math.PI / 2); wingGeo.translate(0, 0.03, 0);
  const wl = new THREE.Mesh(wingGeo, hull), wr = new THREE.Mesh(wingGeo, hull);
  wr.scale.x = -1; [wl, wr].forEach((m) => { m.castShadow = true; m.position.z = 0.15; });
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#0d1420', roughness: 0.05, metalness: 0, clearcoat: 1, transmission: 0 }));
  canopy.scale.set(0.9, 0.7, 1.6); canopy.position.set(0, 0.22, -0.35);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.3, 24), dark); nozzle.rotation.x = Math.PI / 2; nozzle.position.z = 1.45;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.9, 16, 1, true), glow); flame.rotation.x = -Math.PI / 2; flame.position.z = 1.95;
  const tipL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.7, 0.3), toneMapped: false })); tipL.position.set(2.45, 0.03, -0.15);
  const tipR = tipL.clone(); tipR.position.x = -2.45;
  g.add(body, wl, wr, canopy, nozzle, flame, tipL, tipR);
  g.userData = { flame, tips: [tipL, tipR] };
  return g;
}

export function createEmber() {
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 2), new THREE.MeshStandardMaterial({ color: '#ffb36b', emissive: new THREE.Color(5, 2.2, 0.7), roughness: 0.3 }));
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.05, 8, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.4, 0.5), toneMapped: false }));
  const g = new THREE.Group(); g.add(core, halo); g.userData.halo = halo; return g;
}

export function createSpire(seed) {
  // displaced, smooth-shaded rock column with strata
  const h = 10 + hash(seed, 1) * 18, r = 1.4 + hash(seed, 2) * 1.8;
  const geo = new THREE.CylinderGeometry(r * 0.55, r, h, 20, 24);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), a = Math.atan2(z, x);
    const k = 1 + (vnoise(a * 2 + seed, y * 0.3) - 0.5) * 0.45 + Math.sin(y * 2.2) * 0.04;
    pos.setX(i, x * k); pos.setZ(i, z * k);
  }
  geo.computeVertexNormals(); geo.translate(0, h / 2 - 1.5, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#7d4a3a', roughness: 0.85 }));
  m.castShadow = true; m.receiveShadow = true; m.userData.radius = r * 0.9; m.userData.height = h;
  return m;
}
