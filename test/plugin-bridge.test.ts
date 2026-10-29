// Runs src/code.ts against a minimal fake of the Figma Plugin API and checks
// the UI ↔ plugin contract (every UI message gets exactly one `result`, errors
// come back as { ok: false }) and paste adoption: seed connectors pasted with
// elements selected get attached source → target, extra copies are removed.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

type Msg = { type: string; [key: string]: unknown };
type Fake = Record<string, unknown> & { id: string; type: string; name: string; parent: Fake | null; removed: boolean };

const posted: Msg[] = [];
const notices: { message: string; error: boolean }[] = [];
const storage = new Map<string, unknown>();
const nodes = new Map<string, Fake>();
const handlers: Record<string, (...a: unknown[]) => void> = {};
let nodeChange: ((e: unknown) => void) | null = null;

const ui: { postMessage(m: Msg): void; resize(w: number, h: number): void; onmessage?: (m: Msg) => void } = {
  postMessage: (m) => { posted.push(m); },
  resize: () => {},
};

function children(p: Fake): Fake[] {
  return Array.from(nodes.values()).filter((n) => n.parent === p && !n.removed);
}
function all(p: Fake): Fake[] {
  return children(p).flatMap((c) => [c, ...all(c)]);
}

const page: Fake = {
  id: '0:1',
  type: 'PAGE',
  name: 'Page 1',
  parent: null,
  removed: false,
  selection: [] as Fake[],
  findAllWithCriteria: (c: { types: string[] }) => all(page).filter((n) => c.types.includes(n.type)),
  findAll: (fn: (n: Fake) => boolean) => all(page).filter(fn),
  on: (_: string, fn: (e: unknown) => void) => { nodeChange = fn; },
  off: () => { nodeChange = null; },
  setRelaunchData: () => {},
  appendChild: (n: Fake) => { n.parent = page; },
  getSharedPluginData: () => '',
  flowStartingPoints: [] as { nodeId: string; name: string }[],
};
Object.defineProperty(page, 'children', { get: () => children(page) });

function plugData() {
  const data = new Map<string, string>();
  return {
    getSharedPluginData: (ns: string, k: string) => data.get(ns + '/' + k) || '',
    setSharedPluginData: (ns: string, k: string, v: string) => { data.set(ns + '/' + k, v); },
  };
}

function frame(id: string, name: string, x: number, parent: Fake = page): Fake {
  const n: Fake = {
    id, type: 'FRAME', name, parent, removed: false, width: 200, height: 400, x, y: 0,
    absoluteBoundingBox: { x, y: 0, width: 200, height: 400 }, reactions: [],
    async setReactionsAsync(r: unknown[]) { n.reactions = r; },
    remove() { n.removed = true; for (const c of children(n)) c.removed = true; },
    resize(w: number, h: number) { n.width = w; n.height = h; },
    appendChild(c: Fake) { c.parent = n; },
    ...plugData(),
  };
  Object.defineProperty(n, 'children', { get: () => children(n) });
  nodes.set(id, n);
  return n;
}
let frames = 500;

// Layers Figma refuses as connector endpoints (it throws on the setter).
const refused = new Set<string>();
function endpoint(n: Fake, key: 'connectorStart' | 'connectorEnd', first: unknown) {
  let value = first;
  Object.defineProperty(n, key, {
    enumerable: true,
    get: () => value,
    set: (v: { endpointNodeId?: string }) => {
      if (v.endpointNodeId && refused.has(v.endpointNodeId)) throw new Error(`in set_${key}: Invalid endpointNodeId`);
      value = v;
    },
  });
}

let seq = 100;
function seed(parent: Fake): Fake {
  const id = `9:${++seq}`;
  const n: Fake = {
    id, type: 'CONNECTOR', name: 'Autoflow connector', parent, removed: false,
    connectorLineType: 'ELBOWED', connectorStartStrokeCap: 'NONE', connectorEndStrokeCap: 'ARROW_LINES',
    strokes: [], strokeWeight: 1, dashPattern: [], cornerRadius: 24,
    text: { characters: '', fontName: { family: 'Inter', style: 'Medium' }, fontSize: 16, fills: [] },
    remove() { n.removed = true; },
    ...plugData(),
  };
  endpoint(n, 'connectorStart', { position: { x: 0, y: 0 } });
  endpoint(n, 'connectorEnd', { position: { x: 160, y: 0 } });
  (n.setSharedPluginData as (a: string, b: string, c: string) => void)('autoflow', 'seed', '1');
  nodes.set(id, n);
  return n;
}

(globalThis as unknown as { __html__: string }).__html__ = '<html></html>'; // injected by Figma from manifest.ui
(globalThis as unknown as { figma: unknown }).figma = {
  command: 'open',
  currentPage: page,
  ui,
  mixed: Symbol('mixed'),
  skipInvisibleInstanceChildren: false,
  showUI: () => {},
  on: (ev: string, fn: (...a: unknown[]) => void) => { handlers[ev] = fn; },
  notify: (message: string, opts?: { error?: boolean }) => { notices.push({ message, error: !!opts?.error }); },
  clientStorage: {
    getAsync: async (k: string) => storage.get(k),
    setAsync: async (k: string, v: unknown) => { storage.set(k, v); },
  },
  listAvailableFontsAsync: async () => [
    { fontName: { family: 'Roboto', style: 'Bold' } },
    { fontName: { family: 'Inter', style: 'Regular' } },
    { fontName: { family: 'Inter', style: 'Semi Bold' } },
    { fontName: { family: 'Inter', style: 'Regular' } },
  ],
  loadFontAsync: async () => {},
  createFrame: () => frame(`8:${++frames}`, 'Frame', 0),
  getNodeByIdAsync: async (id: string) => {
    const n = nodes.get(id);
    return n && !n.removed ? n : null;
  },
  commitUndo: () => {},
  viewport: { scrollAndZoomIntoView: () => {}, center: { x: 0, y: 0 } },
  closePlugin: () => {},
};

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

async function send(msg: Msg): Promise<Msg | undefined> {
  const requestId = `t${++seq}`;
  const from = posted.length;
  ui.onmessage!({ ...msg, requestId });
  for (let i = 0; i < 100; i++) {
    const res = posted.slice(from).find((m) => m.type === 'result' && m.requestId === requestId);
    if (res) {
      const extra = posted.slice(from).filter((m) => m.type === 'result' && m.requestId === requestId);
      assert.equal(extra.length, 1, `exactly one result for ${msg.type}`);
      return res;
    }
    await tick();
  }
  return undefined;
}

function select(...ns: Fake[]) {
  page.selection = ns;
  handlers.selectionchange();
}

// What Figma does on ⌘V with elements selected: one copy inside each.
async function paste(into: Fake[]): Promise<Fake[]> {
  const made = (into.length ? into : [page]).map((p) => seed(p));
  page.selection = made;
  handlers.selectionchange();
  nodeChange!({ nodeChanges: made.map((n) => ({ type: 'CREATE', id: n.id })) });
  await tick(80);
  return made;
}

before(async () => {
  await import('../src/code.ts');
  for (let i = 0; i < 100 && !ui.onmessage; i++) await tick();
  assert.ok(ui.onmessage, 'panel registered its message handler');
  assert.ok(nodeChange, 'watches the page for pastes');
});

test('ready → fonts grouped by family (sorted, deduped) + state + ok', async () => {
  const from = posted.length;
  const res = await send({ type: 'ready' });
  assert.deepEqual(res && { ok: res.ok, action: res.action }, { ok: true, action: 'ready' });
  const fonts = posted.slice(from).find((m) => m.type === 'fonts');
  assert.deepEqual(fonts?.fonts, [
    { family: 'Inter', styles: ['Regular', 'Semi Bold'] },
    { family: 'Roboto', styles: ['Bold'] },
  ]);
  const state = posted.slice(from).find((m) => m.type === 'state') as Msg & { stats: unknown; connectors: unknown[] };
  assert.deepEqual(state.stats, { total: 0, broken: 0, linked: 0 });
  assert.deepEqual(state.connectors, []);
  assert.deepEqual((state as unknown as { presets: unknown[] }).presets, []);
});

test('notifications use the platform paste shortcut the panel reports', async () => {
  ui.onmessage!({ type: 'env', paste: 'Ctrl+V' }); // fire-and-forget, like the panel sends it
  await tick(10);
  const before = notices.length;
  await paste([]);
  assert.ok(notices.slice(before).some((n) => /before Ctrl\+V/.test(n.message)));
  ui.onmessage!({ type: 'env', paste: '⌘V' });
  await tick(10);
});

test('defaults are normalized before being stored', async () => {
  const res = await send({
    type: 'defaults',
    defaults: { kind: 'curve', style: { color: 'red', weight: -4, labelFont: { family: '', style: 'Bold' }, endCap: 'triangle' } },
  });
  assert.equal(res?.ok, true);
  const saved = storage.get('autoflow.defaults') as { kind: string; style: Record<string, unknown> };
  assert.equal(saved.kind, 'curve');
  assert.equal(saved.style.color, '#0d99ff');       // invalid hex → default
  assert.equal(saved.style.weight, 0.5);            // negative → clamped
  assert.equal(saved.style.endCap, 'triangle');
  assert.deepEqual(saved.style.labelFont, { family: 'Inter', style: 'Medium' });
  assert.equal((await send({ type: 'reset-defaults' }))?.ok, true);
});

test('connector actions on unknown ids still resolve', async () => {
  for (const type of ['patch', 'swap', 'delete', 'prototype']) {
    const res = await send({ type, ids: ['7:7'], patch: { style: { color: '#fff' } } });
    assert.equal(res?.ok, true, type);
  }
  assert.equal((await send({ type: 'select', id: '7:7', which: 'from' }))?.ok, false);
  assert.equal((await send({ type: 'defaults-from', id: '7:7' }))?.ok, false);
});

test('paste with two elements selected: one connector A → B on the page, extra copy removed', async () => {
  const a = frame('2:1', 'Home', 0);
  const b = frame('2:2', 'Detalle', 400);
  select(a);
  select(a, b);
  const made = await paste([a, b]);
  const kept = made.filter((n) => !n.removed);
  assert.equal(kept.length, 1);
  const c = kept[0];
  assert.equal(c.parent, page, 'moved out of the frame');
  assert.deepEqual(c.connectorStart, { endpointNodeId: '2:1', magnet: 'AUTO' });
  assert.deepEqual(c.connectorEnd, { endpointNodeId: '2:2', magnet: 'AUTO' });
  assert.equal(c.name, 'Home → Detalle');
  assert.equal(c.connectorEndStrokeCap, 'ARROW_LINES');
  assert.equal((c.getSharedPluginData as (a: string, b: string) => string)('autoflow', 'seed'), '');
  assert.deepEqual(page.selection, [c]);
  assert.ok(notices.some((n) => n.message === 'Connector created'));
});

test('a layer Figma refuses as an endpoint: attached to its parent, aimed at the layer', async () => {
  const screen = frame('2:10', 'Checkout', 0);
  const button = frame('2:11', 'Pay button', 0, screen);
  button.absoluteBoundingBox = { x: 20, y: 300, width: 160, height: 48 };
  const b = frame('2:12', 'Done', 400);
  refused.add(button.id);
  const before = notices.length;
  select(button);
  select(button, b);
  const [c] = (await paste([button, b])).filter((n) => !n.removed);
  // Right side of the button (Done is to the right), in Checkout's coordinates.
  assert.deepEqual(c.connectorStart, { endpointNodeId: '2:10', position: { x: 180, y: 324 } });
  assert.deepEqual(c.connectorEnd, { endpointNodeId: '2:12', magnet: 'AUTO' });
  assert.equal(c.name, 'Pay button → Done');
  assert.deepEqual(JSON.parse((c.getSharedPluginData as (a: string, b: string) => string)('autoflow', 'conn')), { from: '2:10', to: '2:12' });
  assert.ok(notices.slice(before).some((n) => !n.error && /“Pay button” directly, so the connector is attached to “Checkout”/.test(n.message)));
  refused.delete(button.id);
});

test('layers inside an instance attach to the instance; instances inside components attach directly', async () => {
  const card = frame('2:20', 'Card', 0);
  card.type = 'INSTANCE';
  const icon = frame('I2:20;1:5', 'Icon', 0, card);
  icon.absoluteBoundingBox = { x: 0, y: 0, width: 40, height: 40 };
  const component = frame('2:22', 'Plan', 0);
  component.type = 'COMPONENT';
  component.absoluteBoundingBox = { x: 0, y: 600, width: 200, height: 400 };
  const badge = frame('2:23', 'Badge', 0, component);
  badge.type = 'INSTANCE';
  badge.absoluteBoundingBox = { x: 0, y: 600, width: 200, height: 400 };
  select(icon);
  select(icon, badge);
  const [c] = (await paste([icon, badge])).filter((n) => !n.removed);
  // Bottom of the icon (the badge is below), in the instance's coordinates.
  assert.deepEqual(c.connectorStart, { endpointNodeId: '2:20', position: { x: 20, y: 40 } });
  assert.deepEqual(c.connectorEnd, { endpointNodeId: '2:23', magnet: 'AUTO' });
  assert.equal(c.name, 'Icon → Badge');
});

test('a button inside nested instances links to a button inside another screen', async () => {
  const benefits = frame('3:1', 'Beneficios', 0);
  const carousel = frame('3:2', 'Carousel', 0, benefits);
  carousel.type = 'INSTANCE';
  carousel.absoluteBoundingBox = { x: 0, y: 1000, width: 600, height: 200 };
  const card = frame('I3:2;5:1', 'Card Farmacias', 0, carousel);
  card.type = 'INSTANCE';
  const more = frame('I3:2;5:1;7:3', 'Ver más', 0, card);
  more.absoluteBoundingBox = { x: 236, y: 1100, width: 132, height: 44 };
  const home = frame('3:3', 'Home', 1100);
  const bill = frame('3:4', 'Boleta', 1100, home);
  bill.type = 'INSTANCE';
  bill.absoluteBoundingBox = { x: 1230, y: 570, width: 256, height: 200 };
  const pay = frame('I3:4;6:2', 'Pagar boleta', 1100, bill);
  pay.absoluteBoundingBox = { x: 1363, y: 722, width: 123, height: 48 };
  select(more);
  select(more, pay);
  const [c] = (await paste([more, pay])).filter((n) => !n.removed);
  // Each end on the closest real instance, aimed at its button's facing side.
  assert.deepEqual(c.connectorStart, { endpointNodeId: '3:2', position: { x: 368, y: 122 } });
  assert.deepEqual(c.connectorEnd, { endpointNodeId: '3:4', position: { x: 133, y: 176 } });
  assert.equal(c.name, 'Ver más → Pagar boleta');

  // The panel shows the buttons, not the instances, and side edits stay on them.
  type End = { id: string; side: string; t: number };
  const ends = () => {
    const state = posted.filter((m) => m.type === 'state').slice(-1)[0] as unknown as { connectors: { fromName: string; toName: string; data: { from: End; to: End } }[] };
    const [v] = state.connectors;
    return [v.fromName, v.data.from.side, v.toName, v.data.to.side];
  };
  assert.deepEqual(ends(), ['Ver más', 'right', 'Pagar boleta', 'left']);
  assert.equal((await send({ type: 'patch', ids: [c.id], patch: { fromSide: 'bottom', toSide: 'top' } }))?.ok, true);
  assert.deepEqual(c.connectorStart, { endpointNodeId: '3:2', position: { x: 302, y: 144 } });
  assert.deepEqual(c.connectorEnd, { endpointNodeId: '3:4', position: { x: 194.5, y: 152 } });
  assert.equal((await send({ type: 'patch', ids: [c.id], patch: { fromSide: 'auto' } }))?.ok, true);
  assert.deepEqual(c.connectorStart, { endpointNodeId: '3:2', position: { x: 368, y: 122 } }, 'auto faces the other button');
  assert.equal((await send({ type: 'swap', ids: [c.id] }))?.ok, true);
  select(c);
  assert.deepEqual(ends(), ['Pagar boleta', 'top', 'Ver más', 'right']);
});

test('Make prototype: every linked connector on the page → On click → Navigate, flow starts at the first screen', async () => {
  for (const n of (page.findAll as (fn: (n: Fake) => boolean) => Fake[])(() => true)) n.removed = true;
  const login = frame('6:1', 'Login', 0);
  const home = frame('6:2', 'Home', 400);
  const shell = frame('6:3', 'Web Shell', 400, home);
  shell.type = 'INSTANCE';
  const pay = frame('I6:3;1:1', 'Pagar boleta', 400, shell);
  const detail = frame('6:4', 'Detalle', 800);
  select(login, home);
  await paste([login, home]);
  select(pay, detail);
  await paste([pay, detail]);
  const res = await send({ type: 'prototype' });
  assert.equal(res?.ok, true);
  const dest = (n: Fake) => (n.reactions as { actions: { destinationId: string }[] }[]).map((r) => r.actions[0].destinationId);
  assert.deepEqual(dest(login), ['6:2']);
  assert.deepEqual(dest(pay), ['6:4'], 'the click is on the button inside the instance');
  assert.deepEqual(page.flowStartingPoints, [{ nodeId: '6:1', name: 'Login' }]);
  assert.match(String(res?.message), /^2 prototype interaction\(s\).*Flow starts at “Login”/);
  // Again: no duplicates, the existing flow is kept.
  await send({ type: 'prototype' });
  assert.deepEqual(dest(login), ['6:2']);
  assert.equal((page.flowStartingPoints as unknown[]).length, 1);
});

test('click order wins and three elements chain A → B → C', async () => {
  const a = frame('3:1', 'A', 0);
  const b = frame('3:2', 'B', 400);
  const c = frame('3:3', 'C', 800);
  select(b);
  select(b, a);       // Figma may report any order; the click order was B then A
  select(c, b, a);
  const made = (await paste([a, b, c])).filter((n) => !n.removed);
  const links = made.map((n) => [(n.connectorStart as { endpointNodeId: string }).endpointNodeId, (n.connectorEnd as { endpointNodeId: string }).endpointNodeId]);
  assert.deepEqual(links, [['3:2', '3:1'], ['3:1', '3:3']]);
});

test('panel order and fan mode are used for the paste', async () => {
  const a = frame('4:1', 'A', 0);
  const b = frame('4:2', 'B', 400);
  const c = frame('4:3', 'C', 800);
  select(a, b, c);
  ui.onmessage!({ type: 'plan', order: ['4:3', '4:1', '4:2'], mode: 'fan' });
  await tick(10);
  const made = (await paste([a, b, c])).filter((n) => !n.removed);
  const links = made.map((n) => [(n.connectorStart as { endpointNodeId: string }).endpointNodeId, (n.connectorEnd as { endpointNodeId: string }).endpointNodeId]);
  assert.deepEqual(links, [['4:3', '4:1'], ['4:3', '4:2']]);
  ui.onmessage!({ type: 'plan', order: [], mode: 'chain' });
});

test('a second ⌘V does not link the same elements again', async () => {
  const before = notices.length;
  const [c] = await paste([]);
  assert.equal(c.removed, false);
  assert.deepEqual(c.connectorStart, { position: { x: 0, y: 0 } }, 'left free');
  assert.ok(notices.slice(before).some((n) => /Select a source and a target/.test(n.message)));
});

test('pastes of other connectors (no seed mark) are ignored', async () => {
  const other = seed(page);
  (other.setSharedPluginData as (a: string, b: string, c: string) => void)('autoflow', 'seed', '');
  nodeChange!({ nodeChanges: [{ type: 'CREATE', id: other.id }] });
  await tick(60);
  assert.equal(other.name, 'Autoflow connector');
});

test('patch, swap and clean act on real connectors', async () => {
  const a = frame('5:1', 'A', 0);
  const b = frame('5:2', 'B', 400);
  select(a, b);
  const [c] = (await paste([a, b])).filter((n) => !n.removed);
  assert.equal((await send({ type: 'patch', ids: [c.id], patch: { kind: 'curve', style: { dash: 'dash', weight: 2 } } }))?.ok, true);
  assert.equal(c.connectorLineType, 'CURVED');
  assert.deepEqual(c.dashPattern, [8, 6]);
  assert.equal((await send({ type: 'patch', ids: [c.id], patch: { toSide: 'left', toT: 0.25 } }))?.ok, true);
  assert.deepEqual(c.connectorEnd, { endpointNodeId: '5:2', position: { x: 0, y: 100 } });
  assert.equal((await send({ type: 'swap', ids: [c.id] }))?.ok, true);
  assert.equal((c.connectorStart as { endpointNodeId: string }).endpointNodeId, '5:2');
  // B deleted: Figma leaves that end free.
  c.connectorStart = { position: { x: 0, y: 0 } };
  assert.equal((await send({ type: 'select-broken' }))?.ok, true);
  assert.deepEqual(page.selection, [c], 'Ver shows the loose connector');
  const res = await send({ type: 'clean' });
  assert.equal(res?.ok, true);
  assert.equal(c.removed, true);
  assert.match(String(res?.message), /^1 loose connector deleted/);
});

test('the sides chosen in the panel are used by the next paste', async () => {
  const a = frame('7:1', 'Inicio', 0);
  const b = frame('7:2', 'Perfil', 400);
  select(a);
  select(a, b);
  ui.onmessage!({ type: 'plan', order: [], mode: 'chain', fromSide: 'right', toSide: 'left' });
  await tick(10);
  const [c] = (await paste([a, b])).filter((n) => !n.removed);
  assert.deepEqual([c.connectorStart, c.connectorEnd], [{ endpointNodeId: '7:1', magnet: 'RIGHT' }, { endpointNodeId: '7:2', magnet: 'LEFT' }]);
  ui.onmessage!({ type: 'plan', order: [], mode: 'chain', fromSide: 'auto', toSide: 'auto' });
  await tick(10);
});

test('saved styles: stored per user, normalized, named, and deletable', async () => {
  const res = await send({ type: 'preset-save', name: '  Flujo principal  ', preset: { kind: 'curve', style: { color: '#F24822', weight: 99, dash: 'dash' } } });
  assert.equal(res?.message, 'Style “Flujo principal” saved');
  const saved = storage.get('autoflow.presets') as { id: string; name: string; kind: string; style: { color: string; weight: number; dash: string } }[];
  assert.equal(saved.length, 1);
  assert.deepEqual([saved[0].name, saved[0].kind, saved[0].style.color, saved[0].style.weight, saved[0].style.dash], ['Flujo principal', 'curve', '#f24822', 24, 'dash']);
  await send({ type: 'preset-save', name: '', preset: { kind: 'elbow', style: {} } });
  const names = (storage.get('autoflow.presets') as { name: string }[]).map((p) => p.name);
  assert.deepEqual(names, ['Flujo principal', 'Style 2'], 'unnamed styles get a numbered name');
  const state = posted.filter((m) => m.type === 'state').slice(-1)[0] as unknown as { presets: { name: string }[] };
  assert.deepEqual(state.presets.map((p) => p.name), names, 'the panel receives them');
  await send({ type: 'preset-delete', id: saved[0].id });
  assert.deepEqual((storage.get('autoflow.presets') as { name: string }[]).map((p) => p.name), ['Style 2']);
});

test('plan and resize are fire-and-forget (no result)', async () => {
  const from = posted.length;
  ui.onmessage!({ type: 'resize', height: 640, requestId: 'x' });
  ui.onmessage!({ type: 'plan', order: [], mode: 'chain', requestId: 'y' });
  await tick(30);
  assert.equal(posted.slice(from).filter((m) => m.type === 'result').length, 0);
});
