"""Icon Composer–style (Liquid Glass) rendition of the Imán symbol.

Figma shows plugin icons as flat images, so light, sheen, specular edge and shadows are baked in.
For a native Apple icon, `icon-composer/` has the flat, unmasked layers to import into Icon Composer,
which renders real Liquid Glass. Run: python3 glass.py  (writes glass/ and icon-composer/)
"""
import math, os
from geometry import PRESETS, body_with_counter, poles_path, svg, f

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
for d in ("glass", "icon-composer"):
    os.makedirs(d, exist_ok=True)

IMAN, TINTA, PAPEL = "#F2462E", "#15171C", "#F7F5F1"
P = PRESETS["regular"]
BODY, POLES = body_with_counter(**P), poles_path(**P)
SCALE, NUDGE = 0.66, -3            # mark size on the tile; optical lift
MARK = f"translate({f(128 - 128 * SCALE)} {f(128 - 128 * SCALE + NUDGE)}) scale({SCALE})"

def squircle(n=5.0, steps=180, size=256):
    """Continuous-curvature tile (superellipse), the shape macOS uses for app icons."""
    pts = []
    for i in range(steps):
        t = 2 * math.pi * i / steps
        c, s = math.cos(t), math.sin(t)
        x = abs(c) ** (2 / n) * (1 if c >= 0 else -1)
        y = abs(s) ** (2 / n) * (1 if s >= 0 else -1)
        pts.append((size / 2 + x * size / 2, size / 2 + y * size / 2))
    return "M" + " L".join(f"{x:.2f} {y:.2f}" for x, y in pts) + " Z"

APPEARANCE = {
    # tile gradient, body stops, pole stops, shadow colour/opacity, rim strength
    "light": dict(tile=("radial", "#FFFFFF", "#F6F3EE", "#E9E5DE"),
                  body=("#FF7458", "#F2462E", "#E23B25"),
                  poles=("#3A3E47", "#1D2026", "#15171C"),
                  shadow=("#7A2414", .14), pole_shadow=("#101215", .16), rim=.6),
    "dark":  dict(tile=("radial", "#33363F", "#1B1D23", "#0E0F13"),
                  body=("#FF7458", "#F2462E", "#E23B25"),
                  poles=("#FFFFFF", "#F1F2F4", "#DCE0E6"),
                  shadow=("#000000", .3), pole_shadow=("#000000", .3), rim=.5),
}

def defs(a, k):
    A = APPEARANCE[a]
    _, t0, t1, t2 = A["tile"]
    b0, b1, b2 = A["body"]; p0, p1, p2 = A["poles"]
    return f'''
<radialGradient id="tile{k}" cx=".32" cy=".12" r="1.05"><stop offset="0" stop-color="{t0}"/><stop offset=".55" stop-color="{t1}"/><stop offset="1" stop-color="{t2}"/></radialGradient>
<linearGradient id="body{k}" x1=".25" y1="0" x2=".5" y2="1"><stop offset="0" stop-color="{b0}"/><stop offset=".48" stop-color="{b1}"/><stop offset="1" stop-color="{b2}"/></linearGradient>
<linearGradient id="poles{k}" x1=".3" y1="0" x2=".5" y2="1"><stop offset="0" stop-color="{p0}"/><stop offset=".5" stop-color="{p1}"/><stop offset="1" stop-color="{p2}"/></linearGradient>
<linearGradient id="sheen{k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="rim{k}" x1="0" y1="0" x2=".75" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="{A["rim"]}"/><stop offset=".3" stop-color="#fff" stop-opacity=".1"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient>
<clipPath id="inBody{k}"><path fill-rule="evenodd" clip-rule="evenodd" d="{BODY}"/></clipPath>
<clipPath id="inPoles{k}"><path d="{POLES}"/></clipPath>
<filter id="soft{k}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="contact{k}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter>'''

def mark(a, k):
    A = APPEARANCE[a]
    sc, so = A["shadow"]; pc, po = A["pole_shadow"]
    return f'''<g transform="{MARK}">
<path d="{BODY}" fill-rule="evenodd" fill="{sc}" opacity="{so}" filter="url(#soft{k})" transform="translate(0 6)"/>
<path d="{BODY}" fill-rule="evenodd" fill="#2a0d08" opacity=".12" filter="url(#contact{k})" transform="translate(0 1.5)"/>
<path d="{POLES}" fill="{pc}" opacity="{po}" filter="url(#soft{k})" transform="translate(0 6)"/>
<path d="{POLES}" fill="{pc}" opacity="{po:.2f}" filter="url(#contact{k})" transform="translate(0 1.5)"/>
<path d="{BODY}" fill-rule="evenodd" fill="url(#body{k})"/>
<g clip-path="url(#inBody{k})">
  <rect x="0" y="0" width="256" height="256" fill="url(#sheen{k})"/>
  <path d="{BODY}" fill="none" stroke="url(#rim{k})" stroke-width="2"/>
</g>
<path d="{POLES}" fill="url(#poles{k})"/>
<g clip-path="url(#inPoles{k})">
  <rect x="0" y="180" width="256" height="48" fill="url(#sheen{k})"/>
  <path d="{POLES}" fill="none" stroke="url(#rim{k})" stroke-width="2"/>
</g>
</g>'''

def icon(a, shape="squircle", size=1024):
    k = a[0]
    tile = (f'<path d="{squircle()}" fill="url(#tile{k})"/>' if shape == "squircle"
            else f'<rect width="256" height="256" fill="url(#tile{k})"/>')
    # a hairline inner edge on the squircle, like the system draws on light tiles
    edge = (f'<path d="{squircle()}" fill="none" stroke="#000" stroke-opacity=".06" stroke-width="1"/>'
            if shape == "squircle" and a == "light" else "")
    body = f"<defs>{defs(a, k)}</defs>{tile}{edge}{mark(a, k)}"
    return svg(body, f"Autoflow icon ({a})", w=size, h=size, vb="0 0 256 256")

def symbol_only():
    k = "s"; APPEARANCE["s"] = dict(APPEARANCE["light"])
    return svg(f"<defs>{defs('s', k)}</defs>{mark('s', k)}", "Autoflow glass symbol", w=1024, h=1024, vb="0 0 256 256")

for a in ("light", "dark"):
    open(f"glass/glass-icon-{a}.svg", "w").write(icon(a))
    open(f"glass/glass-icon-{a}-square.svg", "w").write(icon(a, shape="square"))
open("glass/glass-symbol.svg", "w").write(symbol_only())

# Icon Composer: flat, unmasked layers on the 1024 canvas, same placement as the glass icon.
L = APPEARANCE["light"]["tile"]
open("icon-composer/00-background.svg", "w").write(svg(
    f'<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{L[1]}"/>'
    f'<stop offset="1" stop-color="{L[3]}"/></linearGradient></defs><rect width="256" height="256" fill="url(#g)"/>',
    "Autoflow · background", w=1024, h=1024, vb="0 0 256 256"))
open("icon-composer/01-body.svg", "w").write(svg(
    f'<g transform="{MARK}"><path fill="{IMAN}" fill-rule="evenodd" d="{BODY}"/></g>', "Autoflow · body", w=1024, h=1024, vb="0 0 256 256"))
open("icon-composer/02-poles.svg", "w").write(svg(
    f'<g transform="{MARK}"><path fill="{TINTA}" d="{POLES}"/></g>', "Autoflow · poles", w=1024, h=1024, vb="0 0 256 256"))
print("glass/ and icon-composer/ written")
