# The tool wall (#365), first person: a big perforated composite board on two posts, rows of wrenches
# and spanners hanging by size, two hammers, a saw, a hazard-yellow shelf with a parts bin in the
# room's colour, a coil of hose and a level. Run: blender -b --factory-startup -P models/tool_wall.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 1.2, 0], [2.0, 1.4, 0.04], "composite", omit=("back",), tex="perforated")
    for x in (-0.98, 0.98):
        m.box([x, 0.95, 0.0], [0.04, 1.9, 0.04], "dark", omit=("bottom",))
    for k in range(6):
        h = 0.24 + 0.04 * k
        x = -0.85 + 0.09 * k
        m.box([x, 1.72 - h / 2, 0.03], [0.03, h, 0.012], "steel", omit=("back",), tex="brushed")
        m.cyl([x, 1.72 - h, 0.03], 0.06 + 0.005 * k, 0.012, "steel", seg=6, r=[90, 0, 0])
    for x in (-0.15, 0.0):
        m.cyl([x, 1.45, 0.04], 0.035, 0.36, "fibre", seg=6, tex="grain")
        m.box([x, 1.65, 0.04], [0.18, 0.05, 0.05], "metal", bevel=0.008, edges="all", tex="brushed")
    m.box([0.35, 1.45, 0.03], [0.16, 0.42, 0.006], "steel", taper=[0.5, 1], omit=("back",), tex="brushed")
    m.soft([0.35, 1.7, 0.04], [0.14, 0.1, 0.035], "red", round=0.6, puff=0.0, cuts=1)
    m.box([0.75, 1.55, 0.04], [0.06, 0.5, 0.04], "hazard", omit=("back",))
    m.box([0.75, 1.55, 0.062], [0.03, 0.06, 0.004], "plant", omit=("back",))
    m.box([0.0, 0.92, 0.09], [1.6, 0.04, 0.16], "hazard", omit=("back",))
    m.box([-0.4, 1.0, 0.09], [0.4, 0.14, 0.14], "accent", omit=("bottom", "back"))
    m.box([0.3, 0.99, 0.09], [0.24, 0.1, 0.14], "dark", omit=("bottom", "back"))
    ring = [(0.6 + 0.12 * math.cos(a / 10 * math.tau), 1.08 + 0.12 * math.sin(a / 10 * math.tau) * 0.6, 0.06 + 0.012 * (a % 2)) for a in range(11)]
    m.sweep(ring, 0.03, "blueprint", seg=4, smooth=1, caps=False)


build("tool_wall", fp)
