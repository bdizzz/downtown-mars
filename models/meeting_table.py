# The meeting table (#367), first person: a long grained top with rounded corners on two brushed
# pedestals joined by a cable spine, a glowing conference puck in the middle, papers, a tablet and two
# cups, and six chairs in the room colour on bent steel sled frames, pulled in round it.
# Run: blender -b --factory-startup -P models/meeting_table.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def chair(m, x, s):
    """A chair at x, facing the table from side s (+1 the front, -1 the back)."""
    z = s * 0.85
    m.box([x, 0.45, z], [0.44, 0.05, 0.44], "accent", omit=("bottom",), tex="fabric")
    m.box([x, 0.73, s * 1.055], [0.44, 0.4, 0.04], "accent", bevel=0.012, edges="vertical", r=[s * -8, 0, 0], tex="fabric")
    for sx in (-1, 1):
        cx = x + sx * 0.19
        m.sweep([(cx, 0.012, z - s * 0.2), (cx, 0.012, z + s * 0.2), (cx, 0.42, z + s * 0.2), (cx, 0.43, z - s * 0.18), (cx, 0.9, s * 1.07)], 0.022, "metal", seg=3, smooth=1, caps=False)


def fp(m):
    m.box([0, 0.73, 0], [2.4, 0.04, 1.1], "composite", bevel=0.12, seg=2, edges="vertical", tex="grain")
    m.box([0, 0.7, 0], [2.3, 0.02, 1.0], "dark", omit=("top",))
    for x in (-0.8, 0.8):
        m.box([x, 0.36, 0], [0.12, 0.66, 0.3], "metal", omit=("top", "bottom"), tex="brushed")
        m.box([x, 0.015, 0], [0.16, 0.03, 0.8], "metal", bevel=0.01, edges="top", omit=("bottom",), tex="brushed")
    m.box([0, 0.66, 0], [1.5, 0.08, 0.1], "dark", omit=("top",))
    # The puck, papers, a tablet and cups.
    m.lathe([0, 0.75, 0], [(0.0, 0.0), (0.16, 0.0), (0.15, 0.025), (0.0, 0.03)], "dark", seg=10)
    m.cyl([0, 0.757, 0], 0.324, 0.01, "glow", seg=10, glow=True, caps=False)
    m.box([-0.7, 0.752, 0.3], [0.21, 0.004, 0.3], "white", r=[0, 8, 0])
    m.box([0.62, 0.754, -0.32], [0.24, 0.008, 0.17], "dark", r=[0, -12, 0])
    m.box([0.62, 0.759, -0.32], [0.21, 0.002, 0.14], "glow", glow=True, r=[0, -12, 0])
    for x, z in ((-0.35, 0.36), (0.25, 0.34)):
        m.lathe([x, 0.75, z], [(0.0, 0.0), (0.035, 0.0), (0.04, 0.09), (0.034, 0.09), (0.0, 0.07)], "white", seg=6)
    for x in (-0.7, 0.0, 0.7):
        for s in (-1, 1):
            chair(m, x, s)


build("meeting_table", fp)
