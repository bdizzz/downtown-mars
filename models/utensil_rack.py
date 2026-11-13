# The utensil rack (#366), first person: a steel rail on two brackets with S-hooks, a copper pot and
# a copper pan hanging face out, a ladle, a slotted spoon, a whisk and a perforated strainer.
# Run: blender -b --factory-startup -P models/utensil_rack.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.cyl([0, 0.72, 0.04], 0.026, 1.08, "steel", seg=8, r=[0, 0, 90], tex="brushed")
    for x in (-0.5, 0.5):
        m.box([x, 0.72, 0.02], [0.03, 0.05, 0.04], "dark", omit=("back",))
    for x in (-0.35, -0.05, 0.18, 0.32, 0.45, -0.22):
        m.sweep([(x, 0.745, 0.04), (x, 0.73, 0.06), (x, 0.7, 0.06), (x, 0.67, 0.04)], 0.006, "dark", seg=3, smooth=1, caps=False)
    # A copper pot and a pan, hung face out by their handles.
    for x, y, d in ((-0.35, 0.33, 0.3), (-0.05, 0.38, 0.24)):
        m.lathe([x, y, 0.06], [(0.0, -0.03), (d / 2 - 0.01, -0.03), (d / 2, -0.02), (d / 2, 0.02), (d / 2 - 0.008, 0.02), (d / 2 - 0.008, -0.015), (0.0, -0.022)], "copper", seg=10, r=[90, 0, 0], caps=False)
        m.box([x, y + d / 2 + 0.1, 0.05], [0.03, 0.22, 0.012], "dark")
    # A ladle, a slotted spoon, a whisk, a strainer.
    m.cyl([0.18, 0.5, 0.06], 0.014, 0.34, "steel", seg=5, tex="brushed")
    m.lathe([0.18, 0.31, 0.06], [(0.0, -0.03), (0.04, -0.02), (0.05, 0.0), (0.045, 0.004), (0.0, -0.022)], "steel", seg=8, caps=False, tex="brushed")
    m.cyl([-0.22, 0.52, 0.05], 0.014, 0.28, "dark", seg=5)
    m.box([-0.22, 0.33, 0.05], [0.07, 0.11, 0.012], "steel", bevel=0.02, seg=2, edges="vertical", tex="perforated")
    m.cyl([0.32, 0.58, 0.06], 0.02, 0.18, "dark", seg=6)
    for k in range(3):
        c, s = 0.035 * math.cos(math.radians(60 * k)), 0.035 * math.sin(math.radians(60 * k))
        m.sweep([(0.32, 0.49, 0.06), (0.32 + c, 0.38, 0.06 + s), (0.32, 0.3, 0.06), (0.32 - c, 0.38, 0.06 - s), (0.32, 0.49, 0.06)], 0.004, "steel", seg=3, smooth=2, caps=False)
    m.cyl([0.45, 0.6, 0.06], 0.014, 0.14, "dark", seg=5)
    m.lathe([0.45, 0.45, 0.06], [(0.0, -0.05), (0.06, -0.03), (0.09, 0.0), (0.09, 0.01), (0.085, 0.01), (0.055, -0.024), (0.0, -0.042)], "metal", seg=10, r=[90, 0, 0], caps=False, tex="perforated")


build("utensil_rack", fp)
