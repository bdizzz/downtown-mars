# The gas bottles (#365), first person: a dark base with a rail behind, four turned bottles with
# rounded shoulders, white and green, each with a valve and a little handwheel, coloured bands at the
# neck, and a hazard-yellow chain across the front.
# Run: blender -b --factory-startup -P models/gas_bottles.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.05, 0], [1.3, 0.1, 0.6], "dark", omit=("bottom",), tex="tread")
    for x in (-0.62, 0.62):
        m.box([x, 0.65, -0.22], [0.05, 1.2, 0.05], "metal", omit=("bottom",), tex="brushed")
    m.box([0, 1.1, -0.22], [1.3, 0.05, 0.05], "metal", tex="brushed")
    for k, x in enumerate((-0.45, -0.15, 0.15, 0.45)):
        c = "white" if k % 2 == 0 else "leaf"
        m.lathe([x, 0.1, 0], [(0.11, 0.0), (0.13, 0.03), (0.13, 1.2), (0.1, 1.33), (0.04, 1.38), (0.035, 1.42)], c, seg=8)
        m.lathe([x, 1.26, 0], [(0.124, 0.0), (0.124, 0.06)], "red" if k % 2 else "blueprint", seg=8, caps=False)
        m.cyl([x, 1.48, 0], 0.05, 0.1, "steel", seg=6, tex="brushed")
        m.cyl([x + 0.04, 1.47, 0], 0.03, 0.06, "steel", seg=5, r=[0, 0, 90])
        m.cyl([x, 1.55, 0], 0.08, 0.02, "dark", seg=6)
    links = [(-0.62, 1.1, 0.12), (-0.3, 1.03, 0.16), (0.0, 1.0, 0.16), (0.3, 1.03, 0.16), (0.62, 1.1, 0.12)]
    m.sweep(links, 0.03, "hazard", seg=4, smooth=3, caps=False)


build("gas_bottles", fp)
