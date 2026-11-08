# The shower (#367), first person: a white tray with a drain, two panel walls, a frosted screen on a
# steel frame, and across the front a curtain in folds on rings, drawn back to one side. Inside: a
# round rain head on an arm, a hand shower on a riser rail, a mixer and a corner shelf of bottles.
# Run: blender -b --factory-startup -P models/shower_stall.py
import math
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    tray = m.box([0, 0.05, 0], [1.1, 0.1, 1.1], "white", omit=("bottom",))
    m.inset(m.side(tray, "top"), 0.05, 0.03)
    m.cyl([0, 0.072, 0], 0.1, 0.004, "steel", seg=10, tex="perforated")
    # The walls, back and left, with a ledge, and the screen on the right.
    m.box([-0.535, 1.15, 0], [0.03, 2.1, 1.1], "panel", omit=("left",))
    m.box([0, 1.15, -0.535], [1.04, 2.1, 0.03], "panel", omit=("back",))
    m.box([0.535, 1.1, 0], [0.02, 1.96, 1.06], "mirror")
    for z in (-0.53, 0.53):
        m.box([0.535, 1.1, z], [0.035, 2.0, 0.035], "steel", tex="brushed")
    m.box([0.535, 2.09, 0], [0.035, 0.03, 1.1], "steel", tex="brushed")
    # The curtain rail across the front, rings and the curtain gathered on the right.
    m.cyl([0, 2.15, 0.5], 0.025, 1.06, "steel", seg=6, r=[0, 0, 90], tex="brushed")
    xs = [0.12 + 0.04 * k for k in range(10)]
    m.strip([(x, 0.5 + 0.03 * math.sin(k * 1.6)) for k, x in enumerate(xs)], 0.3, 2.12, 0.012, "accent", tex="fabric")
    for x in xs[::3]:
        m.cyl([x, 2.15, 0.5], 0.04, 0.008, "steel", seg=4, r=[0, 0, 90])
    # The rain head, its arm and the hand shower on its rail.
    m.sweep([(0, 1.95, -0.52), (0, 2.03, -0.48), (0, 2.04, -0.3)], 0.025, "steel", seg=6, smooth=2, tex="brushed")
    m.lathe([0, 1.99, -0.28], [(0.0, 0.0), (0.12, 0.0), (0.13, 0.02), (0.03, 0.05), (0.0, 0.05)], "steel", seg=12, tex="brushed")
    m.cyl([0, 1.99, -0.28], 0.2, 0.004, "steel", seg=12, tex="perforated")
    m.cyl([0.3, 1.25, -0.505], 0.025, 0.9, "steel", seg=6, tex="brushed")
    for y in (0.8, 1.7):
        m.box([0.3, y, -0.51], [0.04, 0.04, 0.04], "steel")
    m.box([0.3, 1.45, -0.49], [0.05, 0.06, 0.04], "dark")
    m.lathe([0.3, 1.36, -0.46], [(0.0, 0.0), (0.016, 0.0), (0.02, 0.1), (0.035, 0.14), (0.035, 0.155), (0.0, 0.155)], "steel", seg=6, r=[18, 0, 0])
    m.sweep([(0.3, 1.36, -0.47), (0.33, 1.0, -0.42), (0.31, 0.8, -0.44), (0.28, 0.7, -0.5)], 0.016, "steel", seg=4, smooth=2, caps=False)
    # The mixer.
    m.cyl([-0.15, 1.1, -0.51], 0.12, 0.02, "steel", seg=10, r=[90, 0, 0])
    m.box([-0.15, 1.1, -0.48], [0.11, 0.025, 0.03], "steel", r=[0, 0, 20])
    # The corner shelf and bottles.
    m.box([-0.44, 1.3, -0.44], [0.16, 0.02, 0.16], "steel", tex="perforated")
    for x, z, h, c in ((-0.47, -0.47, 0.18, "water"), (-0.41, -0.45, 0.14, "accent"), (-0.46, -0.4, 0.1, "cream")):
        m.lathe([x, 1.31, z], [(0.0, 0.0), (0.025, 0.0), (0.025, h * 0.85), (0.012, h), (0.0, h)], c, seg=6)


build("shower_stall", fp)
