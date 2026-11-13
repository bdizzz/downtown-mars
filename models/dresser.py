# The dresser (#364), first person: a grained fibre-composite chest of three drawers, each a
# panel with a cup handle, under a dark top; a mirror in a fibre frame on the wall behind it; a
# pot in the room's colour with a leafy plant. Run: blender -b --factory-startup -P models/dresser.py
import math
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.42, 0], [1.2, 0.76, 0.5], "fibre", omit=("bottom", "back"), tex="grain")
    m.box([0, 0.02, 0], [1.14, 0.04, 0.46], "dark", omit=("bottom",))
    m.box([0, 0.83, 0], [1.24, 0.03, 0.54], "dark", bevel=0.01, edges="upper", omit=("bottom",))
    # Three drawers, each a panel and a cup handle.
    for y in (0.18, 0.42, 0.66):
        d = m.box([0, y, 0.255], [1.14, 0.22, 0.02], "composite", bevel=0.006, edges="all", omit=("back",), tex="grain")
        m.lathe([0, y + 0.03, 0.27], [(0.0, -0.012), (0.06, -0.012), (0.07, 0.0), (0.06, 0.008)], "steel", seg=6, r=[90, 0, 0], caps=False, tex="brushed")
    # The mirror, in a frame, on the wall behind.
    m.box([0, 1.3, -0.215], [0.88, 0.98, 0.02], "fibre", bevel=0.01, edges="vertical", omit=("back",), tex="grain")
    m.box([0, 1.3, -0.2], [0.8, 0.9, 0.01], "mirror", omit=("back",))
    # A pot and a plant on top.
    m.lathe([0.42, 0.85, 0.05], [(0.045, 0.0), (0.06, 0.04), (0.065, 0.16), (0.07, 0.18), (0.0, 0.18)], "accent", seg=8)
    m.lathe([0.42, 0.85, 0.05], [(0.06, 0.17), (0.06, 0.175)], "soil", seg=8, caps=False)
    for k in range(9):
        m.blade([0.42, 1.02, 0.05], k * 40 + 10, 35 + 12 * (k % 3), 0.17, 0.05, "leaf" if k % 2 else "plant", droop=0.06, roll=10)

build("dresser", fp)
