# The drill press (#365), first person: a slotted dark base, a brushed steel column, a round work
# table with a crank, a head in the room's colour with its motor and belt guard, a chuck and bit over
# a block of work, three feed handles with knobs, a switch box and a little lamp.
# Run: blender -b --factory-startup -P models/drill_press.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    base = m.box([0, 0.05, 0], [0.7, 0.1, 0.7], "dark", omit=("bottom",), tex="tread")
    m.inset(m.split(m.side(base, "top")[0], 3, "right"), 0.04, 0.02)
    m.cyl([0, 0.95, -0.2], 0.1, 1.8, "steel", seg=10, caps=False, tex="brushed")
    m.lathe([0, 0.75, 0.05], [(0.05, 0.0), (0.24, 0.0), (0.24, 0.05), (0.0, 0.05)], "metal", seg=12, tex="brushed")
    m.box([0, 0.72, -0.12], [0.12, 0.1, 0.18], "metal")
    m.cyl([0.12, 0.72, -0.15], 0.03, 0.14, "dark", seg=5, r=[0, 0, 90])
    m.box([0, 0.82, 0.08], [0.16, 0.08, 0.1], "composite", tex="grain")
    head = m.box([0, 1.6, 0.05], [0.4, 0.38, 0.55], "accent", bevel=0.04, seg=2, edges="all")
    m.box([0, 1.8, 0.02], [0.36, 0.08, 0.5], "accent", bevel=0.03, edges="upper", omit=("bottom",))
    m.lathe([0, 1.62, -0.33], [(0.0, 0.0), (0.12, 0.02), (0.13, 0.2), (0.0, 0.2)], "dark", seg=10, r=[90, 0, 0])
    m.lathe([0, 1.32, 0.18], [(0.02, 0.0), (0.05, 0.04), (0.05, 0.12), (0.03, 0.14)], "steel", seg=8, r=[180, 0, 0], tex="brushed")
    m.cyl([0, 1.15, 0.18], 0.012, 0.09, "steel", seg=4, caps=False)
    for a in (0, 120, 240):
        r = math.radians(a)
        m.cyl([0.22 + 0.12 * math.cos(r) * 0.0, 1.5 + 0.1 * math.sin(r), 0.1 + 0.1 * math.cos(r)], 0.02, 0.24, "steel", seg=4, caps=False, r=[a, 0, 0])
        m.lathe([0.22, 1.5 + 0.22 * math.sin(r), 0.1 + 0.22 * math.cos(r)], [(0.0, -0.03), (0.03, -0.02), (0.03, 0.02), (0.0, 0.03)], "rubber", seg=6, r=[a, 0, 0])
    m.box([-0.19, 1.55, 0.3], [0.1, 0.12, 0.03], "dark")
    m.cyl([-0.19, 1.57, 0.32], 0.035, 0.02, "red", seg=6, r=[90, 0, 0])
    m.sweep([(-0.18, 1.72, 0.2), (-0.26, 1.6, 0.28), (-0.22, 1.42, 0.3)], 0.02, "dark", seg=4, smooth=2, caps=False)
    m.lathe([-0.22, 1.33, 0.3], [(0.0, 0.0), (0.04, 0.02), (0.05, 0.08), (0.0, 0.09)], "lamp", seg=6, glow=True)


build("drill_press", fp)
