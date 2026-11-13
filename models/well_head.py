# The wellhead (#365), first person: a dark concrete pad, a hazard-yellow grating plate, the casing in
# the room's colour, a turned wellhead with bolted flanges, a discharge pipe going off sideways with
# its valve and handwheel, a pressure gauge on top, and a guard rail round the pad.
# Run: blender -b --factory-startup -P models/well_head.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.lathe([0, 0.0, 0], [(0.9, 0.0), (0.9, 0.28), (0.85, 0.3)], "dark", seg=12, tex="tread")
    plate = m.box([0, 0.32, 0], [1.7, 0.04, 1.7], "hazard", omit=("bottom",))
    m.inset(m.side(plate, "top"), 0.08, 0.01, "dark")
    m.lathe([0, 0.3, 0], [(0.4, 0.0), (0.4, 0.95)], "accent", seg=12, caps=False)
    m.lathe([0, 1.25, 0], [(0.5, 0.0), (0.5, 0.06), (0.45, 0.08), (0.45, 0.5), (0.5, 0.52), (0.5, 0.58), (0.2, 0.62), (0.15, 0.95), (0.18, 0.98), (0.18, 1.05), (0.0, 1.06)], "metal", seg=12, tex="brushed")
    for y in (1.28, 1.8):
        for a in range(0, 360, 60):
            r = math.radians(a + 30)
            m.cyl([0.47 * math.cos(r), y, 0.47 * math.sin(r)], 0.035, 0.07, "steel", seg=4, caps=False)
    m.sweep([(0.4, 1.0, 0), (0.85, 1.0, 0), (0.98, 0.85, 0), (1.0, 0.33, 0)], 0.22, "metal", seg=8, smooth=1, caps=False, tex="brushed")
    m.cyl([0.7, 1.0, 0], 0.32, 0.05, "steel", seg=8, r=[0, 0, 90])
    m.cyl([0.7, 1.2, 0], 0.04, 0.3, "steel", seg=5)
    m.cyl([0.7, 1.38, 0], 0.28, 0.03, "hazard", seg=10)
    m.cyl([0.0, 2.35, 0.0], 0.03, 0.12, "steel", seg=5)
    m.cyl([0.0, 2.45, 0.03], 0.14, 0.04, "white", seg=8, r=[90, 0, 0])
    for (x, z) in ((-0.95, -0.95), (-0.95, 0.95), (0.95, -0.95), (0.95, 0.95)):
        m.cyl([x * 1.15, 0.55, z * 0.95], 0.05, 1.1, "hazard", seg=5)
    for y in (0.6, 1.05):
        m.sweep([(-1.09, y, -0.9), (-1.09, y, 0.9), (1.09, y, 0.9), (1.09, y, -0.9)], 0.04, "hazard", seg=4, smooth=1, caps=False)


build("well_head", fp)
