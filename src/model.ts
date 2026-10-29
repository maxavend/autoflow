// Connector model as the panel sees it. The connector itself is a native
// FigJam CONNECTOR node pasted into the Design file, so Figma keeps it attached
// to its endpoints; this module only describes and validates what we edit.

export const NS = 'autoflow';
export const KEY = 'conn';  // { from, to } ids at creation, to tell detached connectors apart
export const AIM = 'aim';   // { from, to } layer each end points at inside the node it is attached to
export const SEED = 'seed'; // set on the clipboard payload: marks a fresh paste to adopt

export type Kind = 'elbow' | 'curve' | 'straight';
export type Side = 'top' | 'right' | 'bottom' | 'left';
export type SideOpt = Side | 'auto';
export type Cap = 'none' | 'arrow' | 'triangle' | 'equilateral' | 'circle' | 'diamond';
export type Dash = 'solid' | 'dash' | 'dot';

export interface Endpoint {
  id: string;     // node id ('' when the end is free)
  side: SideOpt;
  t: number;      // 0..1 position along the side when side is fixed
}

export interface FontRef { family: string; style: string }

export interface Style {
  color: string;  // #rrggbb
  opacity: number;
  weight: number;
  dash: Dash;
  startCap: Cap;
  endCap: Cap;
  radius: number; // elbow corner radius
  labelColor: string;
  labelSize: number;
  labelFont: FontRef; // Figma style names: Regular, Medium, Semi Bold…
}

export interface ConnectorView {
  from: Endpoint;
  to: Endpoint;
  kind: Kind;
  style: Style;
  label: string;
  broken: boolean; // created attached, now an end lost its element
}

export interface Defaults { kind: Kind; style: Style }

export const DEFAULT_STYLE: Style = {
  color: '#0d99ff',
  opacity: 1,
  weight: 2,
  dash: 'solid',
  startCap: 'none',
  endCap: 'arrow',
  radius: 12,
  labelColor: '#1e1e1e',
  labelSize: 12,
  labelFont: { family: 'Inter', style: 'Medium' },
};

export const DEFAULTS: Defaults = { kind: 'elbow', style: DEFAULT_STYLE };

export const KINDS: Kind[] = ['elbow', 'curve', 'straight'];
export const SIDE_OPTS: SideOpt[] = ['auto', 'top', 'right', 'bottom', 'left'];
const CAPS: Cap[] = ['none', 'arrow', 'triangle', 'equilateral', 'circle', 'diamond'];
const DASHES: Dash[] = ['solid', 'dash', 'dot'];

const num = (v: unknown, d: number, lo = -Infinity, hi = Infinity) =>
  typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
export const pick = <T>(v: unknown, list: T[], d: T): T => (list.includes(v as T) ? (v as T) : d);
const hex = (v: unknown, d: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);

const font = (v: unknown, d: FontRef): FontRef => {
  const f = v as Partial<FontRef> | null;
  const ok = (x: unknown) => typeof x === 'string' && x.trim() !== '' && x.length <= 200;
  return f && ok(f.family) && ok(f.style) ? { family: f.family!, style: f.style! } : { ...d };
};

export function normalizeStyle(s: Partial<Style> | undefined, base: Style = DEFAULT_STYLE): Style {
  const x = s || {};
  return {
    color: hex(x.color, base.color),
    opacity: num(x.opacity, base.opacity, 0, 1),
    weight: num(x.weight, base.weight, 0.5, 24),
    dash: pick(x.dash, DASHES, base.dash),
    startCap: pick(x.startCap, CAPS, base.startCap),
    endCap: pick(x.endCap, CAPS, base.endCap),
    radius: num(x.radius, base.radius, 0, 200),
    labelColor: hex(x.labelColor, base.labelColor),
    labelSize: num(x.labelSize, base.labelSize, 6, 96),
    labelFont: font(x.labelFont, base.labelFont),
  };
}

export function normalizeDefaults(raw: Partial<Defaults> | undefined): Defaults {
  return { kind: pick(raw && raw.kind, KINDS, DEFAULTS.kind), style: normalizeStyle(raw && raw.style) };
}

// A named style the user saved to reuse: kind + style, kept per user (client
// storage), so it is there in every file.
export interface Preset { id: string; name: string; kind: Kind; style: Style }

export const MAX_PRESETS = 16;

export function normalizePreset(raw: unknown): Preset | null {
  const p = raw as Partial<Preset> | null;
  if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !p.id) return null;
  const name = typeof p.name === 'string' ? p.name.trim().slice(0, 40) : '';
  return { id: p.id.slice(0, 40), name: name || 'Estilo', ...normalizeDefaults(p) };
}

// Patch sent by the UI: any subset of top-level fields plus a partial style.
export interface Patch {
  kind?: Kind;
  label?: string;
  fromSide?: SideOpt;
  toSide?: SideOpt;
  fromT?: number;
  toT?: number;
  style?: Partial<Style>;
}

export function hexToRgb(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

export function rgbToHex(c: RGB): string {
  const b = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return `#${b(c.r)}${b(c.g)}${b(c.b)}`;
}
