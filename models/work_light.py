# The work light (#365), first person: a wall plate, a short arm with a knuckle joint, and a caged
# lamp: a hazard-yellow housing on top, a glowing bulb inside a ring-and-bar guard.
# Run: blender -b --factory-startup -P models/work_light.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.13, 0.008], [0.12, 0.2, 0.016], "dark", bevel=0.01, edges="vertical", omit=("back",))
    for y in (0.06, 0.2):
        m.cyl([0, y, 0.018], 0.016, 0.006, "steel", seg=6, r=[90, 0, 0])
    m.sweep([(0, 0.15, 0.02), (0, 0.16, 0.06), (0, 0.19, 0.09), (0, 0.22, 0.12)], 0.03, "dark", seg=5, smooth=2)
    m.cyl([0, 0.22, 0.13], 0.05, 0.04, "metal", seg=8, r=[0, 0, 90], tex="brushed")
    m.lathe([0, 0.12, 0.17], [(0.06, 0.06), (0.095, 0.06), (0.095, 0.075), (0.06, 0.1), (0.0, 0.11)], "hazard", seg=12)
    m.lathe([0, 0.12, 0.17], [(0.0, -0.075), (0.035, -0.06), (0.045, -0.02), (0.04, 0.03), (0.02, 0.06)], "lamp", seg=8, glow=True)
    for y in (-0.075, 0.0):
        ring = [(0.088 * math.cos(a / 12 * math.tau), 0.12 + y, 0.17 + 0.088 * math.sin(a / 12 * math.tau)) for a in range(13)]
        m.sweep(ring, 0.01, "dark", seg=3, smooth=1, caps=False)
    for a in range(0, 360, 60):
        r = math.radians(a)
        m.sweep([(0.088 * math.cos(r), 0.18, 0.17 + 0.088 * math.sin(r)), (0.07 * math.cos(r), 0.03, 0.17 + 0.07 * math.sin(r)), (0.0, 0.012, 0.17)], 0.01, "dark", seg=3, smooth=1, caps=False)


build("work_light", fp)
