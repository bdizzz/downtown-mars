# The partition (#364), first person: a padded screen in the room's colour, quilted, stretched in a
# round-tube steel frame on two splayed feet with rubber pads. Run: blender -b --factory-startup -P models/partition.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.soft([0, 0.92, 0], [1.74, 1.64, 0.05], "accent", round=0.4, puff=0.0, cuts=2, tex="quilt")
    # The frame: one bent tube up one side, over the top and down the other.
    m.sweep([(-0.9, 0.06, 0), (-0.9, 1.7, 0), (-0.88, 1.76, 0), (0.88, 1.76, 0), (0.9, 1.7, 0), (0.9, 0.06, 0)], 0.045, "metal", seg=6, smooth=1, tex="brushed")
    # Splayed feet with rubber pads.
    for sx in (-1, 1):
        m.box([sx * 0.9, 0.04, 0], [0.06, 0.05, 0.38], "metal", taper=[1.0, 0.8], bevel=0.01, edges="top", tex="brushed")
        for sz in (-1, 1):
            m.cyl([sx * 0.9, 0.008, sz * 0.17], 0.05, 0.016, "rubber", seg=6)


build("partition", fp)
