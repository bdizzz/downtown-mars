# The gas tank (#365), first person: a turned white sphere on four tapered legs with cross braces, an
# equator band in the room's colour, a ladder curving up its side to a hazard-capped valve on top, and
# a bolted manway. Run: blender -b --factory-startup -P models/gas_sphere.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 0.92, 0.75, sz * 0.92], [0.14, 1.5, 0.14], "metal", taper=[0.7, 0.7], omit=("bottom",), tex="brushed")
            m.box([sx * 0.92, 0.03, sz * 0.92], [0.24, 0.06, 0.24], "dark", omit=("bottom",))
    for (x0, z0, x1, z1) in ((-0.92, 0.92, 0.92, 0.92), (-0.92, -0.92, -0.92, 0.92), (0.92, -0.92, 0.92, 0.92)):
        m.sweep([(x0, 0.2, z0), (x1, 1.1, z1)], 0.04, "metal", seg=4, smooth=1)
        m.sweep([(x1, 0.2, z1), (x0, 1.1, z0)], 0.04, "metal", seg=4, smooth=1)
    prof = [(math.sin(math.radians(a)) * 1.3, 0.7 + 1.3 - math.cos(math.radians(a)) * 1.3) for a in range(0, 181, 20)]
    prof[0] = (0.0, prof[0][1])
    prof[-1] = (0.0, prof[-1][1])
    m.lathe([0, 0, 0], prof, "white", seg=16)
    m.lathe([0, 1.95, 0], [(1.315, 0.0), (1.315, 0.12)], "accent", seg=16, caps=False)
    # The ladder up the front, curving with the sphere.
    for x in (-0.2, 0.2):
        pts = [(x, 0.0, 1.32)] + [(x, 0.7 + 1.3 - math.cos(math.radians(a)) * 1.38, math.sin(math.radians(a)) * 1.38 * 0.96) for a in (60, 90, 120, 150, 170)]
        m.sweep(pts, 0.04, "metal", seg=4, smooth=2, caps=False, tex="brushed")
    for y in (0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4, 2.7):
        a = math.acos(max(-1, min(1, (2.0 - y) / 1.38))) if y > 0.62 else math.pi / 2.2
        z = min(1.32, math.sin(a) * 1.38 * 0.96)
        m.cyl([0, y, z], 0.025, 0.4, "metal", seg=4, caps=False, r=[0, 0, 90])
    m.cyl([0, 3.32, 0], 0.26, 0.1, "metal", seg=8, tex="brushed")
    m.cyl([0, 3.4, 0], 0.16, 0.08, "hazard", seg=8)
    m.cyl([-0.8, 1.5, 0.75], 0.42, 0.06, "metal", seg=10, r=[90, -45, 0])
    m.cyl([-0.82, 1.5, 0.77], 0.28, 0.04, "dark", seg=10, r=[90, -45, 0])


build("gas_sphere", fp)
