// Autoflow panel. Talks to src/code.ts through the message contract:
//   plugin → UI: state, fonts, result
//   UI → plugin: ready, plan, patch, swap,
//                delete, select, select-broken, prototype, defaults,
//                defaults-from, reset-defaults, preset-save, preset-delete,
//                clean, resize
//                (all but plan/resize carry requestId)
import '@rogieking/figui3/fig.css';
import '@rogieking/figui3/fig-editor.css';
import '@rogieking/figui3/fig.js';
import '@rogieking/figui3/fig-editor.js';
import './styles.css';
import { ICONS } from './icons.js';
import { GLYPHS } from './glyphs.js';
import { normalizeHex, parseNumber } from './validate.js';
import { plural, translator } from './messages.js';
// A FigJam connector as Figma writes it to the clipboard, marked autoflow/seed.
// Pasting it into a Design file creates a native CONNECTOR the plugin adopts.
import PAYLOAD from './connector-payload.html?raw';

const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ text
//
// Every string lives in messages.js. The paste shortcut follows the platform.
const PASTE = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘V' : 'Ctrl+V';
const t = translator({ paste: PASTE });

// Static text: [data-i18n] sets the text, [data-i18n-attr="attr=key,…"] sets
// attributes, [data-i18n-label="key"] sets aria-label and title (plus an
// optional data-i18n-suffix).
function applyText() {
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of el.dataset.i18nAttr.split(',')) {
      const [attr, key] = pair.split('=');
      el.setAttribute(attr.trim(), t(key.trim()));
    }
  }
  for (const el of document.querySelectorAll('[data-i18n-label]')) {
    const label = t(el.dataset.i18nLabel) + (el.dataset.i18nSuffix || '');
    el.setAttribute('aria-label', label);
    el.title = label;
  }
  for (const el of document.querySelectorAll('[data-paste-key]')) el.textContent = PASTE;
}

// Puts the connector on the clipboard. Must run inside a click handler.
function copyPayload() {
  const onCopy = (e) => {
    e.clipboardData.setData('text/html', PAYLOAD);
    e.preventDefault();
  };
  document.addEventListener('copy', onCopy);
  try {
    return document.execCommand('copy');
  } finally {
    document.removeEventListener('copy', onCopy);
  }
}

// ------------------------------------------------------------------ messaging

const pending = new Map();
let seq = 0;

function post(msg) {
  parent.postMessage({ pluginMessage: msg }, '*');
}

// Sends a message and resolves with the plugin's { ok, message } result.
// Never hangs: a missing reply resolves as an error after a timeout.
function request(msg, timeout = 20000) {
  const requestId = `r${++seq}`;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      resolve({ ok: false, message: t('noReply') });
    }, timeout);
    pending.set(requestId, (res) => {
      clearTimeout(timer);
      resolve(res);
    });
    post({ ...msg, requestId });
  });
}

// Brief confirmation inside the panel (FigUI3 toast).
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.showToast?.();
}

function announce(text) {
  $('status').textContent = text || '';
}

// ------------------------------------------------------------------ static data

// Toolbar pickers: [value, label, glyph]. Colors are connector values, not UI
// chrome: FigJam's palette, saturated row over its light row.
const PALETTE = [
  ['#1e1e1e', 'color.black'],
  ['#757575', 'color.gray'],
  ['#f24822', 'color.red'],
  ['#ffa629', 'color.orange'],
  ['#ffcd29', 'color.yellow'],
  ['#14ae5c', 'color.green'],
  ['#2fc6b8', 'color.teal'],
  ['#0d99ff', 'color.blue'],
  ['#9747ff', 'color.violet'],
  ['#f849c1', 'color.pink'],
  ['#ffffff', 'color.white'],
  ['#b3b3b3', 'color.lightGray'],
  ['#d9d9d9', 'color.paleGray'],
  ['#ffc7c2', 'color.lightRed'],
  ['#fcd19c', 'color.lightOrange'],
  ['#ffe8a3', 'color.lightYellow'],
  ['#aff4c6', 'color.lightGreen'],
  ['#b8f2ec', 'color.lightTeal'],
  ['#bde3ff', 'color.lightBlue'],
  ['#e4ccff', 'color.lightViolet'],
  ['#ffbdf2', 'color.lightPink'],
];
const WEIGHTS = [1, 2, 4, 6];
const DASHES = [
  ['solid', 'strokeSolid'],
  ['dash', 'strokeDash'],
  ['dot', 'strokeDot'],
];
const KINDS = [
  ['elbow', 'elbow'],
  ['curve', 'curve'],
  ['straight', 'straight'],
];
// Line ends, one picker per end like FigJam. The official cap glyphs face
// the start of the line; the end picker mirrors them.
const CAPS = [
  ['none', 'strokeSolid'],
  ['arrow', 'capArrow'],
  ['triangle', 'capTriangle'],
  ['circle', 'capCircle'],
  ['diamond', 'capDiamond'],
];
const STYLE_KEYS = ['color', 'opacity', 'weight', 'dash', 'startCap', 'endCap', 'radius', 'labelColor', 'labelSize', 'labelFont'];

// Static, trusted SVG strings (official icons or ui/glyphs.js) — never document data.
function glyph(name) {
  const span = document.createElement('span');
  span.dataset.icon = name;
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = ICONS[name] || GLYPHS[name] || '';
  return span;
}

function fillSelect(select, items) {
  const list = document.createElement('fig-select-options');
  for (const [value, text] of items) {
    const opt = document.createElement('fig-select-option');
    opt.setAttribute('value', value);
    opt.textContent = text;
    list.append(opt);
  }
  select.replaceChildren(list);
}

// Icon-only pickers like FigJam's, built from FigUI3: each is a fig-popup
// anchored under its toolbelt item. Icon choices are fig-toolbelts (one
// selection each, arrow-key navigation); the color grid is fig-swatches.
function pickBelt(id, label, items) {
  const belt = document.createElement('fig-toolbelt');
  belt.className = 'pick-belt';
  belt.dataset.belt = id;
  belt.dataset.i18nAttr = `aria-label=${label}`;
  for (const [value, key, content, suffix] of items) {
    const item = document.createElement('fig-toolbelt-item');
    item.className = 'pick';
    item.setAttribute('value', String(value));
    item.dataset.i18nLabel = key;
    if (suffix) item.dataset.i18nSuffix = suffix;
    item.append(content);
    belt.append(item);
  }
  return belt;
}

// A color option: a FigUI3 swatch inside a button (the swatch alone would
// open the native color input; the button picks the preset instead).
function swatchItem(value, key, background) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pick pick-swatch';
  b.dataset.value = value;
  b.tabIndex = -1;
  b.dataset.i18nLabel = key;
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-checked', 'false');
  const sw = document.createElement('fig-swatch');
  sw.setAttribute('background', background);
  sw.inert = true;
  b.append(sw);
  return b;
}

function buildPickers() {
  const make = (name, label, ...children) => {
    const p = document.createElement('dialog', { is: 'fig-popup' });
    p.setAttribute('is', 'fig-popup');
    p.className = `picker picker-${name}`;
    p.dataset.for = name;
    p.dataset.i18nAttr = `aria-label=${label}`;
    p.setAttribute('theme', 'menu');
    p.setAttribute('position', 'bottom center');
    p.setAttribute('offset', '0 6');
    p.append(...children);
    document.body.append(p);
    p.anchor = triggerOf(name);
    // fig-popup drops its `open` attribute however it closes (outside click,
    // Escape, a pick); a native `close` event does not always follow.
    new MutationObserver(() => { if (!p.hasAttribute('open')) pickerClosed(name); })
      .observe(p, { attributes: true, attributeFilter: ['open'] });
    p.addEventListener('close', () => pickerClosed(name));
  };
  const grid = document.createElement('div');
  grid.className = 'swatch-grid';
  grid.setAttribute('role', 'radiogroup');
  grid.dataset.i18nAttr = 'aria-label=tool.color';
  grid.append(
    ...PALETTE.map(([v, t]) => swatchItem(v, t, v)),
    swatchItem('custom', 'color.custom', 'conic-gradient(from 90deg, #f24822, #ffcd29, #14ae5c, #2fc6b8, #0d99ff, #9747ff, #f849c1, #f24822)'),
  );
  make('color', 'tool.color', grid);
  // Stroke: weight and line style together, like FigJam's stroke picker.
  const sep = document.createElement('span');
  sep.className = 'picker-sep';
  sep.setAttribute('aria-hidden', 'true');
  make('weight', 'tool.stroke',
    pickBelt('weight', 'weight.group', WEIGHTS.map((v) => [v, `weight.${v}`, glyph(`weight${v}`), ` · ${v}`])),
    sep,
    pickBelt('dash', 'dash.group', DASHES.map(([v, g]) => [v, `dash.${v}`, glyph(g)])),
  );
  make('kind', 'tool.kind', pickBelt('kind', 'tool.kind', KINDS.map(([v, g]) => [v, `kind.${v}`, glyph(g)])));
  make('startCap', 'tool.start', pickBelt('startCap', 'tool.start', CAPS.map(([v, g]) => [v, `cap.${v}`, glyph(g)])));
  make('endCap', 'tool.end', pickBelt('endCap', 'tool.end', CAPS.map(([v, g]) => [v, `cap.${v}`, glyph(g)])));
}

// ------------------------------------------------------------------ state

let state = null;
let fonts = [];

const editingConnectors = () => !!(state && state.connectors.length);

// Flat view of what the style controls edit: the selected connectors (first
// one shown) or the defaults for new connectors.
function current() {
  if (editingConnectors()) {
    const d = state.connectors[0].data;
    return { kind: d.kind, ...d.style, fromSide: d.from.side, toSide: d.to.side, fromT: d.from.t, toT: d.to.t, label: d.label };
  }
  return { kind: state.defaults.kind, ...state.defaults.style };
}

function applyLocal(key, value) {
  if (editingConnectors()) {
    for (const c of state.connectors) {
      const d = c.data;
      if (STYLE_KEYS.includes(key)) d.style[key] = value;
      else if (key === 'kind' || key === 'label') d[key] = value;
      else if (key === 'fromSide') d.from.side = value;
      else if (key === 'toSide') d.to.side = value;
      else if (key === 'fromT') d.from.t = value;
      else if (key === 'toT') d.to.t = value;
    }
  } else if (key === 'kind') state.defaults.kind = value;
  else if (key !== 'label') state.defaults.style[key] = value;
}

// One edit → one message: a patch for the selected connectors, or the new
// defaults. `changes` may hold several keys (e.g. both arrow ends at once).
function sendMany(changes) {
  if (!state) return;
  for (const [k, v] of Object.entries(changes)) applyLocal(k, v);
  if (editingConnectors()) {
    const patch = {};
    for (const [k, v] of Object.entries(changes)) {
      if (STYLE_KEYS.includes(k)) (patch.style ||= {})[k] = v;
      else patch[k] = v;
    }
    post({ type: 'patch', ids: state.connectors.map((c) => c.id), patch });
  } else {
    post({ type: 'defaults', defaults: JSON.parse(JSON.stringify(state.defaults)) });
  }
  paint();
}
const send = (key, value) => sendMany({ [key]: value });

function throttle(fn, ms) {
  let timer = 0;
  let args = null;
  return (...a) => {
    args = a;
    if (timer) return;
    timer = setTimeout(() => {
      timer = 0;
      fn(...args);
    }, ms);
  };
}

// ------------------------------------------------------------------ controls

const isFocused = (el) => el === document.activeElement || el.contains(document.activeElement);

function setValue(el, value) {
  if (value === undefined || value === null) return;
  const v = String(value);
  if (el.getAttribute('value') !== v && !isFocused(el)) el.setAttribute('value', v);
}

function setChecked(el, on) {
  if (el.hasAttribute('checked') !== !!on) el.toggleAttribute('checked', !!on);
}

const eventValue = (e, el) => {
  const d = e.detail;
  if (d && typeof d === 'object' && 'value' in d) return d.value;
  if (typeof d === 'string' || typeof d === 'number') return d;
  return el.value;
};

let advancedOpen = false;
function setAdvanced(open) {
  advancedOpen = open;
  $('advanced').hidden = !open;
  $('moreToggle').setAttribute('aria-expanded', String(open));
  try {
    localStorage.setItem('autoflow.advanced', open ? '1' : '0');
  } catch {
    // Storage may be unavailable in the plugin iframe; the toggle still works.
  }
}

// Side picker: FigUI3's origin grid. Its handle snaps to a side's midpoint
// (top, right, bottom, left) or to the centre, which means automatic.
const SIDE_VALUE = { auto: '50% 50%', top: '50% 0%', right: '100% 50%', bottom: '50% 100%', left: '0% 50%' };

function sideAt(x, y) {
  const dx = Number(x) - 50;
  const dy = Number(y) - 50;
  if (!isFinite(dx) || !isFinite(dy) || (Math.abs(dx) < 25 && Math.abs(dy) < 25)) return 'auto';
  if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? 'top' : 'bottom';
  return dx < 0 ? 'left' : 'right';
}

function markPort(key, value) {
  const side = SIDE_VALUE[value] ? value : 'auto';
  for (const grid of document.querySelectorAll(`.port[data-port="${key}"]`)) {
    if (grid.getAttribute('value') !== SIDE_VALUE[side]) grid.setAttribute('value', SIDE_VALUE[side]);
    grid.dataset.side = side;
  }
  for (const cap of document.querySelectorAll(`.port-caption[data-caption="${key}"]`)) {
    cap.textContent = t(`side.${side}`);
  }
}

function setPort(key, side) {
  if (key === 'planFrom') planFrom = side;
  else if (key === 'planTo') planTo = side;
  else send(key, side); // fromSide / toSide on the selected connectors
  markPort(key, side);
  if (state && (key === 'planFrom' || key === 'planTo')) render();
}

function bindPorts() {
  for (const grid of document.querySelectorAll('.port[data-port]')) {
    grid.addEventListener('change', (e) => {
      const d = e.detail || {};
      setPort(grid.dataset.port, sideAt(d.x, d.y));
    });
  }
}

let openPicker = null;
let lastClosed = { name: '', at: 0 };

const pickerOf = (name) => document.querySelector(`.picker[data-for="${name}"]`);
const triggerOf = (name) => document.querySelector(`#toolbar fig-toolbelt-item[data-picker="${name}"]`);

// The toolbelt item stays selected while its picker is open.
function showPicker(name) {
  closePicker();
  const picker = pickerOf(name);
  const trigger = triggerOf(name);
  openPicker = name;
  $('toolbar').setAttribute('value', name);
  trigger.setAttribute('aria-expanded', 'true');
  picker.setAttribute('open', '');
  requestAnimationFrame(() => {
    const on = picker.querySelector('fig-toolbelt-item[selected], .pick[aria-checked="true"]') || picker.querySelector('.pick');
    on?.focus();
  });
}

function closePicker() {
  if (openPicker) pickerOf(openPicker).removeAttribute('open');
}

// fig-popup closes itself on outside click and Escape (and restores focus).
function pickerClosed(name) {
  if (openPicker !== name) return;
  openPicker = null;
  lastClosed = { name, at: Date.now() };
  triggerOf(name).setAttribute('aria-expanded', 'false');
  $('toolbar').setAttribute('value', '');
}

// Arrows move through the color grid (Up/Down by row); the icon pickers are
// toolbelts and navigate themselves. Tab leaves.
function pickerKeys(e, picker) {
  if (e.key === 'Tab') return closePicker();
  if (picker.dataset.for !== 'color') {
    if (e.key === 'Enter' || e.key === ' ') {
      const item = e.target.closest('fig-toolbelt-item');
      if (item) applyPick(picker.dataset.for, item.closest('fig-toolbelt').dataset.belt, item.getAttribute('value'));
    }
    return;
  }
  const items = Array.from(picker.querySelectorAll('.pick'));
  const i = items.indexOf(document.activeElement);
  const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 11, ArrowUp: -11 }[e.key];
  if (step) {
    e.preventDefault();
    items[Math.max(0, Math.min(items.length - 1, (i < 0 ? 0 : i) + step))].focus();
  } else if (e.key === 'Home' || e.key === 'End') {
    e.preventDefault();
    items[e.key === 'Home' ? 0 : items.length - 1].focus();
  }
}

// `belt` names the value inside the picker (the stroke picker holds two).
function applyPick(name, belt, value) {
  switch (belt) {
    case 'color':
      if (value === 'custom') {
        closePicker();
        setAdvanced(true);
        document.querySelector('#advanced fig-input-color[data-key=color] input[type=text]')?.focus();
        return;
      }
      if (normalizeHex(value)) send('color', normalizeHex(value));
      break;
    case 'weight':
      send('weight', Number(value));
      return; // two groups (weight, line style): stay open so both can be set
    case 'dash':
      send('dash', value);
      return;
    default:
      send(belt, value);
  }
  closePicker();
}

// T works like FigJam's: adds a label (or jumps to it) and puts the caret there.
function textTool() {
  if (!editingConnectors()) return;
  if (!current().label) send('label', t('label.default'));
  const input = $('labelText').querySelector('input');
  input?.focus();
  input?.select();
}

function bindToolbar() {
  const bar = $('toolbar');
  // Selecting an item (click, Enter, Space) opens its picker. Clicking the
  // open one again closes it: the popup closes on that outside pointerdown and
  // the guard below keeps the click from reopening it.
  bar.addEventListener('change', () => {
    const name = bar.getAttribute('value') || '';
    if (name === 'text') { textTool(); bar.setAttribute('value', ''); return; }
    if (!name || name === openPicker) return;
    if (lastClosed.name === name && Date.now() - lastClosed.at < 300) { bar.setAttribute('value', ''); return; }
    showPicker(name);
  });
  for (const picker of document.querySelectorAll('.picker')) {
    picker.addEventListener('click', (e) => {
      const item = e.target.closest('.pick');
      if (!item) return;
      const belt = item.closest('fig-toolbelt');
      applyPick(picker.dataset.for, belt ? belt.dataset.belt : 'color', item.getAttribute('value') ?? item.dataset.value);
    });
    picker.addEventListener('keydown', (e) => pickerKeys(e, picker));
  }


  $('labelRemove').addEventListener('click', () => {
    if (editingConnectors()) send('label', '');
    $('textTool').focus();
  });
  $('moreToggle').addEventListener('click', () => setAdvanced(!advancedOpen));
}

function bindControls() {
  for (const el of document.querySelectorAll('fig-select[data-key]')) {
    el.addEventListener('change', (e) => {
      const v = eventValue(e, el);
      if (v !== undefined && v !== null && v !== '') send(el.dataset.key, String(v));
    });
  }

  for (const el of document.querySelectorAll('fig-input-number[data-key]')) {
    const key = el.dataset.key;
    const percent = key === 'fromT' || key === 'toT';
    const min = Number(el.getAttribute('min') ?? 0);
    const max = Number(el.getAttribute('max') ?? Infinity);
    el.addEventListener('change', (e) => {
      const n = parseNumber(eventValue(e, el), min, max);
      if (n === null) {
        // Empty or invalid: restore the last good value.
        const v = current()[key];
        el.setAttribute('value', String(percent ? Math.round(v * 100) : v));
        return;
      }
      send(key, percent ? n / 100 : n);
    });
  }

  for (const el of document.querySelectorAll('fig-input-color[data-key]')) {
    const key = el.dataset.key;
    // Only the inline hex field; the fill picker dialog (also inside el) handles its own.
    const isHexField = (t) => t instanceof HTMLInputElement && t.type === 'text' && el.contains(t) && !t.closest('fig-fill-picker');
    // Hex typed in the text field: validate it ourselves (3 or 6 digits) before
    // FigUI3 parses it, since it turns "#f24" into a fallback grey.
    const commitText = (field) => {
      const hex = normalizeHex(field.value);
      const next = hex || current()[key];
      el.setAttribute('value', next);
      field.value = next.slice(1).toUpperCase();
      field.toggleAttribute('aria-invalid', !hex);
      if (hex && hex !== current()[key]) send(key, hex);
    };
    const intercept = (e) => {
      if (!isHexField(e.target)) return;
      e.stopImmediatePropagation();
      if (e.type !== 'input') commitText(e.target); // commit on change / Enter only
    };
    el.addEventListener('input', intercept, true);
    el.addEventListener('change', intercept, true);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && isHexField(e.target)) intercept(e);
    }, true);
    // Swatch / Figma fill picker: FigUI3's own events on the host.
    const commitPicker = (e) => {
      if (e.target !== el) return;
      const d = e.detail || {};
      const hex = normalizeHex(d.color ?? d.hex ?? d.value);
      if (hex && hex !== current()[key]) send(key, hex);
    };
    el.addEventListener('input', throttle(commitPicker, 80));
    el.addEventListener('change', commitPicker);
  }

  for (const el of document.querySelectorAll('fig-switch[data-key]')) {
    el.addEventListener('change', (e) => {
      const on = e.detail && typeof e.detail.checked === 'boolean' ? e.detail.checked : el.hasAttribute('checked');
      send(el.dataset.key, on);
    });
  }

  const labelText = $('labelText');
  labelText.addEventListener('input', throttle(() => {
    if (!editingConnectors()) return;
    const value = String(labelText.value ?? '');
    applyLocal('label', value);
    post({ type: 'patch', ids: state.connectors.map((c) => c.id), patch: { label: value } });
  }, 250));

  $('fontFamily').addEventListener('change', (e) => {
    const family = String(eventValue(e, $('fontFamily')) || '');
    if (!family) return;
    const styles = stylesOf(family);
    const want = current().labelFont.style;
    const style = styles.includes(want) ? want : styles.includes('Regular') ? 'Regular' : styles[0] || want;
    send('labelFont', { family, style });
    renderFonts();
  });
  $('fontStyle').addEventListener('change', (e) => {
    const style = String(eventValue(e, $('fontStyle')) || '');
    if (style) send('labelFont', { family: current().labelFont.family, style });
  });
}

// ------------------------------------------------------------------ fonts

const stylesOf = (family) => (fonts.find((f) => f.family === family) || { styles: [] }).styles;

let fontsRendered = '';
function renderFonts() {
  if (!state) return;
  const { family, style } = current().labelFont;
  const families = fonts.map((f) => f.family);
  if (!families.includes(family)) families.unshift(family);
  const famSel = $('fontFamily');
  const key = families.length + '|' + family;
  if (fontsRendered !== key) {
    fillSelect(famSel, families.map((f) => [f, f]));
    fontsRendered = key;
  }
  setValue(famSel, family);
  const styles = stylesOf(family).slice();
  if (!styles.includes(style)) styles.unshift(style);
  fillSelect($('fontStyle'), styles.map((s) => [s, s]));
  setValue($('fontStyle'), style);
}

// ------------------------------------------------------------------ painting

function markBelt(belt, value) {
  const el = document.querySelector(`.pick-belt[data-belt="${belt}"]`);
  if (el && el.getAttribute('value') !== String(value)) el.setAttribute('value', String(value));
}

function markColor(value) {
  for (const item of pickerOf('color').querySelectorAll('.pick')) {
    const on = item.dataset.value === value;
    item.setAttribute('aria-checked', String(on));
    item.querySelector('fig-swatch').toggleAttribute('selected', on);
  }
}

function setGlyph(id, name, label) {
  const el = $(id);
  if (el.dataset.glyph !== name) {
    el.dataset.glyph = name;
    el.replaceChildren(glyph(name));
  }
  el.closest('fig-toolbelt-item').setAttribute('aria-label', label);
}

function paintToolbar(v) {
  const color = normalizeHex(v.color) || '#000000';
  $('colorDot').style.background = color;
  const preset = PALETTE.find(([c]) => c === color);
  const colorName = preset ? t(preset[1]) : color.toUpperCase();
  triggerOf('color').setAttribute('aria-label', t('tool.colorIs', { name: colorName }));
  markColor(preset ? color : 'custom');
  const dash = (DASHES.find(([d]) => d === v.dash) || DASHES[0])[0];
  markBelt('weight', v.weight);
  markBelt('dash', v.dash);
  triggerOf('weight').setAttribute('aria-label', t('tool.strokeIs', { w: v.weight, dash: t(`dash.${dash}`).toLowerCase() }));

  const kind = KINDS.find(([k]) => k === v.kind) || KINDS[0];
  setGlyph('kindGlyph', kind[1], t('is', { title: t('tool.kind'), value: t(`kind.${kind[0]}`) }));
  markBelt('kind', v.kind);

  for (const [key, id, title] of [['startCap', 'startGlyph', 'tool.start'], ['endCap', 'endGlyph', 'tool.end']]) {
    const cap = CAPS.find(([c]) => c === v[key]) || CAPS[1];
    setGlyph(id, cap[1], t('is', { title: t(title), value: t(`cap.${cap[0]}`) }));
    markBelt(key, cap[0]);
  }
}

// Push the edited model into every control.
function paint() {
  if (!state) return;
  const v = current();
  const conn = editingConnectors();
  paintToolbar(v);

  for (const el of document.querySelectorAll('fig-select[data-key]')) setValue(el, v[el.dataset.key]);
  for (const el of document.querySelectorAll('fig-input-number[data-key]')) {
    const key = el.dataset.key;
    const val = v[key];
    if (val !== undefined) setValue(el, key === 'fromT' || key === 'toT' ? Math.round(val * 100) : val);
  }
  for (const el of document.querySelectorAll('fig-input-color[data-key]')) setValue(el, v[el.dataset.key]);
  for (const el of document.querySelectorAll('fig-switch[data-key]')) setChecked(el, v[el.dataset.key]);
  for (const el of document.querySelectorAll('[data-only]')) el.hidden = v.kind !== el.dataset.only;
  for (const el of document.querySelectorAll('[data-tside]')) el.hidden = v[`${el.dataset.tside}Side`] === 'auto';
  $('anchorsHead').hidden = v.fromSide === 'auto' && v.toSide === 'auto';
  markPort('planFrom', planFrom);
  markPort('planTo', planTo);
  if (conn) {
    markPort('fromSide', v.fromSide);
    markPort('toSide', v.toSide);
  }

  // Label: added with the T tool on connectors; its typography is always a default.
  const hasLabel = conn && !!v.label;
  const many = conn && state.connectors.length > 1;
  $('textTool').classList.toggle('is-on', hasLabel);
  $('labelRow').hidden = !hasLabel;
  $('labelStyle').hidden = conn && !hasLabel;
  if (hasLabel && !isFocused($('labelText'))) $('labelText').setAttribute('value', many ? '' : v.label);
  $('labelText').setAttribute('placeholder', many ? t('label.phMany') : t('label.ph'));
  renderFonts();
  renderPresets();
}

// Order the paste will use: click order (from the plugin), optionally reversed.
let reversed = false;
let orderKey = '';
function orderedNodes() {
  const key = state.nodes.map((n) => n.id).join(',');
  if (key !== orderKey) {
    orderKey = key;
    reversed = false; // a new selection starts in click order
  }
  return reversed ? state.nodes.slice().reverse() : state.nodes.slice();
}

const linkMode = () => $('linkMode').getAttribute('value') || 'chain';

function pairsOf(nodes) {
  if (nodes.length < 2) return [];
  if (nodes.length === 2) return [[nodes[0], nodes[1]]];
  return linkMode() === 'fan'
    ? nodes.slice(1).map((n) => [nodes[0], n])
    : nodes.slice(1).map((n, i) => [nodes[i], n]);
}

const MAX_LINKS = 6;
function renderLinks(nodes) {
  const pairs = pairsOf(nodes);
  const shown = pairs.length > MAX_LINKS ? pairs.slice(0, MAX_LINKS - 1) : pairs;
  const rows = shown.map(([a, b]) => {
    const li = document.createElement('li');
    li.className = 'link';
    const from = document.createElement('span');
    from.className = 'link-name';
    from.textContent = a.name;
    const arrow = glyph('capArrow');
    arrow.classList.add('link-arrow');
    const to = document.createElement('span');
    to.className = 'link-name';
    to.textContent = b.name;
    li.setAttribute('aria-label', t('link.item', { a: a.name, b: b.name }));
    li.append(from, arrow, to);
    return li;
  });
  if (shown.length < pairs.length) {
    const more = document.createElement('li');
    more.className = 'link link-more';
    more.textContent = t('links.more', { n: pairs.length - shown.length });
    rows.push(more);
  }
  $('linkList').replaceChildren(...rows);
}

// Sides the new connector leaves and enters by (kept for the session, so a
// series of connectors can all go right → left).
let planFrom = 'auto';
let planTo = 'auto';

// The plugin creates on Conectar or on a paste, so it needs the order, link
// mode and sides beforehand.
let lastPlan = '';
function sendPlan(nodes) {
  const plan = { order: nodes.map((n) => n.id), mode: linkMode(), fromSide: planFrom, toSide: planTo };
  const key = JSON.stringify(plan);
  if (key === lastPlan) return;
  lastPlan = key;
  post({ type: 'plan', ...plan });
}

function fillSlot(slot, nameEl, node, placeholder, next) {
  nameEl.textContent = node ? node.name : placeholder;
  slot.classList.toggle('is-filled', !!node);
  slot.classList.toggle('is-next', !node && next);
}

// One card for the whole flow: origin → target fill in as the user clicks,
// and the action row names the single thing left to do.
function renderCreate() {
  const nodes = orderedNodes();
  const n = nodes.length;
  const pairs = pairsOf(nodes).length;

  $('route').hidden = n > 2;
  $('many').hidden = n <= 2;
  $('hTool').textContent = n > 2 ? t('new.many', { n: pairs }) : t('new.title');
  $('reverseBtn').toggleAttribute('disabled', n < 2);
  fillSlot($('slotFrom'), $('slotFromName'), nodes[0], t('slot.click'), true);
  fillSlot($('slotTo'), $('slotToName'), nodes[1], t('slot.shift'), n === 1);
  if (n > 2) renderLinks(nodes);
  sendPlan(nodes);

  // Copied in this panel session: the clipboard may hold something else
  // after a restart, so the panel offers to copy again each time it opens.
  const ready = n >= 2;
  $('pastePrompt').hidden = !copied || !ready;
  $('pasteText').textContent = pairs > 1 ? t('paste.many', { n: pairs }) : t('paste.one');
  if (!copyFlash) $('copyBtn').textContent = copied ? t('copy.again') : t('copy');
  $('nextHint').textContent = !copied
    ? t('hint.copy')
    : ready
      ? t('hint.again')
      : n === 1
        ? t('hint.target')
        : t('hint.source');
}

function render() {
  const s = state;
  const conns = s.connectors.length;
  $('count').textContent = plural(t, 'count', s.stats.total);
  $('brokenRow').hidden = !s.stats.broken;
  $('brokenText').textContent = plural(t, 'broken', s.stats.broken);

  $('pageEmpty').hidden = !!s.stats.broken;

  $('secTool').hidden = !!conns;
  renderCreate();

  $('secConn').hidden = !conns;
  $('resetDefaults').hidden = !!conns;
  $('styleTitle').textContent = conns ? t('style.conn') : t('style.new');
  for (const el of document.querySelectorAll('[data-conn-only]')) el.hidden = !conns;

  if (conns) {
    const c = s.connectors[0];
    const many = conns > 1;
    $('connTitle').textContent = many ? t('conn.many', { n: conns }) : c.data.broken ? t('conn.loose') : t('conn.title');
    $('connFrom').classList.toggle('is-filled', many || !!c.data.from.id);
    $('connTo').classList.toggle('is-filled', many || !!c.data.to.id);
    $('fromName').textContent = many ? t('several') : c.fromName;
    $('toName').textContent = many ? t('several') : c.toName;
    $('selFrom').toggleAttribute('disabled', many || !c.data.from.id);
    $('selTo').toggleAttribute('disabled', many || !c.data.to.id);
    document.querySelector('#connMenu fig-menu-item[value="defaults-from"]').toggleAttribute('disabled', many);
  }
  paint();
}

// ------------------------------------------------------------------ saved styles
//
// Named styles kept per user by the plugin (client storage). A click applies
// one: to the selected connectors, or as the style of new connectors.

const styleOf = (v) => Object.fromEntries(STYLE_KEYS.map((k) => [k, v[k]]));
const lookKey = (kind, style) => JSON.stringify([kind, ...STYLE_KEYS.map((k) => style[k])]);

// A short line drawn with the preset's color, weight, dash and end cap.
function presetPreview(p) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 28 12');
  svg.setAttribute('width', '28');
  svg.setAttribute('height', '12');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('preset-line');
  const w = Math.min(3, Math.max(1, p.style.weight));
  const line = document.createElementNS(NS, 'path');
  line.setAttribute('d', 'M2 6H25');
  line.style.stroke = p.style.color; // inline: beats the panel's icon stroke rules
  line.setAttribute('stroke-width', String(w));
  line.setAttribute('stroke-linecap', 'round');
  if (p.style.dash === 'dash') line.setAttribute('stroke-dasharray', `${w * 3} ${w * 2}`);
  if (p.style.dash === 'dot') line.setAttribute('stroke-dasharray', `0.1 ${w * 2.5}`);
  svg.append(line);
  if (p.style.endCap !== 'none') {
    const head = document.createElementNS(NS, 'path');
    head.setAttribute('d', 'M21 2.5 25.5 6 21 9.5');
    head.setAttribute('fill', 'none');
    head.style.stroke = p.style.color;
    head.setAttribute('stroke-width', String(Math.min(2, w)));
    head.setAttribute('stroke-linecap', 'round');
    head.setAttribute('stroke-linejoin', 'round');
    svg.append(head);
  }
  return svg;
}

let presetsRendered = '';
function renderPresets() {
  const list = (state && state.presets) || [];
  const v = current();
  const now = lookKey(v.kind, v);
  const formOpen = !$('presetForm').hidden;
  $('presetAdd').hidden = formOpen;
  $('presetEmpty').hidden = list.length > 0 || formOpen;
  const target = editingConnectors() ? t('presets.toSelection') : t('presets.toNew');
  const key = JSON.stringify([list, now, target]);
  if (key === presetsRendered) return;
  presetsRendered = key;
  $('presetList').replaceChildren(...list.map((p) => {
    const li = document.createElement('li');
    li.className = 'preset';
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'preset-apply';
    apply.dataset.id = p.id;
    apply.title = `${target}: ${p.name}`;
    apply.setAttribute('aria-pressed', String(lookKey(p.kind, p.style) === now));
    const name = document.createElement('span');
    name.className = 'preset-name';
    name.textContent = p.name;
    apply.append(presetPreview(p), name);
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'preset-delete';
    del.dataset.id = p.id;
    del.title = t('presets.deleteTitle', { name: p.name });
    del.setAttribute('aria-label', t('presets.deleteAria', { name: p.name }));
    del.append(glyph('minus'));
    li.append(apply, del);
    return li;
  }));
}

function openPresetForm(open) {
  $('presetForm').hidden = !open;
  presetsRendered = '';
  renderPresets();
  if (open) {
    const input = $('presetName').querySelector('input');
    $('presetName').setAttribute('value', '');
    if (input) { input.value = ''; input.focus(); }
  } else {
    $('presetAdd').focus();
  }
}

async function savePreset() {
  const input = $('presetName').querySelector('input');
  const name = String((input && input.value) || $('presetName').value || '').trim();
  const v = current();
  const res = await request({ type: 'preset-save', name, preset: { kind: v.kind, style: styleOf(v) } });
  announce(res.message);
  if (res.ok) openPresetForm(false);
}

function bindPresets() {
  $('presetAdd').addEventListener('click', () => openPresetForm(true));
  $('presetCancel').addEventListener('click', () => openPresetForm(false));
  $('presetSave').addEventListener('click', savePreset);
  $('presetName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); savePreset(); }
    if (e.key === 'Escape') { e.preventDefault(); openPresetForm(false); }
  });
  $('presetList').addEventListener('click', (e) => {
    const apply = e.target.closest('.preset-apply');
    const del = e.target.closest('.preset-delete');
    const p = state && state.presets.find((x) => x.id === (apply || del || {}).dataset?.id);
    if (!p) return;
    if (apply) {
      sendMany({ kind: p.kind, ...JSON.parse(JSON.stringify(p.style)) });
      toast(t('presets.applied', { name: p.name }));
    } else {
      request({ type: 'preset-delete', id: p.id }).then(() => toast(t('presets.deleted', { name: p.name })));
    }
  });
}

// ------------------------------------------------------------------ actions

function setLoading(btn, on) {
  if (on) {
    btn.setAttribute('aria-busy', 'true');
    btn.setAttribute('disabled', '');
    if (!btn.hasAttribute('icon')) {
      const spinner = document.createElement('fig-spinner');
      spinner.setAttribute('aria-label', 'Procesando');
      btn.prepend(spinner);
    }
  } else {
    btn.removeAttribute('aria-busy');
    btn.removeAttribute('disabled');
    btn.querySelector('fig-spinner')?.remove();
  }
}

// Runs a tracked action: loading state on the button, always re-enabled.
async function run(btn, msg) {
  if (btn.getAttribute('aria-busy') === 'true') return;
  setLoading(btn, true);
  try {
    const res = await request(msg);
    announce(res.message);
  } catch (err) {
    announce(String(err && err.message ? err.message : err));
  } finally {
    setLoading(btn, false);
    if (state) render();
  }
}

let copied = false;
let copyFlash = 0; // the button says "Copiado" for a moment after each copy
function copyConnector() {
  if (!copyPayload()) {
    announce(t('copyFailed'));
    return false;
  }
  copied = true;
  clearTimeout(copyFlash);
  $('copyBtn').textContent = t('copied');
  copyFlash = setTimeout(() => {
    copyFlash = 0;
    if (state) render();
  }, 1200);
  toast(t('toast.copied'));
  if (state) render();
  return true;
}

const ids = () => (state ? state.connectors.map((c) => c.id) : []);

function bindActions() {
  $('reverseBtn').addEventListener('click', () => {
    reversed = !reversed;
    [planFrom, planTo] = [planTo, planFrom];
    render();
  });
  $('linkMode').addEventListener('change', () => { if (state) render(); });
  $('copyBtn').addEventListener('click', copyConnector);
  $('showBroken').addEventListener('click', () => run($('showBroken'), { type: 'select-broken' }));
  bindPorts();
  bindPresets();
  $('cleanBtn').addEventListener('click', () => run($('cleanBtn'), { type: 'clean' }));
  $('swapBtn').addEventListener('click', () => run($('swapBtn'), { type: 'swap', ids: ids() }));
  $('resetDefaults').addEventListener('click', () => run($('resetDefaults'), { type: 'reset-defaults' }));
  for (const [id, which] of [['selFrom', 'from'], ['selTo', 'to']]) {
    $(id).addEventListener('click', () => {
      request({ type: 'select', id: ids()[0], which }).then((res) => announce(res.message));
    });
  }
  $('connMenu').addEventListener('change', (e) => {
    if (e.target !== $('connMenu')) return;
    const trigger = $('connMenu').querySelector('fig-button');
    const action = String(eventValue(e, $('connMenu')));
    if (action === 'prototype') run(trigger, { type: 'prototype', ids: ids() });
    else if (action === 'defaults-from') run(trigger, { type: 'defaults-from', id: ids()[0] });
    else if (action === 'delete') run(trigger, { type: 'delete', ids: ids() });
  });
}

// ------------------------------------------------------------------ sizing

let lastHeight = 0;
const reportHeight = throttle(() => {
  const h = Math.ceil($('app').scrollHeight);
  if (Math.abs(h - lastHeight) < 2) return;
  lastHeight = h;
  post({ type: 'resize', height: h });
}, 50);

// ------------------------------------------------------------------ boot

function boot() {
  for (const el of document.querySelectorAll('[data-icon]')) {
    if (!el.firstChild) {
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = ICONS[el.dataset.icon] || GLYPHS[el.dataset.icon] || '';
    }
  }
  buildPickers();
  bindToolbar();
  bindControls();
  bindActions();
  applyText();
  post({ type: 'env', paste: PASTE });
  let open = false;
  try {
    open = localStorage.getItem('autoflow.advanced') === '1';
  } catch {
    // No storage: start collapsed.
  }
  setAdvanced(open);

  window.addEventListener('message', (e) => {
    const msg = e.data && e.data.pluginMessage;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'state') {
      state = msg;
      render();
    } else if (msg.type === 'fonts') {
      fonts = Array.isArray(msg.fonts) ? msg.fonts : [];
      fontsRendered = '';
      renderFonts();
    } else if (msg.type === 'result') {
      const done = pending.get(msg.requestId);
      if (done) {
        pending.delete(msg.requestId);
        done(msg);
      }
    }
  });
  new ResizeObserver(reportHeight).observe($('app'));
  post({ type: 'ready' });
}

boot();
