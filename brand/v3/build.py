"""Autoflow logo v3 — symmetric A on an 8-unit grid (256 canvas).

S  = 32  stroke (4 modules)          R = 2S outer corner, r = S inner corner (concentric)
W  = 160 outer width (5S), legs at x 48–80 and 176–208, counter 3S
Top y=40, arc centres y=104; crossbar 30 thick (S − 6 %, horizontal optical thinning)
Anchors: circles d = 1.5S on the leg axes, centres y=192
"""
import math
S=32; R=64; r=32
X0,X1=48,208; TOP=40; LEG_END=192; DOT=24
BAR_Y,BAR_H=120,30
NUDGE=-4   # optical centre: mark sits slightly above geometric centre

def svg(body,title,w=256,h=256,extra=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
            f'role="img"{extra}><title>{title}</title>{body}</svg>\n')

def arch(right_end=LEG_END):
    cy=TOP+R
    return (f"M{X0} {LEG_END} V{cy} A{R} {R} 0 0 1 {X0+R} {TOP} H{X1-R} A{R} {R} 0 0 1 {X1} {cy} "
            f"V{right_end} H{X1-S} V{cy} A{r} {r} 0 0 0 {X1-R} {TOP+S} H{X0+R} A{r} {r} 0 0 0 {X0+S} {cy} V{LEG_END} Z")

def symbol_paths(fill="#000", ring_right=False):
    cxL,cxR=X0+S/2,X1-S/2
    p=[f'<path d="{arch(LEG_END-DOT+6 if ring_right else LEG_END)}"/>',
       f'<rect x="{X0+S-1}" y="{BAR_Y}" width="{X1-X0-2*S+2}" height="{BAR_H}"/>',
       f'<circle cx="{cxL:g}" cy="{LEG_END}" r="{DOT}"/>']
    if ring_right:
        p.append(f'<path fill-rule="evenodd" d="M{cxR-DOT:g} {LEG_END} a{DOT} {DOT} 0 1 0 {2*DOT} 0 a{DOT} {DOT} 0 1 0 {-2*DOT} 0 Z '
                 f'M{cxR-11:g} {LEG_END} a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0 Z"/>')
    else:
        p.append(f'<circle cx="{cxR:g}" cy="{LEG_END}" r="{DOT}"/>')
    return f'<g fill="{fill}">'+"".join(p)+'</g>'

def symbol(fill="#000",ring_right=False):
    return f'<g transform="translate(0 {NUDGE})">{symbol_paths(fill,ring_right)}</g>'

# ---------- wordmark: lowercase built on the same logic (stroke s, concentric corners) ----------
s=20; XH=92; ASC=128; ro=34; ri=ro-s; BAR=18

def rr(x0,y0,x1,y1,tl,tr,br,bl):
    d=f"M{x0+tl} {y0} H{x1-tr} "
    if tr: d+=f"A{tr} {tr} 0 0 1 {x1} {y0+tr} "
    d+=f"V{y1-br} "
    if br: d+=f"A{br} {br} 0 0 1 {x1-br} {y1} "
    d+=f"H{x0+bl} "
    if bl: d+=f"A{bl} {bl} 0 0 1 {x0} {y1-bl} "
    d+=f"V{y0+tl} "
    if tl: d+=f"A{tl} {tl} 0 0 1 {x0+tl} {y0} "
    return d+"Z"

def g_o(w=84):
    return (w, f'<path fill-rule="evenodd" d="{rr(0,-XH,w,0,ro,ro,ro,ro)} {rr(s,-XH+s,w-s,-s,ri,ri,ri,ri)}"/>', 0, w)
def g_a(w=84):
    return (w, f'<path fill-rule="evenodd" d="{rr(0,-XH,w,0,ro,0,0,ro)} {rr(s,-XH+s,w-s,-s,ri,0,0,ri)}"/>', 0, w)
def g_u(w=84):
    d=(f"M0 {-XH} V{-ro} A{ro} {ro} 0 0 0 {ro} 0 H{w} V{-XH} H{w-s} V{-s} H{ro} "
       f"A{ri} {ri} 0 0 1 {s} {-ro} V{-XH} Z")
    return (w, f'<path d="{d}"/>', 0, w)
def g_t():
    d=(f"M0 -116 H{s} V{-ro} A{ri} {ri} 0 0 0 {ro} {-s} H50 V0 H{ro} A{ro} {ro} 0 0 1 0 {-ro} Z")
    return (50, f'<path d="{d}"/><rect x="-18" y="{-XH}" width="68" height="{BAR}"/>', -18, 50)
def g_f():
    d=(f"M0 0 V{-ASC+ro} A{ro} {ro} 0 0 1 {ro} {-ASC} H54 V{-ASC+s} H{ro} A{ri} {ri} 0 0 0 {s} {-ASC+ro} V0 Z")
    return (54, f'<path d="{d}"/><rect x="-18" y="{-XH}" width="68" height="{BAR}"/>', -18, 54)
def g_l():
    return (s, f'<rect x="0" y="{-ASC}" width="{s}" height="{ASC}"/>', 0, s)
def g_w():
    c=40; w=3*s+2*c; m0=s+c; m1=m0+s
    d=(f"M0 {-XH} V{-ro} A{ro} {ro} 0 0 0 {ro} 0 H{w-ro} A{ro} {ro} 0 0 0 {w} {-ro} V{-XH} H{w-s} V{-ro} "
       f"A{ri} {ri} 0 0 1 {w-ro} {-s} H{m1} V{-XH} H{m0} V{-s} H{ro} A{ri} {ri} 0 0 1 {s} {-ro} V{-XH} Z")
    return (w, f'<path d="{d}"/>', 0, w)

# letter, gap to previous glyph's right extent (measured stem-to-stem / edge-to-edge)
SEQ=[(g_a,0),(g_u,20),(g_t,26),(g_o,14),(g_f,24),(g_l,16),(g_o,18),(g_w,16)]

def wordmark(fill="#000"):
    x=0; prev_right=None; out=[]
    for fn,gap in SEQ:
        w,body,lft,rgt=fn()
        ox = 0 if prev_right is None else prev_right+gap-lft
        if prev_right is not None and lft<0:  # crossbar overhang: space from the stem, not the bar
            ox = prev_right+gap
        out.append(f'<g transform="translate({ox} 0)">{body}</g>')
        prev_right=ox+rgt
    return f'<g fill="{fill}">'+"".join(out)+'</g>', prev_right

WM,WM_W=wordmark()

def lockup(fill="#000"):
    k=0.84; gap=56; base=186
    wm,_=wordmark(fill)
    x=X1+gap
    w=math.ceil(x+WM_W*k+X0-8)
    body=symbol(fill)+f'<g transform="translate({x} {base}) scale({k})">{wm}</g>'
    return svg(body,"Autoflow logo",w=w,h=256)

open("autoflow-symbol.svg","w").write(svg(symbol(),"Autoflow symbol"))
open("autoflow-symbol-direction.svg","w").write(svg(symbol(ring_right=True),"Autoflow symbol, direction variant"))
open("autoflow-lockup.svg","w").write(lockup())
open("autoflow-wordmark.svg","w").write(svg(f'<g transform="translate(24 172)">{WM}</g>',"Autoflow wordmark",w=WM_W+48+18,h=220))

# ---------- construction sheet ----------
def construction():
    G=[]
    for i in range(0,257,8):
        sw="0.6" if i%32 else "1.1"; op="0.35" if i%32 else "0.6"
        G.append(f'<line x1="{i}" y1="0" x2="{i}" y2="256" stroke="#2f7cf6" stroke-width="{sw}" opacity="{op}"/>')
        G.append(f'<line x1="0" y1="{i}" x2="256" y2="{i}" stroke="#2f7cf6" stroke-width="{sw}" opacity="{op}"/>')
    ky='stroke="#e5246b" stroke-width="1.2" fill="none"'
    cy=TOP+R
    K=[f'<line x1="128" y1="0" x2="128" y2="256" {ky} stroke-dasharray="4 3"/>',
       f'<circle cx="{X0+R}" cy="{cy}" r="{R}" {ky}/>',f'<circle cx="{X1-R}" cy="{cy}" r="{R}" {ky}/>',
       f'<circle cx="{X0+R}" cy="{cy}" r="{r}" {ky}/>',f'<circle cx="{X1-R}" cy="{cy}" r="{r}" {ky}/>',
       f'<circle cx="{X0+16}" cy="{LEG_END}" r="{DOT}" {ky}/>',f'<circle cx="{X1-16}" cy="{LEG_END}" r="{DOT}" {ky}/>',
       f'<line x1="0" y1="{TOP}" x2="256" y2="{TOP}" {ky}/>',f'<line x1="0" y1="{LEG_END+DOT}" x2="256" y2="{LEG_END+DOT}" {ky}/>',
       f'<line x1="{X0}" y1="0" x2="{X0}" y2="256" {ky}/>',f'<line x1="{X1}" y1="0" x2="{X1}" y2="256" {ky}/>']
    for c in [(X0+R,cy),(X1-R,cy),(X0+16,LEG_END),(X1-16,LEG_END)]:
        K.append(f'<circle cx="{c[0]}" cy="{c[1]}" r="1.8" fill="#e5246b"/>')
    lab='font-family="Inter, Helvetica Neue, Arial" font-size="9"'
    rows=[("Módulo","8 · lienzo 32 × 32 módulos"),("S","32 = trazo vertical (4 módulos)"),
          ("R / r","2S / S, radios concéntricos"),("Travesaño","0.94S, corrección óptica"),
          ("Anclas","⌀ 1.5S sobre el eje de cada pierna"),("Caja","5S de ancho × 5.5S de alto"),
          ("Eje","simetría vertical en x = 128"),("Ajuste","−4 hacia el centro óptico")]
    L=[f'<text x="280" y="44" font-family="Inter, Helvetica Neue, Arial" font-size="12" font-weight="700" fill="#111">Construcción</text>']
    for i,(k,v) in enumerate(rows):
        y=72+i*22
        L.append(f'<text x="280" y="{y}" {lab} font-weight="700" fill="#e5246b">{k}</text><text x="340" y="{y}" {lab} fill="#1a1a1a">{v}</text>')
    mark=f'<g transform="translate(0 {NUDGE})"><g opacity="0.92">{symbol_paths("#111")}</g>{"".join(K)}</g>'
    return svg('<rect width="500" height="256" fill="#fff"/>'+"".join(G)+mark+"".join(L),"Autoflow construction",w=500)
open("autoflow-construction.svg","w").write(construction())
