# The mixer (#365), first person: a dark frame on four feet, a turned drum in the room's colour tilted
# on its trunnion with dark bands, ribs and a dark mouth, a gearbox and motor, a tilting handwheel and
# a steel chute below the mouth. Run: blender -b --factory-startup -P models/mixer_drum.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 0.95, 0.3, sz * 0.6], [0.1, 0.6, 0.1], "dark", omit=("bottom",))
    m.box([0, 0.55, 0], [2.0, 0.1, 1.3], "dark", omit=("bottom",), tex="tread")
    for z in (-0.55, 0.55):
        m.box([0, 0.9, z], [0.14, 0.7, 0.1], "dark", omit=("bottom",))
    m.lathe([-0.55, 0.85, 0], [(0.0, 0.0), (0.35, 0.0), (0.62, 0.35), (0.62, 1.15), (0.66, 1.18), (0.62, 1.2), (0.62, 1.3), (0.42, 1.7), (0.4, 1.72), (0.3, 1.72)], "accent", seg=12, r=[0, 0, -70], tex="grain")
    m.lathe([-0.55 + 1.62 * math.sin(math.radians(70)), 0.85 + 1.62 * math.cos(math.radians(70)), 0], [(0.3, 0.0), (0.0, -0.1)], "dark", seg=12, r=[0, 0, -70])
    for t in (0.5, 0.8):
        m.lathe([-0.55 + t * math.sin(math.radians(70)), 0.85 + t * math.cos(math.radians(70)), 0], [(0.635, 0.0), (0.635, 0.06)], "dark", seg=12, caps=False, r=[0, 0, -70])
    m.cyl([-0.1, 1.0, 0], 0.18, 1.2, "steel", seg=8, r=[90, 0, 0], tex="brushed")
    m.box([-0.7, 0.8, 0.45], [0.36, 0.3, 0.3], "dark", bevel=0.02, edges="upper", omit=("bottom",))
    m.lathe([-0.7, 0.8, 0.6], [(0.0, 0.0), (0.12, 0.0), (0.12, 0.08)], "metal", seg=8, r=[90, 0, 0])
    ring = [(-0.1 + 0.16 * math.cos(a / 10 * math.tau), 1.0 + 0.16 * math.sin(a / 10 * math.tau), 0.68) for a in range(11)]
    m.sweep(ring, 0.025, "hazard", seg=3, smooth=1, caps=False)
    m.box([0.75, 0.7, 0], [0.5, 0.04, 0.4], "metal", r=[0, 0, -18], tex="brushed")
    for z in (-0.2, 0.2):
        m.box([0.75, 0.75, z], [0.5, 0.1, 0.02], "metal", r=[0, 0, -18])


build("mixer_drum", fp)
