# The mop rack (#367), first person: a grained rail on the wall with spring clips holding a mop, a
# broom, a second mop and a squeegee by their handles, their heads resting in a drip tray below.
# Run: blender -b --factory-startup -P models/mop_rack.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 1.38, -0.19], [1.2, 0.1, 0.06], "fibre", bevel=0.01, edges="all", omit=("back",), tex="grain")
    for sx in (-1, 1):
        m.cyl([sx * 0.55, 1.38, -0.155], 0.025, 0.012, "steel", seg=6, r=[90, 0, 0])
    tray = m.box([0, 0.035, 0], [1.2, 0.07, 0.34], "metal", omit=("bottom",), tex="brushed")
    m.inset(m.side(tray, "top"), 0.02, 0.05, c="dark")
    for x, kind in ((-0.45, "mop"), (-0.15, "broom"), (0.15, "mop"), (0.45, "squeegee")):
        # The clip, the handle and its cap.
        m.box([x, 1.36, -0.145], [0.05, 0.06, 0.03], "dark", bevel=0.008, edges="vertical")
        m.cyl([x, 0.83, -0.115], 0.028, 1.12, "fibre", seg=6, r=[4, 0, 0], tex="grain")
        m.cyl([x, 1.41, -0.155], 0.034, 0.05, "accent", seg=6, r=[4, 0, 0])
        if kind == "mop":
            m.cyl([x, 0.31, -0.075], 0.05, 0.06, "dark", seg=6)
            m.soft([x, 0.19, -0.06], [0.22, 0.2, 0.14], "cream", round=0.9, puff=0.1, cuts=1, tex="fabric")
            for k in range(4):
                m.cyl([x - 0.075 + 0.05 * k, 0.1, -0.06 + (k % 2) * 0.04], 0.04, 0.08, "cream", seg=5, d2=0.03, tex="fabric")
        elif kind == "broom":
            m.box([x, 0.2, -0.07], [0.3, 0.07, 0.07], "accent", bevel=0.01, edges="vertical")
            m.box([x, 0.12, -0.07], [0.28, 0.1, 0.05], "dark", omit=("top",), tex="fabric")
        else:
            m.box([x, 0.18, -0.07], [0.3, 0.05, 0.04], "hazard", bevel=0.008, edges="vertical")
            m.box([x, 0.13, -0.07], [0.31, 0.05, 0.012], "rubber", omit=("top",))


build("mop_rack", fp)
