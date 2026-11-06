# The storage tank (#365), first person: a turned steel tank with a domed top and weld seams, a band
# in the room's colour, a dark base ring, a caged ladder up the front curving over the shoulder, a
# bolted manway, a sight tube showing the water level, an outlet with a valve and handwheel, and a
# vent on top. Run: blender -b --factory-startup -P models/big_tank.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.lathe([0, 0.0, 0], [(1.5, 0.0), (1.5, 0.16), (1.4, 0.16), (1.4, 2.95), (1.3, 3.12), (1.0, 3.25), (0.5, 3.3), (0.0, 3.31)], "steel", seg=16, tex="brushed")
    m.lathe([0, 1.75, 0], [(1.42, 0.0), (1.42, 0.3)], "accent", seg=16, caps=False)
    for y in (0.9, 2.5):
        m.lathe([0, y, 0], [(1.41, 0.0), (1.41, 0.025)], "metal", seg=16, caps=False)
    m.lathe([0, 0.0, 0], [(1.5, 0.0), (1.5, 0.16)], "dark", seg=16, caps=False)
    # The ladder up the front, its rails curving over the shoulder.
    for x in (-0.22, 0.22):
        m.sweep([(x, 0.0, 1.46), (x, 2.9, 1.46), (x, 3.15, 1.38), (x, 3.3, 1.12)], 0.045, "metal", seg=4, smooth=2, tex="brushed")
    for y in (0.35, 0.7, 1.05, 1.4, 1.75, 2.1, 2.45, 2.8):
        m.cyl([0, y, 1.46], 0.03, 0.44, "metal", seg=4, caps=False, r=[0, 0, 90])
    # A bolted manway, a sight tube, an outlet with its valve, a vent.
    m.cyl([-1.0, 0.75, 1.0], 0.62, 0.08, "metal", seg=12, r=[90, 45, 0], tex="brushed")
    m.cyl([-1.02, 0.75, 1.02], 0.44, 0.06, "dark", seg=12, r=[90, 45, 0])
    m.cyl([1.25, 1.6, 0.68], 0.06, 2.4, "water", seg=6)
    for y in (0.38, 2.82):
        m.box([1.22, y, 0.66], [0.12, 0.06, 0.12], "metal")
    m.box([1.25, 1.2, 0.68], [0.04, 0.02, 0.08], "red")
    m.cyl([0.75, 0.32, 1.32], 0.2, 0.36, "metal", seg=8, r=[90, -30, 0], tex="brushed")
    m.cyl([0.83, 0.32, 1.46], 0.26, 0.04, "steel", seg=8, r=[90, -30, 0])
    m.cyl([0.75, 0.48, 1.28], 0.04, 0.12, "steel", seg=5)
    m.cyl([0.75, 0.55, 1.28], 0.2, 0.025, "hazard", seg=8)
    m.lathe([0.6, 3.2, -0.6], [(0.08, 0.0), (0.08, 0.14), (0.16, 0.16), (0.12, 0.2), (0.0, 0.22)], "dark", seg=8)


build("big_tank", fp)
