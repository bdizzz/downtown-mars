# The CO2 scrubber (#365), first person: a tall cabinet in the room's colour with panel seams and a
# dark top cap, two bolted round access hatches in a dark lower bay, a glowing status strip, an intake
# grille in its side, a duct along the side and an exhaust stack with a rain cap.
# Run: blender -b --factory-startup -P models/scrubber_unit.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    cab = m.box([0, 1.3, 0], [2.4, 2.6, 1.3], "accent", omit=("bottom",), tex="grain")
    m.inset(m.split(m.side(cab, "front")[0], 3, "right"), 0.03, 0.01)
    m.inset(m.split(m.side(cab, "right")[0], 6, "top"), 0.04, 0.03, "dark")
    m.box([0, 2.64, 0], [2.44, 0.08, 1.34], "dark", bevel=0.02, edges="upper", omit=("bottom",))
    m.box([0, 0.05, 0], [2.44, 0.1, 1.34], "dark", omit=("bottom",))
    # The lower bay and its two hatches.
    m.box([0, 1.0, 0.655], [2.0, 1.3, 0.01], "dark", omit=("back",))
    for x in (-0.5, 0.5):
        m.lathe([x, 1.0, 0.66], [(0.3, 0.0), (0.3, 0.03), (0.26, 0.05), (0.1, 0.06), (0.0, 0.06)], "metal", seg=12, r=[90, 0, 0], tex="brushed")
        m.box([x, 1.0, 0.725], [0.38, 0.04, 0.03], "dark", bevel=0.01, edges="all")
        for a in range(0, 360, 60):
            r = math.radians(a)
            m.cyl([x + 0.27 * math.cos(r), 1.0 + 0.27 * math.sin(r), 0.69], 0.03, 0.02, "steel", seg=5, r=[90, 0, 0])
    m.box([0, 2.3, 0.655], [1.2, 0.18, 0.012], "glow", glow=True, omit=("back",))
    for k in range(4):
        m.box([-0.45 + 0.3 * k, 2.06, 0.658], [0.2, 0.06, 0.01], "white", omit=("back",))
    # A duct up the side and the exhaust stack.
    m.box([-1.1, 1.3, -0.3], [0.2, 2.4, 0.4], "metal", omit=("bottom",), tex="brushed")
    m.cyl([0.8, 3.0, -0.3], 0.35, 0.8, "metal", seg=10, caps=False, tex="brushed")
    m.lathe([0.8, 3.32, -0.3], [(0.05, 0.0), (0.3, 0.02), (0.24, 0.07), (0.0, 0.08)], "dark", seg=10)


build("scrubber_unit", fp)
