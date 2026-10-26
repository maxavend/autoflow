"""Autoflow v4 — metaphor concepts grown from the v3 grid A (8-unit grid, S = 32, 256 canvas).

metro   "Línea A": the A drawn as an octilinear transit line (45° bends) ending in two stations.
magnet  "Imán":    the squared arch is a horseshoe magnet; the feet are its poles, split by a gap.
lashing "Amarre":  the crossbar is a band that ties both legs, woven over the left, under the right.
"""
import math, os, sys, importlib
HERE=os.path.dirname(os.path.abspath(__file__))
V3=os.path.join(HERE,"..","v3")
cwd=os.getcwd(); os.chdir(V3); sys.path.insert(0,V3); v3=importlib.import_module("build"); os.chdir(cwd)

S=32; X0,X1=48,208; TOP=40; BASE=216
def svg(body,title,w=256,h=256):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
            f'role="img"><title>{title}</title>{body}</svg>\n')
def f(n): return f"{n:.2f}".rstrip("0").rstrip(".")

def offset_polyline(pts,d):
    """Left/right offset of a polyline with mitre joins -> closed outline."""
    def side(sign):
        out=[]
        segs=list(zip(pts,pts[1:]))
        lines=[]
        for (x0,y0),(x1,y1) in segs:
            L=math.hypot(x1-x0,y1-y0); nx,ny=-(y1-y0)/L*sign,(x1-x0)/L*sign
            lines.append(((x0+nx*d,y0+ny*d),(x1+nx*d,y1+ny*d)))
        out.append(lines[0][0])
        for (a0,a1),(b0,b1) in zip(lines,lines[1:]):
            dx1,dy1=a1[0]-a0[0],a1[1]-a0[1]; dx2,dy2=b1[0]-b0[0],b1[1]-b0[1]
            den=dx1*dy2-dy1*dx2
            t=((b0[0]-a0[0])*dy2-(b0[1]-a0[1])*dx2)/den
            out.append((a0[0]+t*dx1,a0[1]+t*dy1))
        out.append(lines[-1][1]); return out
    a=side(1); b=side(-1)[::-1]
    return "M"+" L".join(f"{f(x)} {f(y)}" for x,y in a+b)+" Z"

def ring(cx,cy,ro,ri):
    return (f"M{f(cx-ro)} {f(cy)} a{ro} {ro} 0 1 0 {2*ro} 0 a{ro} {ro} 0 1 0 {-2*ro} 0 Z "
            f"M{f(cx-ri)} {f(cy)} a{ri} {ri} 0 1 0 {2*ri} 0 a{ri} {ri} 0 1 0 {-2*ri} 0 Z")

# ---- A · Línea A (metro) -------------------------------------------------
# The route is an octilinear line (45° bends); the crossbar is a transit interchange:
# two stations joined by a link, the same sign a connector between two screens makes.
def metro():
    xl,xr=X0+S/2,X1-S/2; top=TOP+S/2; ch=48
    line=[(xl,BASE),(xl,top+ch),(xl+ch,top),(xr-ch,top),(xr,top+ch),(xr,BASE)]
    sy=136; ro,ri=30,14
    p=[f'<path d="{offset_polyline(line,S/2)}"/>',
       f'<rect x="{xl}" y="{sy-11}" width="{xr-xl}" height="22"/>']
    for cx in (xl,xr):
        p.append(f'<circle cx="{f(cx)}" cy="{sy}" r="{ro}" fill="#fff"/>')
        p.append(f'<path fill-rule="evenodd" d="{ring(cx,sy,ro-2,ri)}"/>')
    return '<g fill="#000" transform="translate(0 -2)">'+"".join(p)+'</g>'

# ---- B · Imán (magnet) ---------------------------------------------------
def magnet():
    R,r=64,32; cy=TOP+R; gap=16; pole=34; leg_end=BASE-pole-gap
    arch=(f"M{X0} {leg_end} V{cy} A{R} {R} 0 0 1 {X0+R} {TOP} H{X1-R} A{R} {R} 0 0 1 {X1} {cy} V{leg_end} "
          f"H{X1-S} V{cy} A{r} {r} 0 0 0 {X1-R} {TOP+S} H{X0+R} A{r} {r} 0 0 0 {X0+S} {cy} V{leg_end} Z")
    p=[f'<path d="{arch}"/>',f'<rect x="{X0+S-1}" y="114" width="{X1-X0-2*S+2}" height="30"/>',
       f'<rect x="{X0}" y="{BASE-pole}" width="{S}" height="{pole}"/>',
       f'<rect x="{X1-S}" y="{BASE-pole}" width="{S}" height="{pole}"/>']
    return '<g fill="#000" transform="translate(0 -4)">'+"".join(p)+'</g>'

# ---- C · Constelación ---------------------------------------------------
# Five nodes (screens) joined by flows; legs at exactly 60°, nodes sized like stars.
def constellation():
    ay,fy=44,204; h=fy-ay; dx=h/math.tan(math.radians(60))
    apex=(128,ay); fl=(128-dx,fy); fr=(128+dx,fy)
    cy=ay+0.58*h; cdx=(cy-ay)/math.tan(math.radians(60))
    cl=(128-cdx,cy); cr=(128+cdx,cy)
    w=7
    lines=[offset_polyline([fl,apex,fr],w), offset_polyline([cl,cr],w)]
    nodes=[(apex,24),(cl,15),(cr,15),(fl,19),(fr,19)]
    p=[f'<path d="{d}"/>' for d in lines]
    p+= [f'<circle cx="{f(x)}" cy="{f(y)}" r="{r}"/>' for (x,y),r in nodes]
    return '<g fill="#000" transform="translate(128 126) scale(0.86) translate(-128 -124)">'+"".join(p)+'</g>'

CONCEPTS={"metro":(metro,"Línea A"),"magnet":(magnet,"Imán"),"constellation":(constellation,"Constelación")}
for k,(fn,name) in CONCEPTS.items():
    body=fn()
    open(f"{k}-symbol.svg","w").write(svg(body,f"Autoflow · {name}"))
    k_=0.84; gap=56; base=186; x=X1+gap; w=math.ceil(x+v3.WM_W*k_+X0-8)
    lock=body+f'<g transform="translate({x} {base}) scale({k_})">{v3.WM}</g>'
    open(f"{k}-lockup.svg","w").write(svg(lock,f"Autoflow lockup · {name}",w=w))
