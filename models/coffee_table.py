# The coffee table (#364), first person: a grained fibre-composite top with rounded corners on four
# tapered dark legs, a lower shelf, two books stacked in the room's colour and cream, a cup.
# Run: blender -b --factory-startup -P models/coffee_table.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.4, 0], [1.1, 0.04, 0.6], "fibre", bevel=0.05, seg=2, edges="vertical", tex="grain")
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 0.47, 0.19, sz * 0.22], [0.05, 0.38, 0.05], "dark", taper=[1.3, 1.3], bevel=0.01, edges="vertical")
    m.box([0, 0.12, 0], [0.92, 0.025, 0.42], "fibre", omit=("bottom",), tex="grain")
    # Two books, one on the other, a little turned, and a cup.
    m.box([-0.25, 0.437, 0.02], [0.3, 0.035, 0.22], "accent", bevel=0.004, omit=("bottom",), r=[0, 6, 0])
    m.box([-0.24, 0.47, 0.02], [0.26, 0.03, 0.2], "cream", bevel=0.004, omit=("bottom",), r=[0, -9, 0])
    m.lathe([0.3, 0.42, -0.05], [(0.03, 0.0), (0.045, 0.09), (0.04, 0.09), (0.0, 0.07)], "white", seg=10, caps=False)
    # A magazine on the shelf.
    m.box([0.2, 0.137, 0.05], [0.3, 0.008, 0.22], "power", omit=("bottom",), r=[0, -12, 0])


build("coffee_table", fp)
