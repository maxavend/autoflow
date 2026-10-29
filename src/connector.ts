// Figma side of a connector: a native CONNECTOR node. Figma keeps it attached
// to its endpoints (also with the plugin closed); we read and write its
// endpoints, style and label.

import {
  AIM, hexToRgb, KEY, normalizeStyle, NS, rgbToHex, SEED,
  type ConnectorView, type Endpoint, type Kind, type Patch, type Style,
} from './model.ts';
import {
  CAP_TO_FIGMA, capFromFigma, dashFromPattern, dashPattern, endpointSpec, facing, KIND_TO_FIGMA, kindFromFigma, pointOn, sideOf,
  type Box,
} from './plan.ts';

export const isConnector = (n: BaseNode | null): n is ConnectorNode => !!n && n.type === 'CONNECTOR';
export const isSeed = (n: BaseNode): n is ConnectorNode => isConnector(n) && n.getSharedPluginData(NS, SEED) !== '';

export function pageOf(n: BaseNode): PageNode | null {
  let cur: BaseNode | null = n;
  while (cur && cur.type !== 'PAGE') cur = cur.parent;
  return cur as PageNode | null;
}

function ancestors(n: BaseNode): BaseNode[] {
  const out: BaseNode[] = [];
  for (let cur = n.parent; cur; cur = cur.parent) out.push(cur);
  return out;
}

// Deepest section shared by both ends, else the page. Connectors never go
// inside frames, so designs are not touched.
export function containerFor(a: SceneNode | null, b: SceneNode | null): PageNode | SectionNode {
  if (a && b) {
    const bAnc = new Set(ancestors(b).map((n) => n.id));
    for (const n of ancestors(a)) {
      if (n.type === 'SECTION' && bAnc.has(n.id)) return n;
      if (n.type === 'PAGE') break;
    }
  }
  return figma.currentPage;
}

// Top-level frame a node lives in (prototype destinations must be top-level).
export function screenOf(n: SceneNode): SceneNode {
  let cur: SceneNode = n;
  while (cur.parent && cur.parent.type !== 'PAGE' && cur.parent.type !== 'SECTION') cur = cur.parent as SceneNode;
  return cur;
}

const boxOf = (n: BaseNode) => ('absoluteBoundingBox' in n ? n.absoluteBoundingBox : null);
const size = (n: BaseNode | null) => (n && 'width' in n ? { w: n.width, h: n.height } : { w: 0, h: 0 });

// ------------------------------------------------------------------- reading

type FigmaEnd = ConnectorEndpoint & { endpointNodeId?: string; magnet?: string; position?: { x: number; y: number } };

// Layer each end is aimed at, when attached to a parent that contains it.
type Aim = { from: string; to: string };
function readAim(c: ConnectorNode): Aim {
  try {
    const d = JSON.parse(c.getSharedPluginData(NS, AIM) || '{}') as Partial<Aim>;
    return { from: d.from || '', to: d.to || '' };
  } catch {
    return { from: '', to: '' };
  }
}
function writeAim(c: ConnectorNode, aim: Aim) {
  c.setSharedPluginData(NS, AIM, aim.from || aim.to ? JSON.stringify(aim) : '');
}

const contains = (outer: BaseNode, n: BaseNode) => {
  for (let cur = n.parent; cur; cur = cur.parent) if (cur.id === outer.id) return true;
  return false;
};

async function readEnd(ep: FigmaEnd, aim: string): Promise<Endpoint> {
  const id = ep.endpointNodeId || '';
  if (!id) return { id: '', side: 'auto', t: 0.5 };
  const n = await figma.getNodeByIdAsync(id);
  // Aimed at a layer inside: the end is that layer, its side read on the layer's own box.
  const layer = n && aim ? await figma.getNodeByIdAsync(aim) : null;
  if (n && layer && contains(n, layer)) {
    const ib = boxOf(layer);
    const ob = boxOf(n);
    if (!ib || !ob || !ep.position) return { id: layer.id, side: 'auto', t: 0.5 };
    const p = { x: ep.position.x + ob.x - ib.x, y: ep.position.y + ob.y - ib.y };
    return { id: layer.id, ...sideOf({ position: p }, ib.width, ib.height) };
  }
  const { w, h } = size(n);
  return { id, ...sideOf(ep, w, h) };
}

function solidHex(paints: ReadonlyArray<Paint> | PluginAPI['mixed'], d: string): { hex: string; opacity: number } {
  const p = Array.isArray(paints) ? (paints as Paint[]).find((x) => x.type === 'SOLID' && x.visible !== false) as SolidPaint | undefined : undefined;
  return p ? { hex: rgbToHex(p.color), opacity: p.opacity ?? 1 } : { hex: d, opacity: 1 };
}

export async function readView(c: ConnectorNode): Promise<ConnectorView> {
  const stroke = solidHex(c.strokes, '#1e1e1e');
  const text = c.text;
  const fontName = text.fontName;
  const fontSize = text.fontSize;
  const style = normalizeStyle({
    color: stroke.hex,
    opacity: stroke.opacity,
    weight: typeof c.strokeWeight === 'number' ? c.strokeWeight : undefined,
    dash: dashFromPattern(c.dashPattern),
    startCap: capFromFigma(c.connectorStartStrokeCap),
    endCap: capFromFigma(c.connectorEndStrokeCap),
    radius: c.cornerRadius,
    labelColor: solidHex(text.fills, '#1e1e1e').hex,
    labelSize: typeof fontSize === 'number' ? fontSize : undefined,
    labelFont: fontName !== figma.mixed && fontName.family ? { family: fontName.family, style: fontName.style } : undefined,
  });
  const aim = readAim(c);
  const from = await readEnd(c.connectorStart as FigmaEnd, aim.from);
  const to = await readEnd(c.connectorEnd as FigmaEnd, aim.to);
  return { from, to, kind: kindFromFigma(c.connectorLineType), style, label: text.characters, broken: isBroken(c) };
}

export const isAttached = (ep: ConnectorEndpoint) => !!(ep as FigmaEnd).endpointNodeId;

// Where the click of a prototype link lives: the aimed layer, else the attached node.
export function sourceId(c: ConnectorNode): string {
  return readAim(c).from || (c.connectorStart as FigmaEnd).endpointNodeId || '';
}

// Created attached (we stored both ids) but an end has lost its element.
export function isBroken(c: ConnectorNode): boolean {
  if (!c.getSharedPluginData(NS, KEY)) return false;
  return !isAttached(c.connectorStart) || !isAttached(c.connectorEnd);
}

// ------------------------------------------------------------------- writing

async function loadFont(f: FontName): Promise<FontName> {
  try {
    await figma.loadFontAsync(f);
    return f;
  } catch {
    const fallback = { family: 'Inter', style: 'Regular' };
    await figma.loadFontAsync(fallback);
    return fallback;
  }
}

export function applyStyle(c: ConnectorNode, s: Style) {
  c.strokes = [{ type: 'SOLID', color: hexToRgb(s.color), opacity: s.opacity }];
  c.strokeWeight = s.weight;
  c.dashPattern = dashPattern(s.dash, s.weight);
  c.connectorStartStrokeCap = CAP_TO_FIGMA[s.startCap];
  c.connectorEndStrokeCap = CAP_TO_FIGMA[s.endCap];
  // Typed read-only, but writable on connectors.
  (c as { cornerRadius?: number }).cornerRadius = s.radius;
}

export async function applyLabel(c: ConnectorNode, label: string, s: Style) {
  const text = c.text;
  if (!label && !text.characters) return;
  const current = text.fontName;
  if (current !== figma.mixed && current.family) await loadFont(current);
  const font = await loadFont(s.labelFont);
  text.fontName = font;
  text.characters = label;
  if (label) {
    text.fontSize = s.labelSize;
    text.fills = [{ type: 'SOLID', color: hexToRgb(s.labelColor) }];
  }
}

export function applyKind(c: ConnectorNode, k: Kind) {
  c.connectorLineType = KIND_TO_FIGMA[k];
}

// Layers inside an instance (ids like "I12:3;4:5") are not nodes of their own,
// and Figma refuses them as endpoints ("Invalid endpointNodeId").
const insideInstance = (n: BaseNode) => n.id.includes(';');

// Attach to the layer, or to the closest ancestor Figma accepts, aiming the
// end at the layer itself (on the side facing `toward` when side is auto).
// Returns the node attached to.
export async function setEnd(c: ConnectorNode, which: 'from' | 'to', end: Endpoint, toward: Box | null = null): Promise<SceneNode | null> {
  if (!end.id) return null;
  const n = await figma.getNodeByIdAsync(end.id);
  if (!n) return null;
  const box = boxOf(n);
  const side = end.side !== 'auto' ? end.side : box && toward ? facing(box, toward) : null;
  let refused: unknown = null;
  for (let cur: BaseNode | null = n; cur && cur.type !== 'PAGE' && cur.type !== 'DOCUMENT'; cur = cur.parent) {
    if (insideInstance(cur)) continue;
    const outer = boxOf(cur);
    const { w, h } = size(cur);
    const plain = endpointSpec(cur.id, end.side, end.t, w, h);
    // Aimed at the layer inside first; the parent's own anchor if Figma refuses that point.
    const specs = cur !== n && box && outer && side
      ? [{ endpointNodeId: cur.id, position: pointOn(box, outer, side, end.t) }, plain]
      : [plain];
    for (const spec of specs) {
      try {
        if (which === 'from') c.connectorStart = spec;
        else c.connectorEnd = spec;
        writeAim(c, { ...readAim(c), [which]: cur !== n ? n.id : '' });
        return cur as SceneNode;
      } catch (err) {
        refused = refused || err;
      }
    }
  }
  throw refused || new Error('Invalid endpoint');
}

// Remember the ids we attached, to tell a detached connector apart from a
// free one the user drew on purpose.
export function remember(c: ConnectorNode, from: string, to: string) {
  c.setSharedPluginData(NS, KEY, from && to ? JSON.stringify({ from, to }) : '');
  c.setSharedPluginData(NS, SEED, '');
}

export async function applyPatch(c: ConnectorNode, p: Patch) {
  const v = await readView(c);
  const style = normalizeStyle({ ...v.style, ...(p.style || {}) });
  if (p.kind) applyKind(c, p.kind);
  if (p.style) applyStyle(c, style);
  if (p.label !== undefined || (p.style && v.label)) await applyLabel(c, p.label ?? v.label, style);
  const boxById = async (id: string) => {
    const n = id ? await figma.getNodeByIdAsync(id) : null;
    return n && boxOf(n);
  };
  if (p.fromSide !== undefined || p.fromT !== undefined) {
    await setEnd(c, 'from', { ...v.from, side: p.fromSide ?? v.from.side, t: p.fromT ?? v.from.t }, await boxById(v.to.id));
  }
  if (p.toSide !== undefined || p.toT !== undefined) {
    await setEnd(c, 'to', { ...v.to, side: p.toSide ?? v.to.side, t: p.toT ?? v.to.t }, await boxById(v.from.id));
  }
}

export function swapEnds(c: ConnectorNode) {
  const s = c.connectorStart;
  c.connectorStart = c.connectorEnd;
  c.connectorEnd = s;
  const aim = readAim(c);
  writeAim(c, { from: aim.to, to: aim.from });
  const raw = c.getSharedPluginData(NS, KEY);
  if (raw) {
    try {
      const d = JSON.parse(raw) as { from: string; to: string };
      c.setSharedPluginData(NS, KEY, JSON.stringify({ from: d.to, to: d.from }));
    } catch {
      // Unreadable record: leave it, it only feeds the detached check.
    }
  }
}
