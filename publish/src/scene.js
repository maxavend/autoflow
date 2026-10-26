// Draws canvas scenes in SVG: screens (frames) and FigJam-style connectors.
// Coordinates are slide pixels inside the <svg>. Used by the cover and the carousel.
/* exported phone, connector */
const NS = 'http://www.w3.org/2000/svg';
const C = { iman: '#F2462E', ink: '#15171C', acero: '#8B929C', proto: '#0D99FF', line: '#E4E0D9', sk: '#EEEBE6' };

function el(parent, name, attrs = {}, text) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  parent.appendChild(n);
  return n;
}

// A phone-sized frame with a title bar, skeleton lines and a button; returns its box.
function phone(svg, x, y, { w = 220, h = 400, title = '', button = 'ink', ghost = false, lines = 4 } = {}) {
  const g = el(svg, 'g', ghost ? { opacity: 0.55 } : {});
  if (title) el(g, 'text', { x, y: y - 14, 'font-size': 20, 'font-weight': 600, fill: ghost ? C.acero : '#5D636D' }, title);
  el(g, 'rect', ghost
    ? { x, y, width: w, height: h, rx: 22, fill: 'none', stroke: C.acero, 'stroke-width': 3, 'stroke-dasharray': '12 10' }
    : { x, y, width: w, height: h, rx: 22, fill: '#fff', stroke: C.line, 'stroke-width': 2 });
  if (!ghost) {
    el(g, 'rect', { x: x + 22, y: y + 30, width: w * 0.45, height: 18, rx: 9, fill: C.ink });
    for (let i = 0; i < lines; i++)
      el(g, 'rect', { x: x + 22, y: y + 72 + i * 32, width: (w - 44) * (i % 2 ? 0.92 : 0.7), height: 12, rx: 6, fill: C.sk });
    if (button) el(g, 'rect', { x: x + 22, y: y + h - 70, width: w - 44, height: 44, rx: 12, fill: button === 'iman' ? C.iman : C.ink });
  }
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, r: x + w, b: y + h, btn: { x: x + 22, y: y + h - 70, w: w - 44, h: 44 } };
}

// Orthogonal path through points with rounded corners (radius r).
function elbowPath(pts, r = 26) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1], [x, y] = pts[i], [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(x - px, y - py), l2 = Math.hypot(nx - x, ny - y);
    const k = Math.min(r, l1 / 2, l2 / 2);
    const ax = x - ((x - px) / l1) * k, ay = y - ((y - py) / l1) * k;
    const bx = x + ((nx - x) / l2) * k, by = y + ((ny - y) / l2) * k;
    d += ` L${ax} ${ay} Q${x} ${y} ${bx} ${by}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  return `${d} L${lx} ${ly}`;
}

// A connector: kind elbow|curve|straight, start anchor dot, arrow at the end, optional label.
function connector(svg, pts, { color = C.iman, width = 6, kind = 'elbow', dash, label, start = true, end = 'arrow', ghost = false } = {}) {
  const g = el(svg, 'g', ghost ? { opacity: 0.45 } : {});
  const [x1, y1] = pts[0], [x2, y2] = pts[pts.length - 1];
  const [px, py] = pts[pts.length - 2] || pts[0];
  const len = Math.hypot(x2 - px, y2 - py) || 1;
  const ux = kind === 'curve' ? 1 : (x2 - px) / len, uy = kind === 'curve' ? 0 : (y2 - py) / len;
  const head = end === 'arrow' ? 20 : 0;
  const ex = x2 - ux * head, ey = y2 - uy * head;
  let d;
  if (kind === 'curve') {
    const mx = (x1 + ex) / 2;
    d = `M${x1} ${y1} C${mx} ${y1} ${mx} ${ey} ${ex} ${ey}`;
  } else if (kind === 'straight') {
    d = `M${x1} ${y1} L${ex} ${ey}`;
  } else {
    d = elbowPath([...pts.slice(0, -1), [ex, ey]]);
  }
  el(g, 'path', { d, fill: 'none', stroke: ghost ? C.acero : color, 'stroke-width': width, 'stroke-linejoin': 'round',
    'stroke-linecap': 'round', ...(dash || ghost ? { 'stroke-dasharray': dash || '14 12' } : {}) });
  if (end === 'arrow') {
    const nx = -uy, ny = ux;
    el(g, 'path', { d: `M${x2} ${y2} L${ex + nx * 13} ${ey + ny * 13} L${ex - nx * 13} ${ey - ny * 13} Z`,
      fill: ghost ? C.acero : color, 'stroke-linejoin': 'round', stroke: ghost ? C.acero : color, 'stroke-width': 2 });
  }
  if (start) el(g, 'circle', { cx: x1, cy: y1, r: 10, fill: '#fff', stroke: ghost ? C.acero : color, 'stroke-width': 5 });
  if (label) {
    // centre of the longest segment, where FigJam puts the label
    let mid = [(x1 + x2) / 2, (y1 + y2) / 2];
    if (kind === 'elbow' && pts.length > 2) {
      let best = 0;
      for (let i = 1; i < pts.length; i++) {
        const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        if (l > best) { best = l; mid = [(pts[i][0] + pts[i - 1][0]) / 2, (pts[i][1] + pts[i - 1][1]) / 2]; }
      }
    }
    const tw = label.length * 12 + 36;
    el(g, 'rect', { x: mid[0] - tw / 2, y: mid[1] - 22, width: tw, height: 44, rx: 10, fill: '#fff', stroke: C.line, 'stroke-width': 2 });
    el(g, 'text', { x: mid[0], y: mid[1] + 8, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 600, fill: C.ink }, label);
  }
  return g;
}
