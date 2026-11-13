# The table (#364), first person: a panel top with a rounded edge on four tapered steel legs joined
# by an apron, a sheet of paper and a pen on it, and a mug in the room's colour with a handle.
# Run: blender -b --factory-startup -P models/table.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.73, 0], [1.2, 0.04, 0.8], "panel", bevel=0.012, seg=2, edges="all", tex="grain")
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 0.525, 0.355, sz * 0.325], [0.045, 0.71, 0.045], "metal", taper=[0.75, 0.75], bevel=0.008, edges="vertical", tex="brushed")
            m.cyl([sx * 0.525, 0.008, sz * 0.325], 0.04, 0.016, "rubber", seg=6)
    for sz in (-1, 1):
        m.box([0, 0.67, sz * 0.325], [1.0, 0.07, 0.02], "metal", omit=("top",), tex="brushed")
    for sx in (-1, 1):
        m.box([sx * 0.525, 0.67, 0], [0.02, 0.07, 0.6], "metal", omit=("top",), tex="brushed")
    # A sheet of paper, a pen, a mug.
    m.box([0.2, 0.7515, 0.05], [0.24, 0.003, 0.32], "white", r=[0, 8, 0], omit=("bottom",))
    m.cyl([0.3, 0.756, 0.12], 0.01, 0.14, "dark", seg=5, r=[0, 30, 90])
    m.lathe([-0.25, 0.75, -0.1], [(0.035, 0.0), (0.04, 0.01), (0.042, 0.1), (0.036, 0.1), (0.033, 0.02)], "accent", seg=10, caps=False)
    m.sweep([(-0.209, 0.83, -0.1), (-0.18, 0.82, -0.1), (-0.18, 0.78, -0.1), (-0.209, 0.77, -0.1)], 0.012, "accent", seg=4, smooth=2, caps=False)


build("table", fp)
