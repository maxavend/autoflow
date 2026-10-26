"""Builds every Autoflow brand file from geometry.py. Run: python3 build_kit.py"""
import math, os
from geometry import X0, X1, TOP, BASE, PRESETS, symbol_paths, svg, load_wordmark, f

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
for d in ("logo", "figma", "sheets"):
    os.makedirs(d, exist_ok=True)

# ---- palette -----------------------------------------------------------------------------
IMAN, TINTA, PAPEL, ACERO, CAMPO = "#F2462E", "#15171C", "#F7F5F1", "#8B929C", "#FDE4DD"
PALETTE = [  # name, hex, role, cmyk, pantone (nearest)
    ("Imán",  IMAN,  "Color de marca. Cuerpo del imán, acentos, conectores.", "0 85 85 0",  "Warm Red C"),
    ("Tinta", TINTA, "Polos, wordmark, texto y fondos oscuros.",              "75 65 55 85", "Black 6 C"),
    ("Papel", PAPEL, "Fondo claro. Polos sobre fondo oscuro.",                "2 2 4 0",     "—"),
    ("Acero", ACERO, "Texto secundario, líneas, estados neutros.",            "45 32 25 5",  "Cool Gray 8 C"),
    ("Campo", CAMPO, "Superficies suaves y fondos de destaque.",              "0 12 10 0",   "489 C"),
]

def lum(h):
    c = [int(h[i:i+2], 16) / 255 for i in (1, 3, 5)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
def contrast(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)
def rgb(h):
    return " ".join(str(int(h[i:i+2], 16)) for i in (1, 3, 5))

# ---- symbol variants -------------------------------------------------------------------------
THIN = 1.0   # reversed artwork: light-on-dark looks heavier (irradiation)
SYM = {
    "color":       dict(body=IMAN,  poles=TINTA),
    "on-dark":     dict(body=IMAN,  poles=PAPEL, thin=THIN),
    "black":       dict(body=TINTA, poles=TINTA),
    "white":       dict(body=PAPEL, poles=PAPEL, thin=THIN),
    "iman":        dict(body=IMAN,  poles=IMAN),
    "on-iman":     dict(body=PAPEL, poles=TINTA, thin=THIN),
}
def sym(variant="color", preset="regular"):
    return symbol_paths(preset, **SYM[variant])

for v in SYM:
    open(f"logo/autoflow-symbol-{v}.svg", "w").write(svg(sym(v), f"Autoflow symbol ({v})"))
for v in ("color", "on-dark", "black", "white"):
    open(f"logo/autoflow-symbol-small-{v}.svg", "w").write(svg(sym(v, "small"), f"Autoflow symbol, small sizes ({v})"))

# ---- wordmark & lockups ----------------------------------------------------------------------
v3 = load_wordmark()
WM_W = v3.WM_W
K = 80 / v3.XH                      # wordmark x-height = 2.5S
WM_ASC = v3.ASC * K
def wm(fill):
    return v3.wordmark(fill)[0]

open("logo/autoflow-wordmark.svg", "w").write(
    svg(f'<g transform="translate(16 {16+WM_ASC:.2f}) scale({K:.4f})">{wm(TINTA)}</g>', "Autoflow wordmark",
        w=math.ceil(WM_W * K + 32), h=math.ceil(WM_ASC + 32)))
open("logo/autoflow-wordmark-white.svg", "w").write(
    svg(f'<g transform="translate(16 {16+WM_ASC:.2f}) scale({K:.4f})">{wm(PAPEL)}</g>', "Autoflow wordmark (white)",
        w=math.ceil(WM_W * K + 32), h=math.ceil(WM_ASC + 32)))

S = 32
LEG_END = BASE - 32 - 16           # top of the magnet's cut: the wordmark baseline sits on it
H_GAP = 1.5 * S
LOCK = {"color": ("color", TINTA), "on-dark": ("on-dark", PAPEL), "black": ("black", TINTA), "white": ("white", PAPEL)}

def horizontal(v):
    sv, wf = LOCK[v]
    x = X1 + H_GAP
    w = math.ceil(x + WM_W * K + X0)
    body = sym(sv) + f'<g transform="translate({f(x)} {LEG_END}) scale({K:.4f})">{wm(wf)}</g>'
    return svg(body, f"Autoflow logo, horizontal ({v})", w=w, h=256)

def stacked(v):
    sv, wf = LOCK[v]
    ww = WM_W * K
    w = math.ceil(max(ww, X1 - X0) + 2 * X0)
    sx = (w - 256) / 2
    wy = BASE + S + WM_ASC
    h = math.ceil(wy + TOP)
    body = (f'<g transform="translate({f(sx)} 0)">{sym(sv)}</g>'
            f'<g transform="translate({f((w-ww)/2)} {f(wy)}) scale({K:.4f})">{wm(wf)}</g>')
    return svg(body, f"Autoflow logo, stacked ({v})", w=w, h=h)

for v in LOCK:
    open(f"logo/autoflow-horizontal-{v}.svg", "w").write(horizontal(v))
    open(f"logo/autoflow-stacked-{v}.svg", "w").write(stacked(v))

# ---- flat icon tile (favicons, sizes ≤ 32 px) ---------------------------------------------------
def icon(preset="regular"):
    sc = 0.64
    t = f"translate({f(128-128*sc)} {f(128-128*sc-2)}) scale({sc})"
    return svg(f'<rect width="256" height="256" fill="{TINTA}"/><g transform="{t}">{sym("on-dark", preset)}</g>',
               "Autoflow plugin icon")
open("figma/icon.svg", "w").write(icon())
open("figma/icon-small.svg", "w").write(icon("small"))
# favicon: the small cut on a rounded ink tile, so the dark poles never sit on a dark browser tab
os.makedirs("web", exist_ok=True)
open("web/favicon.svg", "w").write(icon("small").replace(
    f'<rect width="256" height="256" fill="{TINTA}"/>', f'<rect width="256" height="256" rx="56" fill="{TINTA}"/>'))

FONT = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif"   # Inter if installed

# ---- construction sheet -------------------------------------------------------------------
def construction():
    G = []
    for i in range(0, 257, 8):
        sw, op = ("1.1", "0.55") if i % 32 == 0 else ("0.6", "0.3")
        G += [f'<line x1="{i}" y1="0" x2="{i}" y2="256" stroke="#2f7cf6" stroke-width="{sw}" opacity="{op}"/>',
              f'<line x1="0" y1="{i}" x2="256" y2="{i}" stroke="#2f7cf6" stroke-width="{sw}" opacity="{op}"/>']
    k = 'stroke="#e5246b" stroke-width="1.2" fill="none"'
    cy = TOP + 64
    ys = [TOP, BASE - 32, BASE - 48, BASE - 80, BASE - 110, TOP + 32, BASE]
    K_ = [f'<line x1="128" y1="0" x2="128" y2="256" {k} stroke-dasharray="4 3"/>']
    K_ += [f'<circle cx="{c}" cy="{cy}" r="{r}" {k}/>' for c in (112, 144) for r in (64, 32)]
    K_ += [f'<line x1="0" y1="{y}" x2="256" y2="{y}" {k}/>' for y in ys]
    K_ += [f'<line x1="{x}" y1="0" x2="{x}" y2="256" {k}/>' for x in (X0, X0 + 32, X1 - 32, X1)]
    K_ += [f'<circle cx="{c}" cy="{cy}" r="1.8" fill="#e5246b"/>' for c in (112, 144)]
    lab = f'font-family="{FONT}" font-size="9"'
    rows = [("Módulo", "8 · lienzo de 32 × 32 módulos"), ("S", "32 · grosor del trazo"),
            ("R / r", "2S / S · radios concéntricos"), ("Caja", "5S × 6S · eje de simetría x = 128"),
            ("Ritmo", "polo S · corte S/2 · pierna S · travesaño 0,94S"),
            ("Óptica", "travesaño −6 % · versión invertida −1 u"),
            ("Suavizado", "esquinas rectas con radio de 1 módulo (8)"),
            ("Corte chico", "trazo 1,25S y corte 0,75S bajo 24 px")]
    L = [f'<text x="280" y="44" font-family="{FONT}" font-size="12" font-weight="700" fill="{TINTA}">Construcción</text>']
    for i, (a, b) in enumerate(rows):
        y = 72 + i * 22
        L.append(f'<text x="280" y="{y}" {lab} font-weight="700" fill="#e5246b">{a}</text>'
                 f'<text x="352" y="{y}" {lab} fill="{TINTA}">{b}</text>')
    return svg(f'<rect width="600" height="256" fill="#fff"/>{"".join(G)}'
               f'<g opacity=".9">{symbol_paths("regular", "#1b1b1b", "#1b1b1b")}</g>{"".join(K_)}{"".join(L)}',
               "Autoflow construction", w=600)
open("sheets/construction.svg", "w").write(construction())

if __name__ == "__main__":
    print(f"wordmark scale {K:.4f}, ascender {WM_ASC:.1f}")
    for n, h, *_ in PALETTE:
        print(f"{n:6} {h}  vs Papel {contrast(h, PAPEL):5.2f}  vs Tinta {contrast(h, TINTA):5.2f}  vs white {contrast(h, '#FFFFFF'):5.2f}")

# ---- one-page brand sheet (HTML → PNG with render.sh) --------------------------------------
def brand_sheet():
    sw = "".join(
        f'<div class="sw"><div class="chip" style="background:{h}"></div><b>{n}</b><code>{h}</code>'
        f'<span>RGB {rgb(h)}</span><span>CMYK {c}</span><span>Pantone {p}</span><em>{role}</em></div>'
        for n, h, role, c, p in PALETTE)
    pairs = [("Papel", PAPEL, "autoflow-horizontal-color.svg", "Principal"),
             ("Tinta", TINTA, "autoflow-horizontal-on-dark.svg", "Sobre oscuro"),
             ("#FFFFFF", "#FFFFFF", "autoflow-horizontal-black.svg", "Una tinta"),
             ("Imán", IMAN, "autoflow-horizontal-white.svg", "Sobre Imán")]
    vers = "".join(f'<figure style="background:{bg}"><img src="../logo/{src}"><figcaption style="color:{'#ffffffb3' if bg in (TINTA, IMAN) else ACERO}">{cap}</figcaption></figure>'
                   for _, bg, src, cap in pairs)
    syms = "".join(f'<figure style="background:{bg}"><img class="s" src="../logo/{src}"></figure>'
                   for bg, src in [(PAPEL, "autoflow-symbol-color.svg"), (TINTA, "autoflow-symbol-on-dark.svg"),
                                   (IMAN, "autoflow-symbol-on-iman.svg"), ("#fff", "autoflow-symbol-black.svg")])
    ladder = "".join(f'<div class="px"><img src="../figma/icon{"-small" if n < 48 else ""}.svg" width="{n}" height="{n}">'
                     f'<span>{n}</span></div>' for n in (128, 64, 48, 32, 16))
    bad = [("Deformar", 'style="transform:scaleX(1.45)"'), ("Colores fuera de paleta", 'style="filter:hue-rotate(190deg)"'),
           ("Rotar", 'style="transform:rotate(-18deg)"'), ("Sombras o efectos", 'style="filter:drop-shadow(6px 8px 0 #8B929C)"')]
    misuse = "".join(f'<figure class="bad"><img class="s" src="../logo/autoflow-symbol-color.svg" {st}>'
                     f'<figcaption>✕ {t}</figcaption></figure>' for t, st in bad)
    return f"""<!doctype html><html lang="es"><meta charset="utf-8"><title>Autoflow · Marca</title>
<style>
*{{box-sizing:border-box}} body{{margin:0;background:{PAPEL};color:{TINTA};font-family:{FONT};}}
.page{{width:1600px;padding:72px 80px 80px}} h2{{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:{IMAN};margin:56px 0 18px}}
.hero{{display:grid;grid-template-columns:auto 1fr;gap:64px;align-items:center}} .hero img{{height:140px}}
.hero p{{font-size:26px;line-height:1.35;margin:0;max-width:620px}} .hero small{{display:block;color:#4A4F57;font-size:17px;margin-top:12px}}
.pal{{display:grid;grid-template-columns:repeat(5,1fr);gap:20px}} .sw{{display:flex;flex-direction:column;gap:4px;font-size:14px}}
.chip{{height:120px;border-radius:14px;border:1px solid #0001;margin-bottom:8px}} .sw b{{font-size:18px}} .sw code{{font-size:15px}}
.sw span{{color:#4A4F57}} .sw em{{font-style:normal;color:#4A4F57;margin-top:6px}}
.grid4{{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}} figure{{margin:0;border-radius:16px;height:180px;display:flex;
 align-items:center;justify-content:center;position:relative;border:1px solid #0000000f}} figure img{{max-width:78%;max-height:44%}}
figure img.s{{max-height:62%}} figcaption{{position:absolute;left:16px;bottom:12px;font-size:13px;color:#8B929C}}
.cols{{display:grid;grid-template-columns:1.25fr 1fr;gap:48px}} .clear{{background:#fff;border-radius:16px;padding:40px;border:1px solid #0000000f}}
.clear .box{{position:relative;display:inline-block;outline:2px dashed {IMAN};outline-offset:-1px}}
.clear .box img{{height:150px;display:block}} .clear p,.min p{{font-size:15px;line-height:1.5;color:#4A4F57;margin:18px 0 0}}
.ladder{{display:flex;gap:28px;align-items:flex-end;background:#fff;border-radius:16px;padding:32px;border:1px solid #0000000f}}
.px{{display:flex;flex-direction:column;align-items:center;gap:10px;font-size:12px;color:#8B929C}} .px img{{border-radius:22%}}
.bad{{background:#fff}} .bad figcaption{{color:{IMAN}}}
.type{{display:grid;grid-template-columns:1fr 1fr;gap:20px}} .type div{{background:#fff;border-radius:16px;padding:28px;border:1px solid #0000000f}}
.type img{{height:54px}} .type .big{{font-size:44px;font-weight:700;letter-spacing:-1px}} .type p{{color:#4A4F57;font-size:15px;line-height:1.5;margin:14px 0 0}}
</style><div class="page">
<div class="hero"><img src="../logo/autoflow-stacked-color.svg"><div><p>La A de Autoflow es un imán: el arco atrae, los polos sostienen. Lo que conectas, se queda conectado.</p>
<small>Retícula de 8 · trazo S = 32 · radios 2S / S · simetría vertical</small></div></div>
<h2>Paleta</h2><div class="pal">{sw}</div>
<h2>Versiones del logo</h2><div class="grid4">{vers}</div>
<div class="grid4" style="margin-top:20px">{syms}</div>
<div class="cols"><div><h2>Área de resguardo</h2><div class="clear"><div class="box"><img src="../logo/autoflow-horizontal-color.svg"></div>
<p>Deja libre alrededor del logo al menos <b>la altura de un polo (S)</b>, que es ⅙ de la altura del símbolo. Los SVG maestros ya traen ese aire dentro (línea punteada): colócalos por su caja sin recortarla. El área crece con el logo; nunca es una medida fija.</p></div></div>
<div class="min"><h2>Tamaños mínimos</h2><div class="ladder">{ladder}</div>
<p>Horizontal: 96 px de ancho. Símbolo: 16 px. Bajo 24 px usa siempre el <b>corte chico</b> (<code>*-small-*</code>, ícono <code>icon-small</code>): piernas más gruesas y corte más ancho, para que los polos no se peguen.</p></div></div>
<h2>Tipografía</h2><div class="type"><div><img src="../logo/autoflow-wordmark.svg"><p>Wordmark dibujado a medida sobre la misma lógica del símbolo: esquinas concéntricas, terminales rectos. No se escribe con una fuente: usa siempre el archivo.</p></div>
<div><span class="big">Inter Bold / Regular</span><p>Para títulos y textos (es la tipografía de la UI de Figma y tiene licencia OFL). Si Inter no está disponible: Helvetica Neue o la fuente del sistema.</p></div></div>
<h2>Usos incorrectos</h2><div class="grid4">{misuse}</div>
</div></html>"""
open("sheets/brand-sheet.html", "w").write(brand_sheet())
