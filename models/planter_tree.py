# The planter tree (#364), first person: a big square planter in panels with a rim in the room's
# colour round the soil, and a small tree: a tapering trunk, three leaning limbs, and a crown of
# soft clumps of foliage with leaves standing out of them. Run: blender -b --factory-startup -P models/planter_tree.py
import math
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    box = m.box([0, 0.3, 0], [1.6, 0.6, 1.6], "panel", omit=("bottom", "top"), tex="grain")
    for side in ("front", "back", "left", "right"):
        m.inset(m.side(box, side), 0.05, 0.012)
    # The rim, in the room's colour, round the soil.
    for sx in (-1, 1):
        m.box([sx * 0.8, 0.6, 0], [0.08, 0.06, 1.68], "accent", bevel=0.01, edges="upper", omit=("bottom",))
        m.box([0, 0.6, sx * 0.8], [1.52, 0.06, 0.08], "accent", bevel=0.01, edges="upper", omit=("bottom", "left", "right"))
    m.box([0, 0.6, 0], [1.52, 0.01, 1.52], "soil", omit=("bottom",))
    # The trunk, tapering, and its limbs.
    m.lathe([0, 0.6, 0], [(0.12, 0.0), (0.09, 0.15), (0.08, 0.9), (0.07, 1.2), (0.0, 1.25)], "rust", seg=6)
    limbs = [((0.0, 1.6, 0.0), (0.35, 2.2, 0.15), (0.45, 2.45, 0.2)), ((0.0, 1.5, 0.0), (-0.3, 2.1, -0.2), (-0.4, 2.4, -0.25)), ((0.0, 1.7, 0.0), (0.05, 2.4, -0.15), (0.05, 2.7, -0.1))]
    for path in limbs:
        m.sweep(list(path), 0.06, "rust", seg=5, smooth=1)
    # The crown: soft clumps of foliage round the limbs' ends, and leaves standing out of them.
    clumps = [((0.45, 2.55, 0.2), 0.7), ((-0.4, 2.5, -0.25), 0.75), ((0.05, 2.85, -0.1), 0.8), ((0.3, 2.75, -0.35), 0.55), ((-0.25, 2.8, 0.3), 0.6), ((0.0, 3.1, 0.1), 0.5)]
    for i, ((x, y, z), d) in enumerate(clumps):
        m.soft([x, y, z], [d, d * 0.7, d], "plant" if i % 2 else "leaf", round=1.0, puff=0.3, cuts=1, r=[0, i * 25, 0])
    for i, ((x, y, z), d) in enumerate(clumps):
        for k in range(2):
            yaw = i * 61 + k * 180
            m.blade([x, y + 0.1, z], yaw, 20, d * 0.55, 0.16, "leaf" if (i + k) % 2 else "plant", droop=0.08, seg=2)

build("planter_tree", fp)
