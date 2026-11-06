# The flower bed (#366), first person: a stone planter with three recessed panels and a rounded cap,
# soil, and seven clumps of leaves each holding up a flower on a stem, in the bed's four colours.
# Run: blender -b --factory-startup -P models/flower_bed.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    box = m.box([0, 0.19, 0], [1.94, 0.38, 0.64], "stone", omit=("bottom", "top", "back"))
    for p in m.split(m.side(box, "front")[0], 3, "right"):
        m.inset([p], 0.04, 0.012)
    for sz in (-1, 1):
        m.box([0, 0.4, sz * 0.32], [2.0, 0.04, 0.06], "stone", bevel=0.012, edges="top", omit=("bottom",))
    for sx in (-1, 1):
        m.box([sx * 0.97, 0.4, 0], [0.06, 0.04, 0.58], "stone", bevel=0.012, edges="top", omit=("bottom",))
    m.box([0, 0.4, 0], [1.88, 0.02, 0.58], "soil", omit=("bottom",))
    # Seven clumps, a flower on a stem in each.
    colours = ("flower", "red", "power", "flower", "red", "power", "flower")
    for i, c in enumerate(colours):
        x = -0.78 + 0.26 * i
        z = 0.06 if i % 2 else -0.06
        for k in range(4):
            m.blade([x, 0.41, z], i * 37 + k * 90, 30, 0.2, 0.07, "leaf" if (i + k) % 2 else "plant", droop=0.05, seg=1)
        m.cyl([x + 0.02, 0.55, z], 0.012, 0.28, "plant", seg=4)
        m.lathe([x + 0.02, 0.68, z], [(0.0, 0.0), (0.045, 0.03), (0.06, 0.06), (0.0, 0.05)], c, seg=6)
        m.lathe([x + 0.02, 0.735, z], [(0.0, 0.0), (0.018, 0.006), (0.0, 0.015)], "cream", seg=4)


build("flower_bed", fp)
