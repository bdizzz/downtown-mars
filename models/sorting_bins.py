# The sorting bins (#365), first person: four bins side by side, in the room's colour, metal, green
# and hazard yellow, each with a dark lid with a slot cut in it, a label with a recycling mark, and
# castors. Run: blender -b --factory-startup -P models/sorting_bins.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for k, (x, c) in enumerate(((-1.05, "accent"), (-0.35, "metal"), (0.35, "plant"), (1.05, "hazard"))):
        b = m.box([x, 0.53, 0], [0.64, 0.94, 0.8], c, taper=[1.0, 1.04], omit=("bottom",), tex="grain")
        m.inset(m.side(b, "front"), 0.05, 0.01)
        lid = m.box([x, 1.02, -0.02], [0.66, 0.05, 0.84], "dark", bevel=0.01, edges="upper", omit=("bottom",))
        m.box([x, 1.046, 0.12], [0.36, 0.006, 0.08], "rubber", omit=("bottom",))
        m.box([x, 0.65, 0.401], [0.32, 0.24, 0.004], "white", omit=("back",))
        for a in (0, 120, 240):
            r = math.radians(a + 90)
            m.box([x + 0.06 * math.cos(r), 0.65 + 0.06 * math.sin(r), 0.405], [0.08, 0.02, 0.004], "plant" if c != "plant" else "dark", r=[0, 0, a], omit=("back",))
        for sx in (-1, 1):
            m.cyl([x + sx * 0.24, 0.04, 0.25], 0.08, 0.04, "rubber", seg=6, r=[0, 0, 90])


build("sorting_bins", fp)
