# The air handler (#365), first person: a dark plinth, a turned steel ring housing a three-bladed fan
# in the room's colour, swept and pitched, a turned hub, a guard of rings and bars over the front, and
# the motor's can behind. Run: blender -b --factory-startup -P models/big_fan.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.15, 0], [1.4, 0.3, 0.66], "dark", bevel=0.02, edges="upper", omit=("bottom",), tex="tread")
    for x in (-0.45, 0.45):
        m.box([x, 0.45, 0], [0.12, 0.35, 0.3], "dark", taper=[0.6, 1], omit=("bottom",))
    m.lathe([0, 1.1, -0.3], [(0.72, 0.0), (0.8, 0.02), (0.8, 0.58), (0.72, 0.6), (0.7, 0.6), (0.7, 0.0)], "metal", seg=16, caps=False, r=[90, 0, 0], tex="brushed")
    for a in (0, 120, 240):
        r = math.radians(a)
        m.blade([0.05 * math.cos(r), 1.1 + 0.05 * math.sin(r), 0.1], 0, a, 0.62, 0.36, "accent", roll=60, seg=2, thick=0.02)
    m.lathe([0, 1.1, 0.0], [(0.12, 0.0), (0.12, 0.1), (0.08, 0.16), (0.0, 0.18)], "steel", seg=10, r=[90, 0, 0], tex="brushed")
    m.lathe([0, 1.1, -0.35], [(0.0, 0.0), (0.25, 0.0), (0.25, 0.3)], "dark", seg=10, r=[90, 0, 0])
    for rad in (0.3, 0.55, 0.76):
        ring = [(rad * math.cos(a / 16 * math.tau), 1.1 + rad * math.sin(a / 16 * math.tau), 0.32) for a in range(17)]
        m.sweep(ring, 0.018, "steel", seg=3, smooth=1, caps=False)
    for a in (0, 90):
        m.box([0, 1.1, 0.32], [1.56, 0.02, 0.02], "steel", r=[0, 0, a])


build("big_fan", fp)
