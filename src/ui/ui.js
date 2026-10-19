// DOM HUD + screens. DOM (not canvas) text stays crisp, accessible and easy to style.
export function createUI(root) {
  const $ = (s) => root.querySelector(s);
  const screens = { title: $('#screen-title'), over: $('#screen-over'), pause: $('#screen-pause') };
  const hud = $('#hud');
  const el = { score: $('#hud-score'), time: $('#hud-time'), boost: $('#hud-boost'), hits: $('#hud-hits'), combo: $('#hud-combo'), final: $('#final-score'), best: $('#best-score'), pops: $('#pops') };
  let lastScore = -1;
  return {
    show(name, S) {
      Object.entries(screens).forEach(([k, s]) => s.classList.toggle('is-on', k === name));
      hud.classList.toggle('is-on', name === 'play' || name === 'pause');
      if (name === 'over') { el.final.textContent = S.score; el.best.textContent = S.best; }
    },
    hud(S, boosting) {
      if (S.score !== lastScore) { el.score.textContent = S.score; el.score.classList.remove('bump'); void el.score.offsetWidth; el.score.classList.add('bump'); lastScore = S.score; }
      el.time.textContent = Math.max(0, S.time).toFixed(1);
      el.time.classList.toggle('warn', S.time < 10);
      el.boost.style.transform = `scaleX(${S.boost})`;
      el.boost.parentElement.classList.toggle('active', boosting);
      el.hits.textContent = '◆'.repeat(Math.max(0, 3 - S.hits)) + '◇'.repeat(Math.min(3, S.hits));
      el.combo.textContent = S.combo > 1 ? `${S.combo} chain` : '';
    },
    pop(text, sub) {
      const p = document.createElement('div'); p.className = 'pop'; p.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
      el.pops.append(p); setTimeout(() => p.remove(), 900);
    },
    flash() { root.classList.remove('hit'); void root.offsetWidth; root.classList.add('hit'); },
  };
}
