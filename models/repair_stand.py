# The repair stand (#365), first person: a dark-legged stand with a steel top, a motor in the room's
# colour clamped in a cradle with its end cap off, a steel gear lying beside it, a tray of parts, a
# wrench and a screwdriver, and a hazard-yellow drip pan below.
# Run: blender -b --factory-startup -P models/repair_stand.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 0.52, 0.375, sz * 0.27], [0.06, 0.75, 0.06], "dark", omit=("bottom",))
    m.box([0, 0.78, 0], [1.2, 0.05, 0.7], "metal", bevel=0.01, edges="upper", tex="brushed")
    m.box([0, 0.2, 0], [1.1, 0.04, 0.6], "hazard", omit=("bottom",))
    m.inset(m.side(m.box([0, 0.23, 0], [1.0, 0.02, 0.5], "hazard", omit=("bottom",)), "top"), 0.03, 0.015, "dark")
    for x in (-0.3, 0.1):
        m.box([x, 0.88, 0], [0.06, 0.16, 0.4], "dark", omit=("bottom",))
    m.lathe([-0.35, 1.05, 0], [(0.0, 0.0), (0.2, 0.0), (0.22, 0.03), (0.22, 0.4), (0.18, 0.44), (0.18, 0.46)], "accent", seg=12, r=[0, 0, -90], tex="grain")
    m.cyl([0.14, 1.05, 0], 0.08, 0.1, "steel", seg=8, r=[0, 0, 90], tex="brushed")
    m.box([-0.1, 1.28, 0], [0.12, 0.06, 0.12], "dark", omit=("bottom",))
    m.lathe([0.4, 0.805, 0.15], [(0.04, 0.0), (0.14, 0.0), (0.14, 0.04), (0.04, 0.04)], "steel", seg=12, tex="brushed")
    m.box([0.4, 0.83, -0.15], [0.3, 0.04, 0.2], "accent", omit=("bottom",))
    for (x, z) in ((0.33, -0.12), (0.42, -0.18), (0.48, -0.1)):
        m.cyl([x, 0.86, z], 0.03, 0.02, "copper", seg=6)
    m.box([-0.4, 0.81, -0.22], [0.22, 0.012, 0.04], "steel", r=[0, 15, 0], tex="brushed")
    m.cyl([-0.1, 0.82, -0.25], 0.025, 0.12, "hazard", seg=6, r=[0, -80, 90])
    m.cyl([0.0, 0.815, -0.24], 0.008, 0.1, "steel", seg=4, r=[0, -80, 90])


build("repair_stand", fp)
