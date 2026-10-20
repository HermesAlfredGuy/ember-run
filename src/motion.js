// Viewer-chosen motion level for the game.
// Motion is FULL by default, even when the OS reports prefers-reduced-motion: work PCs ship with
// Windows "Animation effects" off and the game then lost its HUD flourishes (owner decision,
// 2026-10-20). Only this toggle calms it: camera shake drops, HUD pops shorten. Gameplay is never
// slower or harder to read, and nothing flashes more than 3 times a second.
const KEY = 'site-motion';
export const reduced = (() => {
  try { return localStorage.getItem(KEY) === 'reduced'; } catch { return false; }
})();

function mount() {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'motion-toggle';
  b.textContent = reduced ? 'Full motion' : 'Reduce motion';
  b.setAttribute('aria-pressed', String(reduced));
  b.title = reduced ? 'Bring full motion back' : 'Calm the camera shake and HUD pops';
  b.addEventListener('click', () => {
    try { localStorage.setItem(KEY, reduced ? 'full' : 'reduced'); } catch {}
    location.reload();
  });
  document.body.appendChild(b);
}
if (document.body) mount();
else document.addEventListener('DOMContentLoaded', mount);

document.documentElement.classList.toggle('reduced', reduced);
