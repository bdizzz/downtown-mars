# The filter column (#365), first person: a tall turned column of blue-tinted water on a steel base, a
# domed steel head, three bands in the room's colour, four tie rods, an inlet at the head and an
# outlet at the foot running down into the floor in the corners, a pressure gauge on top and a glowing
# readout. Run: blender -b --factory-startup -P models/filter_column.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.lathe([0, 0.0, 0], [(0.55, 0.0), (0.55, 0.2), (0.5, 0.22)], "metal", seg=14, caps=False, tex="brushed")
    m.lathe([0, 0.2, 0], [(0.5, 0.0), (0.5, 2.5)], "water", seg=14, caps=False)
    m.lathe([0, 2.7, 0], [(0.55, 0.0), (0.55, 0.12), (0.45, 0.22), (0.25, 0.28), (0.0, 0.3)], "steel", seg=14, tex="brushed")
    for y in (0.85, 1.55, 2.25):
        m.lathe([0, y, 0], [(0.52, 0.0), (0.52, 0.08)], "accent", seg=14, caps=False)
    for a in (45, 135, 225, 315):
        r = math.radians(a)
        m.cyl([0.53 * math.cos(r), 1.45, 0.53 * math.sin(r)], 0.03, 2.5, "steel", seg=4, caps=False)
    # The inlet from the head, the outlet at the foot, both down into the floor in the corners.
    m.sweep([(0.25, 2.9, 0.0), (0.25, 2.95, 0.0), (0.4, 2.95, 0.0), (0.42, 2.85, 0.32), (0.42, 2.4, 0.38), (0.42, 0.0, 0.38)], 0.1, "metal", seg=8, smooth=2, caps=False, tex="brushed")
    m.sweep([(-0.5, 0.35, -0.0), (-0.42, 0.35, -0.3), (-0.4, 0.2, -0.4), (-0.4, 0.0, -0.4)], 0.1, "metal", seg=8, smooth=2, caps=False, tex="brushed")
    m.cyl([-0.52, 0.35, 0.0], 0.18, 0.05, "steel", seg=8, r=[0, 0, 90])
    m.cyl([0.36, 2.86, 0.36], 0.12, 0.03, "white", seg=8, r=[90, 45, 0])
    m.cyl([0.355, 2.86, 0.355], 0.14, 0.02, "steel", seg=8, r=[90, 45, 0])
    m.box([0, 1.2, 0.505], [0.25, 0.36, 0.02], "dark", omit=("back",))
    m.box([0, 1.22, 0.517], [0.2, 0.26, 0.004], "glow", glow=True, omit=("back",))


build("filter_column", fp)
