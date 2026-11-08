# The spiral stair rail (#367), first person: the round guard on the floor a spiral stair arrives at,
# a turned top rail and mid rail of brushed steel on twelve posts with foot plates, and a hazard kick
# band round its foot.
# Run: blender -b --factory-startup -P models/spiral_rail.py
import math
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build

R = 1.45


def ring(m, y, d, c, seg, tex=None):
    """A round rail of section d at radius R, height y: a closed profile turned round (seen from all sides)."""
    h = d / 2
    m.lathe([0, y, 0], [(R - h, 0.0), (R, -h), (R + h, 0.0), (R, h), (R - h, 0.0)], c, seg=seg, caps=False, tex=tex)


def fp(m):
    ring(m, 1.0, 0.05, "steel", 24, tex="brushed")
    ring(m, 0.5, 0.03, "steel", 20)
    m.lathe([0, 0, 0], [(R - 0.01, 0.0), (R - 0.01, 0.1), (R + 0.01, 0.1), (R + 0.01, 0.0)], "hazard", seg=24, caps=False, tex="tread")
    for k in range(12):
        a = math.radians(30 * k)
        x, z = R * math.sin(a), R * math.cos(a)
        m.cyl([x, 0.5, z], 0.045, 1.0, "steel", seg=6, caps=False, tex="brushed")


build("spiral_rail", fp)
