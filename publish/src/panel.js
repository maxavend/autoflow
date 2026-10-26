// Embeds the real Autoflow panel in a slide. Each <div class="panel" data-scenario="…"> gets a
// Figma-style title bar and test/ui/harness.html (which plays the plugin side with fixtures),
// sized to the height the panel reports. Optional: data-theme="light|dark", data-open="…",
// data-scale (default 2), data-max="<px>" to crop a tall panel, data-state='{…}' to replace parts of
// the fixture state (nodes, connectors, stats), data-color to recolour the connectors. Sets window.listingReady when every panel is sized.
window.listingReady = false;
const panels = [...document.querySelectorAll('.panel[data-scenario]')];
let pending = panels.length;
const done = () => { if (--pending <= 0) window.listingReady = true; };
if (!pending) window.listingReady = true;

for (const panel of panels) {
  const theme = panel.dataset.theme || 'light';
  panel.classList.toggle('dark', theme === 'dark');
  const q = new URLSearchParams({ theme, scenario: panel.dataset.scenario });
  if (panel.dataset.open) q.set('open', panel.dataset.open);
  if (panel.dataset.presets !== undefined) q.set('presets', '');

  panel.innerHTML = `<div class="bar"><img src="../icon.svg" alt="">Autoflow · Smart Connectors<span class="x"></span></div>
<div class="view"><iframe title="Autoflow" src="../../test/ui/harness.html?${q}"></iframe></div>`;
  const frame = panel.querySelector('iframe');
  const view = panel.querySelector('.view');
  const max = Number(panel.dataset.max) || Infinity;
  const scale = Number(panel.dataset.scale) || 2;
  panel.style.width = `${320 * scale + 4}px`;
  panel.style.setProperty('--s', scale / 2);
  frame.style.transform = `scale(${scale})`;

  let last = 0;
  let stable = 0;
  const started = Date.now();
  const poll = () => {
    const h = Number(frame.contentDocument?.getElementById('height')?.textContent) || 0;
    stable = h && h === last ? stable + 1 : 0;
    last = h;
    if (h) {
      frame.style.height = `${h}px`;
      view.style.height = `${Math.min(h * scale, max)}px`;
    }
    if ((h && stable >= 4) || Date.now() - started > 7000) done();
    else setTimeout(poll, 150);
  };
  frame.addEventListener('load', () => {
    // the harness page itself is grey; only its inner panel should show
    frame.contentDocument.documentElement.style.background = 'transparent';
    frame.contentDocument.body.style.background = 'transparent';
    if (panel.dataset.state || panel.dataset.color) {
      // after the harness has answered the panel's 'ready' with its fixture state
      setTimeout(() => {
        const w = frame.contentWindow;
        const state = { ...w.state, ...JSON.parse(panel.dataset.state || '{}') };
        const color = panel.dataset.color;
        if (color) {
          state.connectors = state.connectors.map((c) => ({ ...c, data: { ...c.data, style: { ...c.data.style, color } } }));
          state.defaults = { ...state.defaults, style: { ...state.defaults.style, color } };
        }
        w.state = state;
        w.toUI(state);
      }, 400);
    }
    setTimeout(poll, 600);
  });
}
