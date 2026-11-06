# The lawn (#366), first person: a turf mat in a low composite edging, its surface softly uneven, with
# tufts of grass lying low (the footprint is 5 cm tall), a few clover leaves and little flowers.
# Run: blender -b --factory-startup -P models/lawn.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for sz in (-1, 1):
        m.box([0, 0.015, sz * 0.985], [3.0, 0.03, 0.03], "composite", bevel=0.008, edges="top", omit=("bottom",), tex="grain")
        m.box([sz * 1.485, 0.015, 0], [0.03, 0.03, 1.94], "composite", bevel=0.008, edges="top", omit=("bottom",), tex="grain")
    m.box([0, 0.006, 0], [2.94, 0.012, 1.94], "soil", omit=("bottom",))
    m.soft([0, 0.02, 0], [2.94, 0.016, 1.94], "plant", round=0.2, puff=0.6, cuts=2, omit=("bottom",), tex="fabric")
    # Tufts of grass, lying low, placed by a fixed hash so every export is the same.
    for i in range(28):
        x = ((i * 0.618034) % 1) * 2.7 - 1.35
        z = ((i * 0.381966 + 0.13 * (i % 3)) % 1) * 1.7 - 0.85
        for k in range(2):
            m.blade([x, 0.024, z], (i * 47 + k * 150) % 360, 14, 0.09, 0.025, "leaf" if (i + k) % 3 else "plant", droop=0.01, seg=1)
    for i, (x, z, c) in enumerate(((-0.9, 0.4, "flower"), (0.3, -0.5, "white"), (1.0, 0.6, "flower"), (-0.2, 0.7, "white"), (0.8, -0.2, "power"))):
        m.lathe([x, 0.03, z], [(0.0, 0.0), (0.022, 0.008), (0.0, 0.012)], c, seg=5)


build("lawn", fp)
