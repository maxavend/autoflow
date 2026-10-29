// Pure helpers (no figma global) shared by the plugin and the tests: who
// connects to whom, and how our side/position anchors map to Figma endpoints.

import type { Cap, Dash, Kind, Side, SideOpt } from './model.ts';

export type LinkMode = 'pair' | 'chain' | 'fan';

// Ordered elements → [source, target] pairs. The first element is the source.
export function pairsFor<T>(nodes: T[], mode: LinkMode): [T, T][] {
  const out: [T, T][] = [];
  if (nodes.length < 2) return out;
  if (mode === 'pair') out.push([nodes[0], nodes[1]]);
  else if (mode === 'fan') for (let i = 1; i < nodes.length; i++) out.push([nodes[0], nodes[i]]);
  else for (let i = 1; i < nodes.length; i++) out.push([nodes[i - 1], nodes[i]]);
  return out;
}

// Click order wins over Figma's selection order: keep the ids already known in
// their order, then append the new ones.
export function mergeOrder(known: string[], current: string[]): string[] {
  return known.filter((id) => current.includes(id)).concat(current.filter((id) => !known.includes(id)));
}

// Sort by a preferred order (ids from the panel); unknown ids keep their place at the end.
export function sortBy<T extends { id: string }>(items: T[], order: string[]): T[] {
  if (!order.length) return items.slice();
  const rank = (n: T) => { const i = order.indexOf(n.id); return i < 0 ? order.length : i; };
  return items.slice().sort((a, b) => rank(a) - rank(b));
}

const EPS = 0.5;
const MAGNET: Record<Side, 'TOP' | 'RIGHT' | 'BOTTOM' | 'LEFT'> = { top: 'TOP', right: 'RIGHT', bottom: 'BOTTOM', left: 'LEFT' };

export type EndpointSpec =
  | { endpointNodeId: string; magnet: 'AUTO' | 'TOP' | 'RIGHT' | 'BOTTOM' | 'LEFT' }
  | { endpointNodeId: string; position: { x: number; y: number } };

// Side + t on a w×h element → Figma endpoint (magnet when centred, else an
// exact point in the element's own coordinates).
export function endpointSpec(id: string, side: SideOpt, t: number, w: number, h: number): EndpointSpec {
  if (side === 'auto') return { endpointNodeId: id, magnet: 'AUTO' };
  if (Math.abs(t - 0.5) < 0.005) return { endpointNodeId: id, magnet: MAGNET[side] };
  const x = side === 'left' ? 0 : side === 'right' ? w : t * w;
  const y = side === 'top' ? 0 : side === 'bottom' ? h : t * h;
  return { endpointNodeId: id, position: { x, y } };
}

export type Box = { x: number; y: number; width: number; height: number };

// Side of `a` that faces `b` (centres compared, wider gap wins).
export function facing(a: Box, b: Box): Side {
  const dx = b.x + b.width / 2 - (a.x + a.width / 2);
  const dy = b.y + b.height / 2 - (a.y + a.height / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

// Point on a side of `inner`, in the coordinates of `outer` (both absolute):
// aims an endpoint attached to `outer` at a layer inside it.
export function pointOn(inner: Box, outer: Box, side: Side, t: number): { x: number; y: number } {
  const x = inner.x - outer.x;
  const y = inner.y - outer.y;
  return {
    x: side === 'left' ? x : side === 'right' ? x + inner.width : x + t * inner.width,
    y: side === 'top' ? y : side === 'bottom' ? y + inner.height : y + t * inner.height,
  };
}

// Figma endpoint → side + t (the inverse of endpointSpec).
export function sideOf(ep: { magnet?: string; position?: { x: number; y: number } }, w: number, h: number): { side: SideOpt; t: number } {
  if (ep.magnet) {
    const m = ep.magnet.toLowerCase();
    return { side: m === 'top' || m === 'right' || m === 'bottom' || m === 'left' ? m : 'auto', t: 0.5 };
  }
  const p = ep.position;
  if (!p || !(w > 0) || !(h > 0)) return { side: 'auto', t: 0.5 };
  const round = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;
  if (Math.abs(p.y) < EPS) return { side: 'top', t: round(p.x / w) };
  if (Math.abs(p.y - h) < EPS) return { side: 'bottom', t: round(p.x / w) };
  if (Math.abs(p.x) < EPS) return { side: 'left', t: round(p.y / h) };
  if (Math.abs(p.x - w) < EPS) return { side: 'right', t: round(p.y / h) };
  return { side: 'auto', t: 0.5 };
}

export const CAP_TO_FIGMA: Record<Cap, ConnectorStrokeCap> = {
  none: 'NONE',
  arrow: 'ARROW_LINES',
  triangle: 'TRIANGLE_FILLED',
  equilateral: 'ARROW_EQUILATERAL',
  circle: 'CIRCLE_FILLED',
  diamond: 'DIAMOND_FILLED',
};

export function capFromFigma(c: string): Cap {
  for (const [k, v] of Object.entries(CAP_TO_FIGMA)) if (v === c) return k as Cap;
  return c === 'NONE' ? 'none' : 'arrow'; // ERD and future caps read as an arrow
}

export const KIND_TO_FIGMA: Record<Kind, ConnectorNode['connectorLineType']> = { elbow: 'ELBOWED', curve: 'CURVED', straight: 'STRAIGHT' };

export function kindFromFigma(t: string): Kind {
  return t === 'CURVED' ? 'curve' : t === 'STRAIGHT' ? 'straight' : 'elbow';
}

// Dash pattern scales with the stroke so it reads the same at any weight.
export function dashPattern(dash: Dash, weight: number): number[] {
  if (dash === 'dash') return [weight * 4, weight * 3];
  if (dash === 'dot') return [weight, weight * 2];
  return [];
}

export function dashFromPattern(p: ReadonlyArray<number>): Dash {
  if (!p.length) return 'solid';
  return p[0] <= p[1] ? 'dot' : 'dash';
}
