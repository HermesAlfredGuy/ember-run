// Action-mapped input: keyboard + gamepad + touch (virtual stick & buttons).
// Game code reads actions, never raw keys:  input.axis('moveX'), input.down('boost'), input.pressed('pause')
const BINDINGS = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  boost: ['Space', 'ShiftLeft'], confirm: ['Enter', 'Space'], pause: ['Escape', 'KeyP'],
};
const PAD = { boost: 0, confirm: 0, pause: 9 }; // standard gamepad button indices

export function createInput() {
  const keys = new Set();
  const prev = new Set(), cur = new Set();
  const touch = { x: 0, y: 0, buttons: new Set() };
  const injected = { x: 0, y: 0, actions: new Set() }; // for bots / QA autoplay

  addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  const isDown = (action) => {
    if (injected.actions.has(action) || touch.buttons.has(action)) return true;
    if ((BINDINGS[action] || []).some((k) => keys.has(k))) return true;
    const gp = navigator.getGamepads?.()[0];
    return !!(gp && PAD[action] !== undefined && gp.buttons[PAD[action]]?.pressed);
  };

  const input = {
    injected,
    // call once per fixed update, before game logic
    poll() { prev.clear(); cur.forEach((a) => prev.add(a)); cur.clear(); Object.keys(BINDINGS).forEach((a) => isDown(a) && cur.add(a)); },
    down: (a) => cur.has(a),
    pressed: (a) => cur.has(a) && !prev.has(a),
    axis(name) {
      let v = 0;
      if (name === 'moveX') v = (cur.has('right') ? 1 : 0) - (cur.has('left') ? 1 : 0) + touch.x + injected.x;
      if (name === 'moveY') v = (cur.has('up') ? 1 : 0) - (cur.has('down') ? 1 : 0) + touch.y + injected.y;
      const gp = navigator.getGamepads?.()[0];
      if (gp) { const a = name === 'moveX' ? gp.axes[0] : -gp.axes[1]; if (Math.abs(a) > 0.15) v += a; }
      return Math.max(-1, Math.min(1, v));
    },
    bindTouch(root) {
      // left half = analog stick, [data-touch-action] elements = buttons
      const stick = root.querySelector('.stick'); const knob = stick?.firstElementChild;
      let id = null, ox = 0, oy = 0;
      root.addEventListener('pointerdown', (e) => {
        const btn = e.target.closest('[data-touch-action]');
        if (btn) { touch.buttons.add(btn.dataset.touchAction); btn.setPointerCapture(e.pointerId); return; }
        if (e.pointerType !== 'touch' || e.clientX > innerWidth / 2) return;
        id = e.pointerId; ox = e.clientX; oy = e.clientY;
        if (stick) { stick.style.left = ox + 'px'; stick.style.top = oy + 'px'; stick.classList.add('on'); }
      });
      root.addEventListener('pointermove', (e) => {
        if (e.pointerId !== id) return;
        const dx = (e.clientX - ox) / 60, dy = (e.clientY - oy) / 60, len = Math.hypot(dx, dy) || 1, k = Math.min(1, len) / len;
        touch.x = dx * k; touch.y = -dy * k;
        if (knob) knob.style.transform = `translate(${dx * k * 40}px, ${dy * k * 40}px)`;
      });
      const end = (e) => {
        const btn = e.target.closest?.('[data-touch-action]');
        if (btn) touch.buttons.delete(btn.dataset.touchAction);
        if (e.pointerId === id) { id = null; touch.x = touch.y = 0; stick?.classList.remove('on'); if (knob) knob.style.transform = ''; }
      };
      root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
    },
  };
  return input;
}
