# The spiral stair well (#367), first person: the edge of the round opening a spiral stair comes up
# through, a turned nosing ring of hazard tread plate with dark chevrons round it and bolt heads.
# Run: blender -b --factory-startup -P models/spiral_well.py
import math
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.lathe([0, 0, 0], [(1.4, 0.0), (1.4, 0.05), (1.42, 0.06), (1.5, 0.06), (1.53, 0.04), (1.53, 0.0)], "hazard", seg=24, caps=False, tex="tread")
    for k in range(12):
        a = math.radians(15 + 30 * k)
        m.box([1.465 * math.sin(a), 0.062, 1.465 * math.cos(a)], [0.12, 0.004, 0.07], "dark", omit=("bottom",), r=[0, math.degrees(a) + 45, 0])
        b = a + math.radians(15)
        m.cyl([1.48 * math.sin(b), 0.062, 1.48 * math.cos(b)], 0.02, 0.006, "steel", seg=5)


build("spiral_well", fp)
