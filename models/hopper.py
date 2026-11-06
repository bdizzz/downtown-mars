# The hopper (#365), first person: four steel legs with cross braces, a bin in the room's colour
# narrowing into a funnel, a dark rim round its mouth, a gate at the outlet with a lever, a ladder up
# one leg and a hazard label. Run: blender -b --factory-startup -P models/hopper.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 0.79, 0.65, sz * 0.79], [0.1, 1.3, 0.1], "metal", omit=("bottom",), tex="brushed")
            m.box([sx * 0.79, 0.02, sz * 0.79], [0.18, 0.04, 0.18], "dark", omit=("bottom",))
    for (a, b) in (((-0.79, -0.79), (0.79, -0.79)), ((-0.79, -0.79), (-0.79, 0.79)), ((0.79, -0.79), (0.79, 0.79))):
        m.sweep([(a[0], 0.15, a[1]), (b[0], 1.15, b[1])], 0.035, "metal", seg=4, smooth=1)
        m.sweep([(b[0], 0.15, b[1]), (a[0], 1.15, a[1])], 0.035, "metal", seg=4, smooth=1)
    bin = m.box([0, 2.25, 0], [1.8, 0.9, 1.8], "accent", omit=("bottom", "top"), tex="grain")
    m.cyl([0, 1.4, 0], 2.54, 0.8, "accent", seg=4, d2=0.5, r=[180, 45, 0], caps=False, tex="grain")
    m.box([0, 2.72, 0], [1.9, 0.06, 1.9], "dark", omit=())
    m.box([0, 2.69, 0], [1.66, 0.01, 1.66], "stone", omit=("bottom",))
    m.box([0, 0.92, 0], [0.4, 0.18, 0.4], "metal", omit=("top",), tex="brushed")
    m.box([0, 0.86, 0.24], [0.42, 0.08, 0.08], "dark")
    m.sweep([(0.2, 0.86, 0.28), (0.42, 0.9, 0.36), (0.6, 1.05, 0.4)], 0.03, "hazard", seg=4, smooth=2)
    m.box([0, 2.3, 0.905], [1.0, 0.24, 0.01], "hazard", omit=("back",))
    m.box([0, 2.3, 0.912], [0.14, 0.14, 0.005], "dark", r=[0, 0, 45], omit=("back",))
    for z in (0.64, 0.94):
        m.box([-0.92, 1.35, z], [0.04, 2.7, 0.04], "metal", omit=("bottom",))
    for y in (0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4):
        m.cyl([-0.92, y, 0.79], 0.03, 0.3, "metal", seg=4, caps=False, r=[90, 0, 0])


build("hopper", fp)
