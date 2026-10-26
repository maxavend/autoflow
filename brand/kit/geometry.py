"""Autoflow · Imán — master geometry.

Grid: 256 canvas, 8-unit module, S = 32 (4 modules).
Box 5S × 6S (x 48–208, y 32–224), vertical axis x = 128.
Arch: outer R = 2S, inner r = R − S (concentric).
From the base up: pole S · gap S/2 · leg S · crossbar 0.94S (horizontal optical thinning) · counter.
Square corners are softened with a radius of one module (8 = S/4).
"""
import os
HERE = os.path.dirname(os.path.abspath(__file__))

X0, X1, TOP, BASE = 48, 208, 32, 224

def f(n):
    return f"{n:.2f}".rstrip("0").rstrip(".")

def _levels(S, R, gap, pole, leg, bar, thin):
    s = S - thin
    return dict(s=s, r=R - s, cy=TOP + R,
                pole_top=BASE - pole + thin / 2,
                leg_end=BASE - pole - gap - thin / 2,
                bar_bot=BASE - pole - gap - leg - thin / 2,
                bar_top=BASE - pole - gap - leg - bar + thin / 2)

def body_with_counter(S=32, R=64, gap=16, pole=32, leg=32, bar=30, soft=8, thin=0.0):
    """Arch + legs + crossbar as one outline, with the counter above the bar as the only hole.
    Every square corner gets radius `soft` (one module); the arch keeps its concentric R / r."""
    L = _levels(S, R, gap, pole, leg, bar, thin)
    s, r, cy, le, bb, bt, c = L["s"], L["r"], L["cy"], L["leg_end"], L["bar_bot"], L["bar_top"], soft
    q = lambda x, y, sweep: f"A{c} {c} 0 0 {sweep} {f(x)} {f(y)} "
    outer = (f"M{f(X0)} {f(le-c)} V{f(cy)} A{R} {R} 0 0 1 {f(X0+R)} {f(TOP)} H{f(X1-R)} "
             f"A{R} {R} 0 0 1 {f(X1)} {f(cy)} V{f(le-c)} " + q(X1-c, le, 1) +
             f"H{f(X1-s+c)} " + q(X1-s, le-c, 1) + f"V{f(bb+c)} " + q(X1-s-c, bb, 0) +
             f"H{f(X0+s+c)} " + q(X0+s, bb+c, 0) + f"V{f(le-c)} " + q(X0+s-c, le, 1) +
             f"H{f(X0+c)} " + q(X0, le-c, 1) + "Z")
    counter = (f"M{f(X0+s)} {f(bt-c)} V{f(cy)} A{f(r)} {f(r)} 0 0 1 {f(X0+R)} {f(TOP+s)} H{f(X1-R)} "
               f"A{f(r)} {f(r)} 0 0 1 {f(X1-s)} {f(cy)} V{f(bt-c)} " + q(X1-s-c, bt, 1) +
               f"H{f(X0+s+c)} " + q(X0+s, bt-c, 1) + "Z")
    return outer + " " + counter

def poles_path(S=32, R=64, gap=16, pole=32, leg=32, bar=30, soft=8, thin=0.0):
    L = _levels(S, R, gap, pole, leg, bar, thin)
    s, pt, c = L["s"], L["pole_top"], soft
    def box(x0, x1):
        return (f"M{f(x0+c)} {f(pt)} H{f(x1-c)} A{c} {c} 0 0 1 {f(x1)} {f(pt+c)} V{f(BASE-c)} "
                f"A{c} {c} 0 0 1 {f(x1-c)} {BASE} H{f(x0+c)} A{c} {c} 0 0 1 {f(x0)} {f(BASE-c)} "
                f"V{f(pt+c)} A{c} {c} 0 0 1 {f(x0+c)} {f(pt)} Z")
    return box(X0, X0 + s) + " " + box(X1 - s, X1)

PRESETS = {
    "regular": dict(S=32, R=64, gap=16, pole=32, leg=32, bar=30, soft=8),
    # ≤ 24 px: heavier legs, wider gap so the poles stay separate at 16 px
    "small":   dict(S=40, R=64, gap=24, pole=32, leg=24, bar=36, soft=8),
}

def symbol_paths(preset="regular", body="#000", poles="#000", thin=0.0):
    p = PRESETS[preset]
    b = body_with_counter(**p, thin=thin)
    pl = poles_path(**p, thin=thin)
    return (f'<path fill="{body}" fill-rule="evenodd" d="{b}"/>'
            f'<path fill="{poles}" d="{pl}"/>')

def svg(body, title, w=256, h=256, vb=None):
    vb = vb or f"0 0 {w} {h}"
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w}" height="{h}" '
            f'role="img"><title>{title}</title>{body}</svg>\n')

def load_wordmark():
    import wordmark
    return wordmark
