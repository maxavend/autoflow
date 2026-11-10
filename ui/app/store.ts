// Panel state and the message contract with src/code.ts:
//   plugin → UI: state, fonts, result
//   UI → plugin: env, ready, plan, patch, copied, swap,
//                delete, select, select-broken, prototype, prototype-arrows, defaults,
//                defaults-from, reset-defaults, preset-save, preset-delete,
//                clean, resize
//                (all but env/plan/copied/resize carry requestId)
// Module state plus a version counter: components read it through useStore()
// and every change ends in paint(), like the imperative panel it replaces.
import { useSyncExternalStore } from 'react';
import { plural, translator } from '../messages.js';
import { normalizeHex, parseNumber } from '../validate.js';
// A FigJam connector as Figma writes it to the clipboard, marked autoflow/seed.
// Pasting it into a Design file creates a native CONNECTOR the plugin adopts.
import PAYLOAD from '../connector-payload.html';

/* eslint-disable @typescript-eslint/no-explicit-any -- plugin payloads are validated by src/ */
export type Side = 'auto' | 'top' | 'right' | 'bottom' | 'left';
export type PortKey = 'planFrom' | 'planTo' | 'fromSide' | 'toSide';
export interface FontRef { family: string; style: string }
export interface Style {
  color: string; opacity: number; weight: number; dash: string; startCap: string; endCap: string;
  radius: number; labelColor: string; labelSize: number; labelFont: FontRef;
}
export interface Preset { id: string; name: string; kind: string; style: Style }
export interface NodeRef { id: string; name: string; type?: string }
export interface Connector {
  id: string; fromName: string; toName: string;
  data: { from: { id: string; side: Side; t: number }; to: { id: string; side: Side; t: number }; kind: string; style: Style; label: string; broken: boolean };
}
export interface PanelState {
  type: 'state';
  nodes: NodeRef[];
  connectors: Connector[];
  stats: { total: number; broken: number; linked?: number; inSelection?: number };
  defaults: { kind: string; style: Style };
  presets: Preset[];
  prototypeSource?: boolean;
  prototypePaste?: number;
}
export type View = Style & { kind: string; fromSide?: Side; toSide?: Side; fromT?: number; toT?: number; label?: string };
interface Result { ok: boolean; message?: string }

// ------------------------------------------------------------------ text
//
// Every string lives in messages.js. The paste shortcut follows the platform.
export const PASTE = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘V' : 'Ctrl+V';
export const t: (key: string, vars?: Record<string, unknown>) => string = translator({ paste: PASTE });
// '1 connector' / '3 connectors'
export const tPlural = (key: string, n: number) => plural(t, key, n);

// ------------------------------------------------------------------ static data

// Toolbar pickers. Colors are connector values, not UI chrome: FigJam's
// palette, saturated row over its light row.
export const PALETTE: [string, string][] = [
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
export const WEIGHTS = [1, 2, 4, 6];
export const DASHES: [string, string][] = [
  ['solid', 'strokeSolid'],
  ['dash', 'strokeDash'],
  ['dot', 'strokeDot'],
];
export const KINDS: [string, string][] = [
  ['elbow', 'elbow'],
  ['curve', 'curve'],
  ['straight', 'straight'],
];
// Line ends, one picker per end like FigJam. The official cap glyphs face
// the start of the line; the end picker mirrors them.
export const CAPS: [string, string][] = [
  ['none', 'strokeSolid'],
  ['arrow', 'capArrow'],
  ['triangle', 'capTriangle'],
  ['circle', 'capCircle'],
  ['diamond', 'capDiamond'],
];
const STYLE_KEYS = ['color', 'opacity', 'weight', 'dash', 'startCap', 'endCap', 'radius', 'labelColor', 'labelSize', 'labelFont'];

// Shown until the plugin's first state arrives (same values as src/model.ts DEFAULTS).
const FALLBACK: View = {
  kind: 'elbow', color: '#0d99ff', opacity: 1, weight: 2, dash: 'solid', startCap: 'none', endCap: 'arrow',
  radius: 12, labelColor: '#1e1e1e', labelSize: 12, labelFont: { family: 'Inter', style: 'Medium' },
};

// ------------------------------------------------------------------ store

export const S = {
  state: null as PanelState | null,
  fonts: [] as { family: string; styles: string[] }[],
  // Sides the new connector leaves and enters by (kept for the session, so a
  // series of connectors can all go right → left).
  planFrom: 'auto' as Side,
  planTo: 'auto' as Side,
  // Order the paste will use: click order (from the plugin), optionally reversed.
  reversed: false,
  orderKey: '',
  linkMode: 'chain' as 'chain' | 'fan',
  // Copied in this panel session: the clipboard may hold something else
  // after a restart, so the panel offers to copy again each time it opens.
  copied: false,
  copyFlash: false, // the button says "Copied" for a moment after each copy
  pasteNudge: 0, // replays the ⌘V prompt's flash on every copy
  advanced: false,
  presetForm: false,
  busy: {} as Record<string, boolean>,
  picker: null as string | null,
  afterPicker: null as string | null, // field to focus once the picker has closed
  status: '',
  toast: { text: '', key: 0 },
};

let version = 0;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export function paint() {
  version++;
  for (const fn of listeners) fn();
}
export const useStore = () => useSyncExternalStore(subscribe, () => version);

// ------------------------------------------------------------------ messaging

const pending = new Map<string, (res: Result) => void>();
let seq = 0;

export function post(msg: Record<string, unknown>) {
  parent.postMessage({ pluginMessage: msg }, '*');
}

// Sends a message and resolves with the plugin's { ok, message } result.
// Never hangs: a missing reply resolves as an error after a timeout.
export function request(msg: Record<string, unknown>, timeout = 20000): Promise<Result> {
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

// Brief confirmation inside the panel.
export function toast(text: string) {
  S.toast = { text, key: S.toast.key + 1 };
  paint();
}

export function announce(text?: string) {
  S.status = text || '';
  paint();
}

export function onPluginMessage(msg: any) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'state') {
    S.state = msg;
    const key = (msg.nodes || []).map((n: NodeRef) => n.id).join(',');
    if (key !== S.orderKey) {
      S.orderKey = key;
      S.reversed = false; // a new selection starts in click order
    }
    paint();
  } else if (msg.type === 'fonts') {
    S.fonts = Array.isArray(msg.fonts) ? msg.fonts : [];
    paint();
  } else if (msg.type === 'result') {
    const done = pending.get(msg.requestId);
    if (done) {
      pending.delete(msg.requestId);
      done(msg);
    }
  }
}

// ------------------------------------------------------------------ model

export const editingConnectors = () => !!(S.state && S.state.connectors.length);

// Flat view of what the style controls edit: the selected connectors (first
// one shown) or the defaults for new connectors.
export function current(): View {
  const s = S.state;
  if (!s) return FALLBACK;
  if (s.connectors.length) {
    const d = s.connectors[0].data;
    return { kind: d.kind, ...d.style, fromSide: d.from.side, toSide: d.to.side, fromT: d.from.t, toT: d.to.t, label: d.label };
  }
  return { kind: s.defaults.kind, ...s.defaults.style };
}

function applyLocal(key: string, value: any) {
  const s = S.state!;
  if (editingConnectors()) {
    for (const c of s.connectors) {
      const d = c.data as any;
      if (STYLE_KEYS.includes(key)) d.style[key] = value;
      else if (key === 'kind' || key === 'label') d[key] = value;
      else if (key === 'fromSide') d.from.side = value;
      else if (key === 'toSide') d.to.side = value;
      else if (key === 'fromT') d.from.t = value;
      else if (key === 'toT') d.to.t = value;
    }
  } else if (key === 'kind') s.defaults.kind = value;
  else if (key !== 'label') (s.defaults.style as any)[key] = value;
}

// One edit → one message: a patch for the selected connectors, or the new
// defaults. `changes` may hold several keys (e.g. a whole saved style).
export function sendMany(changes: Record<string, any>) {
  const s = S.state;
  if (!s) return;
  for (const [k, v] of Object.entries(changes)) applyLocal(k, v);
  if (editingConnectors()) {
    const patch: Record<string, any> = {};
    for (const [k, v] of Object.entries(changes)) {
      if (STYLE_KEYS.includes(k)) (patch.style ||= {})[k] = v;
      else patch[k] = v;
    }
    post({ type: 'patch', ids: s.connectors.map((c) => c.id), patch });
  } else {
    post({ type: 'defaults', defaults: JSON.parse(JSON.stringify(s.defaults)) });
  }
  paint();
}
export const send = (key: string, value: unknown) => sendMany({ [key]: value });

// The label is typed: sent throttled, without repainting the field being edited.
export function sendLabel(value: string) {
  if (!editingConnectors()) return;
  applyLocal('label', value);
  post({ type: 'patch', ids: S.state!.connectors.map((c) => c.id), patch: { label: value } });
}

// Number fields: empty or invalid restores the last good value (returns false).
export function commitNumber(key: string, raw: unknown, min: number, max: number): boolean {
  const percent = key === 'fromT' || key === 'toT' || key === 'opacity';
  const n = parseNumber(raw, min, max);
  if (n === null) return false;
  const value = percent ? n / 100 : n;
  if ((current() as any)[key] !== value) send(key, value);
  return true;
}

// Hex fields: 3 or 6 digits (8 drops alpha); anything else keeps the current color.
export function commitHex(key: 'color' | 'labelColor', raw: unknown) {
  const hex = normalizeHex(raw);
  if (hex && hex !== current()[key]) send(key, hex);
}

export function throttle<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | 0 = 0;
  let args: A | null = null;
  return (...a: A) => {
    args = a;
    if (timer) return;
    timer = setTimeout(() => {
      timer = 0;
      fn(...(args as A));
    }, ms);
  };
}

// ------------------------------------------------------------------ fonts

export const stylesOf = (family: string) => (S.fonts.find((f) => f.family === family) || { styles: [] as string[] }).styles;

export function fontLists() {
  const { family, style } = current().labelFont;
  const families = S.fonts.map((f) => f.family);
  if (!families.includes(family)) families.unshift(family);
  const styles = stylesOf(family).slice();
  if (!styles.includes(style)) styles.unshift(style);
  return { family, style, families, styles };
}

export function setFamily(family: string) {
  if (!family) return;
  const styles = stylesOf(family);
  const want = current().labelFont.style;
  const style = styles.includes(want) ? want : styles.includes('Regular') ? 'Regular' : styles[0] || want;
  send('labelFont', { family, style });
}

export function setFontStyle(style: string) {
  if (style) send('labelFont', { family: current().labelFont.family, style });
}

// ------------------------------------------------------------------ sides

// Side picker: its handle snaps to a side's midpoint (top, right, bottom,
// left) or to the centre, which means automatic. x and y are 0–100.
export function sideAt(x: number, y: number): Side {
  const dx = Number(x) - 50;
  const dy = Number(y) - 50;
  if (!isFinite(dx) || !isFinite(dy) || (Math.abs(dx) < 25 && Math.abs(dy) < 25)) return 'auto';
  if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? 'top' : 'bottom';
  return dx < 0 ? 'left' : 'right';
}

export function portValue(key: PortKey): Side {
  const v = key === 'planFrom' ? S.planFrom : key === 'planTo' ? S.planTo : current()[key];
  return v && ['auto', 'top', 'right', 'bottom', 'left'].includes(v) ? v : 'auto';
}

export function setPort(key: PortKey, side: Side) {
  if (key === 'planFrom') S.planFrom = side;
  else if (key === 'planTo') S.planTo = side;
  else return send(key, side); // fromSide / toSide on the selected connectors
  paint();
}

// ------------------------------------------------------------------ create

export function orderedNodes(): NodeRef[] {
  const nodes = S.state ? S.state.nodes.slice() : [];
  return S.reversed ? nodes.reverse() : nodes;
}

export function pairsOf(nodes: NodeRef[]): [NodeRef, NodeRef][] {
  if (nodes.length < 2) return [];
  if (nodes.length === 2) return [[nodes[0], nodes[1]]];
  return S.linkMode === 'fan'
    ? nodes.slice(1).map((n) => [nodes[0], n] as [NodeRef, NodeRef])
    : nodes.slice(1).map((n, i) => [nodes[i], n] as [NodeRef, NodeRef]);
}

// The plugin creates on a paste, so it needs the order, link mode and sides beforehand.
let lastPlan = '';
export function sendPlan() {
  if (!S.state) return;
  const plan = { order: orderedNodes().map((n) => n.id), mode: S.linkMode, fromSide: S.planFrom, toSide: S.planTo };
  const key = JSON.stringify(plan);
  if (key === lastPlan) return;
  lastPlan = key;
  post({ type: 'plan', ...plan });
}

export function reverse() {
  S.reversed = !S.reversed;
  [S.planFrom, S.planTo] = [S.planTo, S.planFrom];
  paint();
}

// Puts the connector on the clipboard. Must run inside a click handler.
function copyPayload() {
  const onCopy = (e: ClipboardEvent) => {
    e.clipboardData?.setData('text/html', PAYLOAD);
    e.preventDefault();
  };
  document.addEventListener('copy', onCopy);
  try {
    return document.execCommand('copy');
  } finally {
    document.removeEventListener('copy', onCopy);
  }
}

let flashTimer: ReturnType<typeof setTimeout> | undefined;
export function copyConnector() {
  if (!copyPayload()) {
    announce(t('copyFailed'));
    return false;
  }
  S.copied = true;
  S.copyFlash = true;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    S.copyFlash = false;
    paint();
  }, 1200);
  post({ type: 'copied', pairs: S.state ? pairsOf(orderedNodes()).length : 0 });
  S.pasteNudge++; // the next step is ⌘V: replay the prompt's flash
  paint();
  return true;
}

// ------------------------------------------------------------------ actions

// Runs a tracked action: loading state on its button, always re-enabled.
export async function run(key: string, msg: Record<string, unknown>) {
  if (S.busy[key]) return;
  S.busy = { ...S.busy, [key]: true };
  paint();
  try {
    const res = await request(msg);
    announce(res.message);
  } catch (err: any) {
    announce(String(err && err.message ? err.message : err));
  } finally {
    S.busy = { ...S.busy };
    delete S.busy[key];
    paint();
  }
}

export function makeArrows() {
  if (!S.state?.prototypeSource || S.busy.protoArrows) return;
  if (!copyPayload()) {
    toast(t('copyFailed'));
    return;
  }
  S.copied = false;
  run('protoArrows', { type: 'prototype-arrows' });
}

export const ids = () => (S.state ? S.state.connectors.map((c) => c.id) : []);

export function selectEnd(which: 'from' | 'to') {
  request({ type: 'select', id: ids()[0], which }).then((res) => announce(res.message));
}

export function setAdvanced(open: boolean) {
  S.advanced = open;
  try {
    localStorage.setItem('autoflow.advanced', open ? '1' : '0');
  } catch {
    // Storage may be unavailable in the plugin iframe; the toggle still works.
  }
  paint();
}

export function loadAdvanced() {
  try {
    S.advanced = localStorage.getItem('autoflow.advanced') === '1';
  } catch {
    // No storage: start collapsed.
  }
}

// ------------------------------------------------------------------ toolbar

export function setPicker(name: string | null) {
  if (S.picker === name) return;
  S.picker = name;
  paint();
}

const focusSoon = (id: string, select = false) => {
  // After React has rendered the newly shown field.
  setTimeout(() => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    el?.focus();
    if (select) el?.select();
  }, 0);
};

// `belt` names the value inside the picker (the stroke picker holds two).
export function applyPick(belt: string, value: string) {
  switch (belt) {
    case 'color':
      if (value === 'custom') {
        S.afterPicker = 'lineColorHex'; // focused by the picker as it closes
        setAdvanced(true);
        setPicker(null);
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
  setPicker(null);
}

// T works like FigJam's: adds a label (or jumps to it) and puts the caret there.
export function textTool() {
  if (!editingConnectors()) return;
  if (!current().label) send('label', t('label.default'));
  focusSoon('labelText', true);
}

export function removeLabel() {
  if (editingConnectors()) send('label', '');
  document.getElementById('textTool')?.focus();
}

// ------------------------------------------------------------------ saved styles
//
// Named styles kept per user by the plugin (client storage). A click applies
// one: to the selected connectors, or as the style of new connectors.

export const styleOf = (v: View) => Object.fromEntries(STYLE_KEYS.map((k) => [k, (v as any)[k]]));
export const lookKey = (kind: string, style: any) => JSON.stringify([kind, ...STYLE_KEYS.map((k) => style[k])]);

export function openPresetForm(open: boolean) {
  S.presetForm = open;
  paint();
  focusSoon(open ? 'presetName' : 'presetAdd');
}

export async function savePreset(name: string) {
  const v = current();
  const res = await request({ type: 'preset-save', name: name.trim(), preset: { kind: v.kind, style: styleOf(v) } });
  announce(res.message);
  if (res.ok) openPresetForm(false);
}

export function applyPreset(p: Preset) {
  sendMany({ kind: p.kind, ...JSON.parse(JSON.stringify(p.style)) });
  toast(t('presets.applied', { name: p.name }));
}

export function deletePreset(p: Preset) {
  request({ type: 'preset-delete', id: p.id }).then(() => toast(t('presets.deleted', { name: p.name })));
}
