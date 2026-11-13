# The stock kettle (#366), first person: a big steel kettle turned on trunnions between two pillars,
# its rolled rim and a lid propped ajar with a knob, a tilt handwheel and gearbox on one pillar, a
# draw-off tap at the front over a drip grate, and a stripe in the room colour round the pillars.
# Run: blender -b --factory-startup -P models/stock_kettle.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for sx in (-1, 1):
        m.box([sx * 0.52, 0.45, 0], [0.1, 0.9, 0.46], "metal", bevel=0.02, seg=1, edges="vertical", omit=("bottom",), tex="brushed")
        m.box([sx * 0.52, 0.04, 0], [0.14, 0.08, 0.52], "dark", omit=("bottom",))
        m.box([sx * 0.52, 0.7, 0.232], [0.08, 0.04, 0.006], "accent", omit=("back",))
        m.cyl([sx * 0.44, 0.75, 0], 0.1, 0.1, "dark", seg=10, r=[0, 0, 90])
    # The kettle and its lid.
    m.lathe([0, 0.36, 0], [(0.0, 0.0), (0.25, 0.03), (0.37, 0.15), (0.4, 0.3), (0.4, 0.68), (0.425, 0.7), (0.425, 0.72), (0.39, 0.72), (0.38, 0.7)], "steel", seg=14, caps=False, tex="brushed")
    m.lathe([0, 1.06, 0], [(0.38, 0.0), (0.38, 0.015), (0.3, 0.035), (0.0, 0.045)], "steel", seg=14, r=[-5, 0, 0], tex="brushed")
    m.lathe([0, 1.1, 0.01], [(0.02, 0.0), (0.02, 0.006), (0.035, 0.02), (0.0, 0.03)], "dark", seg=8)
    # The tilt handwheel and gearbox.
    m.box([0.61, 0.75, 0], [0.08, 0.2, 0.2], "dark")
    m.sweep([(0.66, 0.75 + 0.14 * math.cos(math.radians(a)), 0.14 * math.sin(math.radians(a))) for a in range(0, 361, 30)], 0.022, "steel", seg=5, smooth=1, caps=False, tex="brushed")
    for a in (0, 120, 240):
        m.box([0.66, 0.75 + 0.07 * math.cos(math.radians(a)), 0.07 * math.sin(math.radians(a))], [0.015, 0.14, 0.015], "steel", r=[-a, 0, 0])
    m.cyl([0.66, 0.75, 0], 0.04, 0.03, "dark", seg=8, r=[0, 0, 90])
    # The draw-off tap over a drip grate.
    m.sweep([(0, 0.55, 0.36), (0, 0.55, 0.42), (0, 0.5, 0.44)], 0.045, "steel", seg=6, smooth=2, tex="brushed")
    m.box([0, 0.57, 0.41], [0.12, 0.02, 0.02], "red", omit=("bottom",))
    m.box([0, 0.03, 0.32], [0.5, 0.04, 0.24], "metal", omit=("bottom",), tex="perforated")


build("stock_kettle", fp)
