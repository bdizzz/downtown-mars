# The treadmill (#366), first person: a dark deck with a tread belt between side rails, a rounded motor
# hood in the room colour at the front, two bent steel uprights with handrails and rubber grips, and a
# console with a glowing screen, buttons and a safety key on its cord.
# Run: blender -b --factory-startup -P models/treadmill.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.09, 0.25], [0.8, 0.18, 1.8], "dark", bevel=0.02, seg=1, edges="upper", omit=("bottom",))
    m.box([0, 0.185, 0.3], [0.56, 0.012, 1.6], "rubber", omit=("bottom",), tex="tread")
    for sx in (-1, 1):
        m.box([sx * 0.34, 0.19, 0.3], [0.1, 0.02, 1.6], "metal", bevel=0.006, edges="top", omit=("bottom",), tex="tread")
    for z in (-0.5, 1.1):
        m.cyl([0, 0.11, z], 0.12, 0.6, "metal", seg=8, r=[0, 0, 90], tex="brushed")
    m.soft([0, 0.17, -0.58], [0.8, 0.18, 0.32], "accent", round=0.6, puff=0.1, cuts=1, omit=("bottom",))
    # The uprights and handrails.
    for sx in (-1, 1):
        m.sweep([(sx * 0.36, 0.2, -0.55), (sx * 0.36, 0.8, -0.6), (sx * 0.36, 1.25, -0.62)], 0.05, "metal", seg=6, smooth=2, tex="brushed")
        m.sweep([(sx * 0.36, 1.1, -0.62), (sx * 0.37, 1.1, -0.3), (sx * 0.36, 1.05, -0.15)], 0.035, "steel", seg=6, smooth=2, tex="brushed")
        m.cyl([sx * 0.37, 1.1, -0.32], 0.045, 0.2, "rubber", seg=6, r=[90, 0, 0])
    # The console.
    m.box([0, 1.28, -0.62], [0.78, 0.06, 0.28], "metal", bevel=0.015, edges="all", tex="brushed")
    con = m.box([0, 1.38, -0.66], [0.42, 0.22, 0.04], "dark", r=[-20, 0, 0])
    m.inset(m.side(con, "front"), 0.03, 0.004, "glow", glow=True)
    for k, c in enumerate(("plant", "power", "red", "power", "plant")):
        m.box([-0.24 + 0.12 * k, 1.315, -0.52], [0.06, 0.012, 0.05], c, omit=("bottom",))
    m.box([0.3, 1.32, -0.5], [0.04, 0.03, 0.03], "red", omit=("bottom",))
    m.sweep([(0.3, 1.31, -0.49), (0.32, 1.22, -0.48), (0.34, 1.15, -0.5)], 0.006, "red", seg=3, smooth=2)


build("treadmill", fp)
