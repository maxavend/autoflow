// Plugin entry: UI bridge, selection memory and paste adoption.
//
// Design files cannot create connectors (figma.createConnector is FigJam-only),
// but a FigJam connector pasted from the clipboard is a real CONNECTOR that
// Figma keeps attached to its endpoints. The panel copies our own payload
// (ui/connector-payload.html, marked with autoflow/seed); when the user pastes
// it with ⌘V we adopt every seed connector that appears: move it out of the
// frames it landed in, attach it source → target and apply the style.

import {
  applyKind, applyLabel, applyPatch, applyStyle, containerFor, isAttached, isBroken, isConnector, isSeed,
  pageOf, readView, remember, screenOf, setEnd, swapEnds,
} from './connector.ts';
import {
  DEFAULTS, MAX_PRESETS, normalizeDefaults, normalizePreset, pick, SIDE_OPTS,
  type Defaults, type Patch, type Preset, type SideOpt,
} from './model.ts';
import { mergeOrder, pairsFor, sortBy, type LinkMode } from './plan.ts';
import { plural, translator } from '../ui/messages.js';

declare const __html__: string;

const STORE = 'autoflow.defaults';
let defaults: Defaults = DEFAULTS;

async function loadDefaults(): Promise<Defaults> {
  try {
    return normalizeDefaults((await figma.clientStorage.getAsync(STORE)) as Partial<Defaults> | undefined);
  } catch {
    return DEFAULTS;
  }
}

async function saveDefaults(d: Defaults) {
  defaults = normalizeDefaults(d);
  await figma.clientStorage.setAsync(STORE, defaults);
}

// User-facing text (ui/messages.js). The panel tells us the paste shortcut
// of this platform (⌘V or Ctrl+V) for the notifications that mention it.
let t = translator({ paste: '⌘V' });

// Saved styles, per user: available in every file.
const PRESETS = 'autoflow.presets';
let presets: Preset[] = [];

async function loadPresets() {
  try {
    const raw = await figma.clientStorage.getAsync(PRESETS);
    presets = Array.isArray(raw)
      ? raw.map(normalizePreset).filter((p): p is Preset => !!p).slice(0, MAX_PRESETS)
      : [];
  } catch {
    presets = [];
  }
}

async function savePreset(name: string, d: Defaults): Promise<Preset> {
  if (presets.length >= MAX_PRESETS) throw new Error(t('presets.limit', { n: MAX_PRESETS }));
  const used = new Set(presets.map((p) => p.name));
  let fallback = t('style.n', { n: presets.length + 1 });
  for (let i = presets.length + 2; used.has(fallback); i++) fallback = t('style.n', { n: i });
  const preset = normalizePreset({
    id: Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
    name: String(name || '').trim() || fallback,
    ...normalizeDefaults(d),
  })!;
  presets = presets.concat([preset]);
  await figma.clientStorage.setAsync(PRESETS, presets);
  return preset;
}

async function deletePreset(id: string) {
  presets = presets.filter((p) => p.id !== id);
  await figma.clientStorage.setAsync(PRESETS, presets);
}

// Each user-visible step gets its own undo entry.
function commit() {
  try {
    figma.commitUndo();
  } catch {
    // Some hosts do not expose undo control.
  }
}

// One thing at a time: UI actions and paste adoption both await Figma.
let lock: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.catch(() => undefined);
  return run;
}

// --------------------------------------------------------- selection memory

// Pasting replaces the selection with the pasted connectors, so remember the
// last elements the user picked (in click order) for the paste to use.
let ordered: string[] = [];
let picked: SceneNode[] = [];
// Order, link mode and sides chosen in the panel before creating.
let planOrder: string[] = [];
let planMode: LinkMode = 'chain';
let planFrom: SideOpt = 'auto';
let planTo: SideOpt = 'auto';

function trackSelection() {
  const sel = figma.currentPage.selection;
  ordered = mergeOrder(ordered, sel.map((n) => n.id));
  const nodes = sel.filter((n) => !isConnector(n));
  // A selection of only connectors (e.g. right after a paste) keeps the memory.
  if (nodes.length || !sel.length) {
    const byId = new Map(nodes.map((n) => [n.id, n] as [string, SceneNode]));
    picked = ordered.map((id) => byId.get(id)).filter((n): n is SceneNode => !!n);
  }
}

const alive = (n: SceneNode) => !n.removed && pageOf(n) === figma.currentPage;

function selectedConnectors(): ConnectorNode[] {
  return figma.currentPage.selection.filter(isConnector);
}

// ------------------------------------------------------------------- UI sync

function describe(n: SceneNode) {
  return { id: n.id, name: n.name, type: n.type };
}

async function nameOf(id: string): Promise<string> {
  if (!id) return t('unconnected');
  const n = await figma.getNodeByIdAsync(id);
  return n ? n.name : '—';
}

const linked = (c: ConnectorNode) => isAttached(c.connectorStart) && isAttached(c.connectorEnd);

function stats() {
  const all = figma.currentPage.findAllWithCriteria({ types: ['CONNECTOR'] });
  return { total: all.length, broken: all.filter(isBroken).length, linked: all.filter(linked).length };
}

async function pushState() {
  const connectors = [];
  for (const c of selectedConnectors()) {
    const data = await readView(c);
    connectors.push({ id: c.id, data, fromName: await nameOf(data.from.id), toName: await nameOf(data.to.id) });
  }
  const sel = figma.currentPage.selection;
  figma.ui.postMessage({
    type: 'state',
    nodes: sel.filter((n) => !isConnector(n)).length ? picked.filter(alive).map(describe) : [],
    connectors,
    stats: stats(),
    defaults,
    presets,
  });
}

function toast(message: string, error = false) {
  figma.notify(message, { error, timeout: 2600 });
}

// ------------------------------------------------------------ paste adoption

let created: string[] = [];
let scheduled = false;

function onNodeChange(e: NodeChangeEvent) {
  for (const c of e.nodeChanges) if (c.type === 'CREATE') created.push(c.id);
  if (created.length && !scheduled) {
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      const ids = created;
      created = [];
      exclusive(() => adopt(ids)).catch((err) => toast('Autoflow: ' + errorText(err), true));
    }, 16);
  }
}

async function attach(c: ConnectorNode, a: SceneNode | null, b: SceneNode | null, fromSide: SideOpt = 'auto', toSide: SideOpt = 'auto') {
  const container = containerFor(a, b);
  if (c.parent !== container) container.appendChild(c);
  applyKind(c, defaults.kind);
  applyStyle(c, defaults.style);
  await applyLabel(c, '', defaults.style);
  const from = a && await setEnd(c, 'from', { id: a.id, side: fromSide, t: 0.5 }, b && b.absoluteBoundingBox);
  const to = b && await setEnd(c, 'to', { id: b.id, side: toSide, t: 0.5 }, a && a.absoluteBoundingBox);
  if (!b && a && a.absoluteBoundingBox) {
    // Only a source: leave the end free to its right, ready to drag.
    const r = a.absoluteBoundingBox;
    c.connectorEnd = { position: { x: r.x + r.width + 160, y: r.y + r.height / 2 } };
  }
  c.name = a && b && from && to ? `${a.name} → ${b.name}` : t('connector');
  remember(c, from ? from.id : '', to ? to.id : '');
  // Ends Figma would not take, attached to a parent instead.
  return [[a, from], [b, to]]
    .filter(([want, got]) => want && got && want.id !== got.id)
    .map(([want, got]) => t('endpoint.parent', { name: want!.name, parent: got!.name }));
}

async function adopt(ids: string[]) {
  const seeds: ConnectorNode[] = [];
  for (const id of ids) {
    const n = await figma.getNodeByIdAsync(id);
    if (n && !n.removed && isSeed(n) && pageOf(n) === figma.currentPage) seeds.push(n);
  }
  if (!seeds.length) return;

  const nodes = sortBy(picked.filter(alive), planOrder);
  const mode: LinkMode = nodes.length === 2 ? 'pair' : planMode;
  const pairs: [SceneNode | null, SceneNode | null][] = nodes.length >= 2
    ? pairsFor<SceneNode | null>(nodes, mode)
    : [[nodes[0] || null, null]];

  const done: ConnectorNode[] = [];
  const notes: string[] = [];
  for (let i = 0; i < seeds.length; i++) {
    const c = seeds[i];
    if (i < pairs.length) {
      notes.push(...await attach(c, pairs[i][0], pairs[i][1], planFrom, planTo));
      done.push(c);
    } else {
      c.remove(); // Figma pastes one copy per selected element; we need one per link.
    }
  }
  const missing = Math.max(0, pairs.length - done.length);
  commit();
  // Forget the pick: another ⌘V should not link the same elements twice.
  ordered = [];
  picked = [];
  if (done.length) figma.currentPage.selection = done;

  if (notes.length) {
    toast(notes[0]);
  } else if (missing) {
    toast(t('created.missing', { done: done.length, missing }));
  } else if (pairs[0] && pairs[0][1]) {
    toast(plural(t, 'created', done.length));
  } else {
    toast(t('pasted.free'));
  }
  await pushState();
}

// ------------------------------------------------------------------ actions

async function connectorById(id: string): Promise<ConnectorNode | null> {
  const n = await figma.getNodeByIdAsync(id);
  return isConnector(n) && !n.removed ? n : null;
}

async function forEachConnector(ids: string[], fn: (c: ConnectorNode) => Promise<void> | void) {
  for (const id of ids) {
    const c = await connectorById(id);
    if (c) await fn(c);
  }
}

async function addPrototypeLink(ids: string[]): Promise<{ ok: number; skipped: string[]; start: string }> {
  let ok = 0;
  const skipped: string[] = [];
  const starts: SceneNode[] = [];
  const dests = new Set<string>();
  for (const id of ids) {
    const c = await connectorById(id);
    if (!c) continue;
    const v = await readView(c);
    const src = v.from.id ? await figma.getNodeByIdAsync(v.from.id) : null;
    const dst = v.to.id ? await figma.getNodeByIdAsync(v.to.id) : null;
    if (!src || !dst || src.type === 'PAGE' || src.type === 'DOCUMENT' || dst.type === 'PAGE' || dst.type === 'DOCUMENT') {
      skipped.push(t('endpoint.missing'));
      continue;
    }
    const dest = screenOf(dst as SceneNode);
    if (!('setReactionsAsync' in src) || dest.type !== 'FRAME' && dest.type !== 'COMPONENT' && dest.type !== 'INSTANCE') {
      skipped.push(src.name);
      continue;
    }
    starts.push(screenOf(src as SceneNode));
    dests.add(dest.id);
    const has = src.reactions.some((r) => (r.actions || []).some((a) => a.type === 'NODE' && a.destinationId === dest.id));
    if (has) { ok++; continue; }
    const reaction: Reaction = {
      trigger: { type: 'ON_CLICK' },
      actions: [{
        type: 'NODE',
        destinationId: dest.id,
        navigation: 'NAVIGATE',
        transition: { type: 'SMART_ANIMATE', easing: { type: 'EASE_OUT' }, duration: 0.3 },
        resetScrollPosition: true,
      }],
    };
    await src.setReactionsAsync(src.reactions.concat([reaction]));
    ok++;
  }
  return { ok, skipped, start: addFlowStart(starts, dests) };
}

// Without a flow, Present has nowhere to begin: start at the first screen that
// links out and nothing links to. Returns its name, or '' if none was added.
function addFlowStart(starts: SceneNode[], dests: Set<string>): string {
  const page = figma.currentPage;
  if (!starts.length || page.flowStartingPoints.length) return '';
  const first = starts.find((n) => !dests.has(n.id)) || starts[0];
  if (first.type !== 'FRAME' && first.type !== 'COMPONENT' && first.type !== 'INSTANCE') return '';
  try {
    page.flowStartingPoints = [{ nodeId: first.id, name: first.name }];
    return first.name;
  } catch {
    return ''; // Not a valid starting frame: the interactions still work.
  }
}

// Every UI message may carry a requestId; the plugin answers each one with a
// { type: 'result', requestId, action, ok, message } so the UI never hangs.
type UIMessage = { requestId?: string } & (
  | { type: 'ready' }
  | { type: 'env'; paste?: string }
  | { type: 'copied'; pairs: number }
  | { type: 'plan'; order: string[]; mode: LinkMode; fromSide?: SideOpt; toSide?: SideOpt }
  | { type: 'patch'; ids: string[]; patch: Patch }
  | { type: 'swap'; ids: string[] }
  | { type: 'delete'; ids: string[] }
  | { type: 'select'; id: string; which: 'from' | 'to' }
  | { type: 'prototype'; ids?: string[] } // no ids: every linked connector on the page
  | { type: 'defaults'; defaults: Defaults }
  | { type: 'defaults-from'; id: string }
  | { type: 'reset-defaults' }
  | { type: 'preset-save'; name: string; preset: Defaults }
  | { type: 'preset-delete'; id: string }
  | { type: 'clean' }
  | { type: 'select-broken' }
  | { type: 'resize'; height: number }
);

async function sendFonts() {
  const byFamily = new Map<string, string[]>();
  for (const f of await figma.listAvailableFontsAsync()) {
    const styles = byFamily.get(f.fontName.family) || [];
    if (!styles.includes(f.fontName.style)) styles.push(f.fontName.style);
    byFamily.set(f.fontName.family, styles);
  }
  const fonts = Array.from(byFamily, ([family, styles]) => ({ family, styles }))
    .sort((a, b) => a.family.localeCompare(b.family));
  figma.ui.postMessage({ type: 'fonts', fonts });
}

// Returns the user-facing outcome message (also shown as a toast).
async function handle(msg: UIMessage): Promise<string> {
  let result = '';
  switch (msg.type) {
    case 'ready':
      await sendFonts();
      break;
    case 'env':
      t = translator({ paste: msg.paste === 'Ctrl+V' ? 'Ctrl+V' : '⌘V' });
      return result;
    case 'copied':
      // Figma's own toast, outside the panel, where the user is about to paste.
      figma.notify(msg.pairs > 1 ? t('notify.copied.many', { n: msg.pairs }) : t('notify.copied'), { timeout: 4000 });
      return result;
    case 'plan':
      planOrder = Array.isArray(msg.order) ? msg.order.map(String) : [];
      planMode = msg.mode === 'fan' ? 'fan' : 'chain';
      planFrom = pick(msg.fromSide, SIDE_OPTS, 'auto');
      planTo = pick(msg.toSide, SIDE_OPTS, 'auto');
      return result;
    case 'patch':
      await forEachConnector(msg.ids, (c) => applyPatch(c, msg.patch));
      commit();
      break;
    case 'swap':
      await forEachConnector(msg.ids, swapEnds);
      commit();
      break;
    case 'delete':
      await forEachConnector(msg.ids, (c) => c.remove());
      commit();
      break;
    case 'select': {
      const c = await connectorById(msg.id);
      const v = c && await readView(c);
      const id = v ? v[msg.which].id : '';
      const n = id ? await figma.getNodeByIdAsync(id) : null;
      if (n && n.type !== 'PAGE' && n.type !== 'DOCUMENT' && pageOf(n) === figma.currentPage) {
        figma.currentPage.selection = [n as SceneNode];
        figma.viewport.scrollAndZoomIntoView([n as SceneNode]);
      } else throw new Error(t('endpoint.gone'));
      break;
    }
    case 'prototype': {
      const ids = msg.ids || figma.currentPage.findAllWithCriteria({ types: ['CONNECTOR'] }).filter(linked).map((c) => c.id);
      if (!ids.length) throw new Error(t('prototype.none'));
      const r = await addPrototypeLink(ids);
      commit();
      result = r.skipped.length
        ? t('prototype.skipped', { n: r.ok, list: r.skipped.join(', ') })
        : t('prototype.ok', { n: r.ok });
      if (r.start) result += ' ' + t('prototype.start', { name: r.start });
      if (r.skipped.length && !r.ok) throw new Error(result);
      toast(result);
      break;
    }
    case 'defaults':
      await saveDefaults(msg.defaults);
      break;
    case 'defaults-from': {
      const c = await connectorById(msg.id);
      if (!c) throw new Error(t('connector.gone'));
      const v = await readView(c);
      await saveDefaults({ kind: v.kind, style: v.style });
      result = t('defaults.saved');
      toast(result);
      break;
    }
    case 'reset-defaults':
      await saveDefaults(DEFAULTS);
      break;
    case 'preset-save': {
      const p = await savePreset(msg.name, msg.preset);
      result = t('presets.saved', { name: p.name });
      toast(result);
      break;
    }
    case 'preset-delete':
      await deletePreset(msg.id);
      break;
    case 'clean': {
      const broken = figma.currentPage.findAllWithCriteria({ types: ['CONNECTOR'] }).filter(isBroken);
      for (const c of broken) c.remove();
      commit();
      result = plural(t, 'loose.deleted', broken.length);
      toast(result);
      break;
    }
    case 'select-broken': {
      const broken = figma.currentPage.findAllWithCriteria({ types: ['CONNECTOR'] }).filter(isBroken);
      if (!broken.length) throw new Error(t('loose.none'));
      figma.currentPage.selection = broken;
      figma.viewport.scrollAndZoomIntoView(broken);
      break;
    }
    case 'resize':
      figma.ui.resize(320, Math.max(200, Math.min(900, Math.round(msg.height))));
      return result;
  }
  await pushState();
  return result;
}

function reply(msg: UIMessage, ok: boolean, message: string) {
  if (msg.type === 'resize' || msg.type === 'plan' || msg.type === 'env' || msg.type === 'copied') return;
  figma.ui.postMessage({ type: 'result', requestId: msg.requestId ?? null, action: msg.type, ok, message });
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// --------------------------------------------------------------- bootstrap

let watched: PageNode | null = null;
function watch(page: PageNode) {
  if (watched) watched.off('nodechange', onNodeChange);
  watched = page;
  page.on('nodechange', onNodeChange);
}

async function main() {
  defaults = await loadDefaults();
  await loadPresets();
  figma.showUI(__html__, { width: 320, height: 560, themeColors: true, title: 'Autoflow' });
  try {
    figma.currentPage.setRelaunchData({ open: t('relaunch') });
  } catch {
    // Sidebar shortcut only.
  }
  watch(figma.currentPage);
  figma.on('selectionchange', () => { trackSelection(); exclusive(pushState); });
  figma.on('currentpagechange', () => {
    ordered = [];
    picked = [];
    watch(figma.currentPage);
    exclusive(pushState);
  });
  figma.on('close', () => { if (watched) watched.off('nodechange', onNodeChange); });
  figma.ui.onmessage = (msg: UIMessage) => {
    exclusive(() => handle(msg)).then(
      (message) => reply(msg, true, message),
      (err) => {
        const text = errorText(err);
        toast(text, true);
        reply(msg, false, text);
        exclusive(pushState);
      },
    );
  };
  trackSelection();
  await pushState();
}

main().catch((err) => {
  console.error(err);
  figma.closePlugin('Autoflow: ' + String(err && err.message || err));
});
