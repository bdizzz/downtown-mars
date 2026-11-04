# The coat rack (#364), first person: a turned base, a steel pole with a finial, curled hooks round
# its top, a coat in the room's colour hanging from one and a scarf from another.
# Run: blender -b --factory-startup -P models/coat_rack.py
import math
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.lathe([0, 0, 0], [(0.19, 0.0), (0.19, 0.015), (0.14, 0.035), (0.04, 0.05), (0.03, 0.07)], "dark", seg=12)
    m.cyl([0, 0.9, 0], 0.035, 1.7, "metal", seg=8, caps=False, tex="brushed")
    m.lathe([0, 1.74, 0], [(0.02, 0.0), (0.035, 0.02), (0.03, 0.04), (0.0, 0.06)], "dark", seg=8)
    # Four hooks curling out and up.
    for k in range(4):
        a = math.radians(45 + 90 * k)
        c, s = math.cos(a), math.sin(a)
        m.sweep([(0.0, 1.62, 0.0), (0.09 * c, 1.6, 0.09 * s), (0.15 * c, 1.62, 0.15 * s), (0.16 * c, 1.68, 0.16 * s)], 0.016, "metal", seg=4, smooth=2, tex="brushed")
    # A coat on the front-right hook: shoulders, body and a sleeve.
    m.soft([0.14, 1.36, 0.08], [0.24, 0.5, 0.13], "accent", round=0.6, puff=0.1, cuts=2, r=[0, -45, 4], tex="fabric")
    m.soft([0.15, 1.08, 0.09], [0.26, 0.22, 0.14], "accent", round=0.5, puff=0.0, cuts=1, r=[0, -45, 2], tex="fabric")
    m.soft([0.2, 1.24, 0.15], [0.07, 0.42, 0.07], "accent", round=0.9, puff=0.0, cuts=1, r=[6, -45, 8], tex="fabric")
    # A scarf over the back-left hook, its ends hanging.
    m.strip([(-0.13, -0.08), (-0.1, -0.12), (-0.06, -0.14)], 1.2, 1.6, 0.012, "cushion", tex="fabric")
    m.strip([(-0.16, -0.04), (-0.13, -0.09)], 1.26, 1.6, 0.012, "cushion", tex="fabric")


build("coat_rack", fp)
