# The valve panel (#365), first person: a dark cabinet against the wall with a recessed front, a
# glowing status strip under a label, two big hazard-yellow handwheels on stems, two pressure gauges,
# and two pipes leaving the front and turning down into the floor with flanges.
# Run: blender -b --factory-startup -P models/valve_panel.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    cab = m.box([0, 0.9, 0], [1.2, 1.8, 0.3], "dark", omit=("bottom", "back"), tex="brushed")
    m.inset(m.side(cab, "front"), 0.05, 0.015, "panel")
    m.box([0, 1.6, 0.14], [0.85, 0.1, 0.02], "glow", glow=True, omit=("back",))
    m.box([0, 1.48, 0.14], [0.6, 0.06, 0.012], "white", omit=("back",))
    for x in (-0.3, 0.3):
        m.cyl([x, 1.1, 0.2], 0.05, 0.14, "steel", seg=6, r=[90, 0, 0], tex="brushed")
        m.cyl([x, 1.1, 0.14], 0.14, 0.04, "metal", seg=8, r=[90, 0, 0])
        ring = [(x + 0.14 * math.cos(a / 10 * math.tau), 1.1 + 0.14 * math.sin(a / 10 * math.tau), 0.27) for a in range(11)]
        m.sweep(ring, 0.03, "hazard", seg=3, smooth=1, caps=False)
        for a in (0, 60, 120):
            m.box([x, 1.1, 0.27], [0.28, 0.02, 0.02], "hazard", r=[0, 0, a])
        m.cyl([x, 1.1, 0.28], 0.06, 0.04, "dark", seg=6, r=[90, 0, 0])
        m.cyl([x + (0.18 if x < 0 else -0.18), 0.8, 0.15], 0.12, 0.03, "steel", seg=10, r=[90, 0, 0])
        m.box([x + (0.18 if x < 0 else -0.18), 0.8, 0.166], [0.08, 0.08, 0.004], "white", r=[0, 0, 45], omit=("back",))
        m.sweep([(x, 0.5, 0.14), (x, 0.5, 0.25), (x, 0.42, 0.31), (x, 0.0, 0.31)], 0.12, "metal", seg=8, smooth=1, caps=False, tex="brushed")
        m.cyl([x, 0.5, 0.17], 0.18, 0.04, "steel", seg=8, r=[90, 0, 0])
        m.cyl([x, 0.03, 0.31], 0.18, 0.06, "steel", seg=8)


build("valve_panel", fp)
