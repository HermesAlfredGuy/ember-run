// WebAudio with buses and procedural SFX. Unlocks on first user gesture.
// Swap synth presets for licensed samples via audio.loadSample(name, url) when the project has them.
export function createAudio() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain(), sfx = ctx.createGain(), music = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  sfx.connect(master); music.connect(master); master.connect(comp); comp.connect(ctx.destination);
  sfx.gain.value = 0.7; music.gain.value = 0.35;
  let muted = false;
  try { muted = localStorage.getItem('muted') === '1'; } catch {}
  master.gain.value = muted ? 0 : 0.9;
  const samples = new Map();
  const unlock = () => ctx.state === 'suspended' && ctx.resume();
  ['pointerdown', 'keydown', 'touchstart'].forEach((e) => addEventListener(e, unlock, { once: false, passive: true }));

  const env = (g, t, a, d, peak = 1) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  function tone({ freq = 440, to = null, type = 'sine', a = 0.005, d = 0.2, vol = 0.4, when = 0, bus = sfx, detune = 0 }) {
    const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + a + d);
    env(g, t, a, d, vol); o.connect(g); g.connect(bus); o.start(t); o.stop(t + a + d + 0.05);
  }
  function noise({ d = 0.3, vol = 0.3, from = 800, to = 200, q = 1, when = 0, type = 'bandpass' }) {
    const t = ctx.currentTime + when, len = Math.ceil(ctx.sampleRate * (d + 0.05));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + d);
    env(g, t, 0.01, d, vol); src.connect(f); f.connect(g); g.connect(sfx); src.start(t);
  }

  const presets = {
    // rising pentatonic arpeggio; pitch climbs with combo for escalating reward
    pickup: (combo = 0) => { const base = 523.25 * Math.pow(2, Math.min(combo, 12) / 12); [0, 4, 7, 12].forEach((s, i) => tone({ freq: base * Math.pow(2, s / 12), type: 'triangle', d: 0.18, vol: 0.22, when: i * 0.045 })); },
    hit: () => { tone({ freq: 140, to: 40, type: 'sine', d: 0.35, vol: 0.7 }); noise({ d: 0.25, vol: 0.4, from: 2000, to: 150, type: 'lowpass' }); },
    boost: () => noise({ d: 0.6, vol: 0.25, from: 300, to: 3000, q: 2 }),
    ui: () => tone({ freq: 880, type: 'sine', d: 0.06, vol: 0.15 }),
    start: () => [0, 7, 12, 19].forEach((s, i) => tone({ freq: 261.6 * Math.pow(2, s / 12), type: 'sawtooth', d: 0.4, vol: 0.12, when: i * 0.09, detune: 6 })),
    over: () => [12, 7, 3, 0].forEach((s, i) => tone({ freq: 261.6 * Math.pow(2, s / 12), type: 'triangle', d: 0.5, vol: 0.2, when: i * 0.14 })),
  };

  return {
    ctx, sfx, music,
    play(name, ...args) {
      if (ctx.state !== 'running') return;
      if (samples.has(name)) { const s = ctx.createBufferSource(); s.buffer = samples.get(name); s.connect(sfx); s.start(); return; }
      presets[name]?.(...args);
    },
    async loadSample(name, url) { const r = await fetch(url); samples.set(name, await ctx.decodeAudioData(await r.arrayBuffer())); },
    get muted() { return muted; },
    toggleMute() { muted = !muted; master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05); try { localStorage.setItem('muted', muted ? '1' : '0'); } catch {} return muted; },
  };
}
