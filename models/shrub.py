# The shrub (#366), first person: a round stone pot with a rolled rim on soil, and a bush of soft
# clumps of foliage in two greens with leaves standing out of them and a few small twigs.
# Run: blender -b --factory-startup -P models/shrub.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.lathe([0, 0, 0], [(0.24, 0.0), (0.3, 0.14), (0.33, 0.17), (0.32, 0.2), (0.28, 0.2), (0.28, 0.16)], "stone", seg=12, caps=False)
    m.cyl([0, 0.17, 0], 0.56, 0.02, "soil", seg=12)
    clumps = [((0.0, 0.42, 0.0), 0.5), ((0.15, 0.6, 0.08), 0.38), ((-0.17, 0.56, -0.1), 0.42), ((0.04, 0.75, -0.05), 0.34), ((-0.06, 0.5, 0.15), 0.34)]
    for i, ((x, y, z), d) in enumerate(clumps):
        m.soft([x, y, z], [d, d * 0.75, d], "plant" if i % 2 else "leaf", round=1.0, puff=0.3, cuts=1, r=[0, i * 31, 0])
    for i, ((x, y, z), d) in enumerate(clumps):
        for k in range(3):
            m.blade([x, y + 0.05, z], i * 53 + k * 120, 25, d * 0.42, 0.1, "leaf" if (i + k) % 2 else "plant", droop=0.04, seg=1)
    for a, p in ((40, 50), (200, 60)):
        m.blade([0, 0.7, 0], a, p, 0.22, 0.012, "rust", seg=1)


build("shrub", fp)
