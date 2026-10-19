# game-three kit

3D browser game foundation. three 0.186 + postprocessing 6.39, Vite 8. Demo: "Ember Run"
(glider over a dusk dune sea; collect ember ribbons, dodge spires; 60s, 3 hits).

```bash
cp -r /opt/data/kits/game-three ./my-game && cd my-game && rm -rf node_modules dist && npm install
npm run dev        # ?autoplay=1 starts with the bot flying; ?palette=dawn|night|desert; ?quality=low
npm run build
```

## Engine (src/engine) — reuse as-is
| Module | What |
|---|---|
| `renderer.js` | WebGL + EffectComposer: bloom (threshold 1.0), AgX tone map, vignette, grain, SMAA; adaptive DPR |
| `loop.js` | fixed 60 Hz update + interpolated render; `timeScale` (hit-stop/slow-mo); `paused`; `advance(n)` for tests |
| `input.js` | actions `left/right/up/down/boost/confirm/pause`; `axis('moveX'/'moveY')`, `down()`, `pressed()`; keyboard, gamepad, touch stick + `[data-touch-action]` buttons; `injected` for bots |
| `juice.js` | `ChaseCamera` (damped follow, look-ahead, FOV kick, trauma shake), `hitStop(loop, ms)`, `Particles` (pooled additive billboards: `burst`, `trail`) |
| `audio.js` | buses + compressor, gesture unlock, synth presets `pickup(combo)/hit/boost/ui/start/over`, `loadSample(name,url)` to swap in licensed samples, persisted mute |
| `environment.js` | gradient sky shader with HDR sun, matching FogExp2, PMREM reflections, hemi + shadowed sun that follows the player; palettes dusk/dawn/night/desert |

HDRI instead of the procedural sky: `new RGBELoader().load('/opt/data/assets/hdri/....hdr')` → PMREM → `scene.environment` (copy the file into `public/`).

## Game (src/game) — replace for your game, keep the shape
`game.js`: state machine (title → play → over, pause), `update(dt)` fixed-step logic, `render(dt, alpha)`
interpolation, spawn/recycle streaming, bot. `world.js`: procedural terrain, craft (lathe + bevelled
extrusions, clearcoat), collectibles, hazards. `TUNING` object at the top holds every feel number.

## UI (src/ui, index.html, style.css)
DOM HUD (score bump, timer warn, boost bar, hits, combo, floating +points), designed title/pause/over
screens, touch controls on coarse pointers, safe-area insets, reduced-motion = less shake.

## QA hooks (keep them in every game)
`window.__game = { S, loop, start(), autoplay(on), advance(n), tuning }`.
`bash /opt/data/scripts/studio-qa/qa.sh game "http://127.0.0.1:<port>/?autoplay=1" --video`
→ game-sheet.png + gameplay.mp4. Container fps (software GL) is not real-device fps.
