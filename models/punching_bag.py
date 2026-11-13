# The punching bag (#366), first person: a steel stand on a base weighted with plates, an arm out over
# a swivel and chains, and a leather bag in rust with a domed top, stitched seams and a band in the
# room colour.
# Run: blender -b --factory-startup -P models/punching_bag.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.03, -0.2], [0.6, 0.06, 0.6], "dark", bevel=0.02, seg=1, edges="upper", omit=("bottom",), tex="tread")
    m.lathe([0, 0.06, -0.35], [(0.2, 0.0), (0.2, 0.05), (0.05, 0.05), (0.05, 0.1), (0.2, 0.1), (0.2, 0.15), (0.04, 0.15)], "rubber", seg=12, caps=False)
    m.box([0, 1.1, -0.35], [0.08, 2.1, 0.08], "metal", omit=("bottom",), tex="brushed")
    m.box([0, 2.14, -0.08], [0.06, 0.06, 0.6], "metal", tex="brushed")
    m.sweep([(0, 1.8, -0.31), (0, 2.1, -0.15)], 0.04, "metal", seg=6, smooth=1, tex="brushed")
    # The swivel and chains.
    m.cyl([0, 2.07, 0.15], 0.05, 0.08, "steel", seg=8, tex="brushed")
    for k in range(4):
        a = math.radians(45 + 90 * k)
        m.sweep([(0, 2.03, 0.15), (0.12 * math.cos(a), 1.86, 0.15 + 0.12 * math.sin(a))], 0.01, "steel", seg=4, smooth=1)
    # The bag.
    m.lathe([0, 0.85, 0.15], [(0.0, 0.0), (0.17, 0.02), (0.2, 0.08), (0.2, 0.92), (0.19, 0.98), (0.12, 1.01), (0.0, 1.02)], "rust", seg=14, tex="grain")
    for y in (1.1, 1.6):
        m.lathe([0, y, 0.15], [(0.203, 0.0), (0.203, 0.012)], "dark", seg=14, caps=False)
    m.lathe([0, 1.3, 0.15], [(0.204, 0.0), (0.204, 0.16)], "accent", seg=14, caps=False)


build("punching_bag", fp)
