# The map of Mars (#365), first person: a dark frame round the red planet's face in relief, the
# composite highlands raised, a canyon cut across in dark soil, a crater ringed in stone, three
# glowing pins with tags for the colony's holes, and a compass rose.
# Run: blender -b --factory-startup -P models/mars_map.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    frame = m.box([0, 0.55, 0], [2.0, 1.1, 0.04], "dark", omit=("back",), tex="grain")
    m.inset(m.side(frame, "front"), 0.05, 0.012, "rust")
    # The highlands: overlapping raised discs, so their outline wanders.
    for (x, y, rad) in ((-0.55, 0.8, 0.16), (-0.35, 0.84, 0.2), (-0.15, 0.78, 0.13), (-0.42, 0.68, 0.1), (0.55, 0.32, 0.14), (0.7, 0.36, 0.1)):
        m.lathe([x, y, 0.008], [(rad, 0.0), (rad * 0.92, 0.008), (0.0, 0.012)], "composite", seg=7, r=[90, 0, 0])
    m.strip([(-0.3, 0.012), (0.0, 0.016), (0.3, 0.012), (0.6, 0.014)], 0.42, 0.47, 0.006, "soil")
    m.box([0.3, 0.45, 0.014], [0.9, 0.04, 0.006], "soil", r=[0, 0, -8], omit=("back",))
    m.lathe([0.55, 0.8, 0.008], [(0.15, 0.0), (0.12, 0.012), (0.08, 0.006), (0.0, 0.004)], "stone", seg=10, r=[90, 0, 0])
    for (x, y) in ((-0.6, 0.3), (-0.1, 0.55), (0.7, 0.25)):
        m.cyl([x, y, 0.03], 0.012, 0.04, "steel", seg=4, r=[90, 0, 0])
        m.lathe([x, y, 0.05], [(0.0, 0.0), (0.03, 0.01), (0.02, 0.03), (0.0, 0.035)], "glow", seg=6, r=[90, 0, 0], glow=True)
        m.box([x + 0.08, y + 0.04, 0.012], [0.1, 0.04, 0.004], "cream", omit=("back",))
    for a in (0, 90):
        m.box([-0.8, 0.85, 0.012], [0.02, 0.16, 0.004], "white", r=[0, 0, a], omit=("back",))
    m.box([-0.8, 0.85, 0.014], [0.04, 0.04, 0.004], "white", r=[0, 0, 45], omit=("back",))


build("mars_map", fp)
