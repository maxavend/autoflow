"""Autoflow wordmark — lowercase drawn on the symbol's logic.

Every glyph is an orthogonal outline whose corners carry their own radius:
bowls ro / ri (concentric, ro − ri = stroke), every other corner c = s/4, the same
softening ratio as the symbol (8 = 32/4). Baseline at y = 0, y grows downward.
"""
s, XH, ASC, BAR = 20, 92, 132, 18
ro, ri, c = 34, 14, 5

def _f(n):
    return f"{n:.2f}".rstrip("0").rstrip(".")

def outline(pts):
    """Closed path through axis-aligned corners [(x, y, radius), …], each corner rounded."""
    n = len(pts); d = []
    for i in range(n):
        (px, py, _), (x, y, r), (nx, ny, _) = pts[i - 1], pts[i], pts[(i + 1) % n]
        ix, iy = (x - px), (y - py); ox, oy = (nx - x), (ny - y)
        li, lo = abs(ix) + abs(iy), abs(ox) + abs(oy)
        ux, uy, vx, vy = ix / li, iy / li, ox / lo, oy / lo
        a = (x - ux * r, y - uy * r); b = (x + vx * r, y + vy * r)
        sweep = 1 if ux * vy - uy * vx > 0 else 0
        d.append(("M" if i == 0 else "L") + f"{_f(a[0])} {_f(a[1])}")
        if r:
            d.append(f"A{r} {r} 0 0 {sweep} {_f(b[0])} {_f(b[1])}")
    return " ".join(d) + " Z"

def box(x0, y0, x1, y1, tl, tr, br, bl):
    return [(x0, y0, tl), (x1, y0, tr), (x1, y1, br), (x0, y1, bl)]

W = 84
GLYPHS = {   # name: (outlines, left extent, right extent)
    "a": ([box(0, -XH, W, 0, ro, c, c, ro), box(s, -XH + s, W - s, -s, ri, c, c, ri)], 0, W),
    "o": ([box(0, -XH, W, 0, ro, ro, ro, ro), box(s, -XH + s, W - s, -s, ri, ri, ri, ri)], 0, W),
    "u": ([[(0, -XH, c), (s, -XH, c), (s, -s, ri), (W - s, -s, c), (W - s, -XH, c), (W, -XH, c),
            (W, 0, c), (0, 0, ro)]], 0, W),
    "t": ([[(0, -116, c), (s, -116, c), (s, -XH, c), (50, -XH, c), (50, -XH + BAR, c), (s, -XH + BAR, c),
            (s, -s, ri), (50, -s, c), (50, 0, c), (0, 0, ro), (0, -XH + BAR, c), (-18, -XH + BAR, c),
            (-18, -XH, c), (0, -XH, c)]], -18, 50),
    "f": ([[(0, 0, c), (0, -XH + BAR, c), (-18, -XH + BAR, c), (-18, -XH, c), (0, -XH, c), (0, -ASC, ro),
            (54, -ASC, c), (54, -ASC + s, c), (s, -ASC + s, ri), (s, -XH, c), (50, -XH, c),
            (50, -XH + BAR, c), (s, -XH + BAR, c), (s, 0, c)]], -18, 54),
    "l": ([box(0, -ASC, s, 0, c, c, c, c)], 0, s),
    "w": ([[(0, -XH, c), (s, -XH, c), (s, -s, ri), (60, -s, c), (60, -XH, c), (80, -XH, c), (80, -s, c),
            (120, -s, ri), (120, -XH, c), (140, -XH, c), (140, 0, ro), (0, 0, ro)]], 0, 140),
}
# letter, space after the previous glyph's right extent (crossbars may overhang into it)
SEQ = [("a", 0), ("u", 20), ("t", 26), ("o", 14), ("f", 24), ("l", 16), ("o", 18), ("w", 16)]

def wordmark(fill="#000"):
    x = None; out = []
    for ch, gap in SEQ:
        outs, lft, rgt = GLYPHS[ch]
        ox = 0 if x is None else x + gap
        d = " ".join(outline(o) for o in outs)
        out.append(f'<path transform="translate({ox} 0)" fill-rule="evenodd" d="{d}"/>')
        x = ox + rgt
    return f'<g fill="{fill}">' + "".join(out) + "</g>", x

WM, WM_W = wordmark()
