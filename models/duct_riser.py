# The air duct (#365), first person: a tall brushed steel duct with dark flanges at each joint, a
# louvred access panel, a damper box with its lever, a wall bracket and a label band.
# Run: blender -b --factory-startup -P models/duct_riser.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 2.0, 0], [0.86, 4.0, 0.66], "metal", omit=("bottom",), tex="brushed")
    for y in (0.6, 1.6, 2.6, 3.6):
        m.box([0, y, 0], [0.94, 0.06, 0.74], "dark", omit=())
    access = m.box([0, 0.95, 0.335], [0.6, 0.5, 0.02], "dark", omit=("back",))
    m.inset(m.split(m.side(access, "front")[0], 6, "top"), 0.02, 0.012, "metal")
    for x in (-0.27, 0.27):
        for y in (0.73, 1.17):
            m.cyl([x, y, 0.348], 0.02, 0.008, "steel", seg=5, r=[90, 0, 0])
    m.box([0.0, 2.1, 0.355], [0.28, 0.2, 0.05], "dark", bevel=0.01, edges="all")
    m.box([0.08, 2.1, 0.385], [0.2, 0.03, 0.02], "hazard", r=[0, 0, 30])
    m.box([0, 3.0, -0.36], [0.5, 0.08, 0.04], "dark")
    m.box([0, 1.85, 0.332], [0.86, 0.08, 0.004], "accent", omit=("back",))
    m.box([-0.2, 1.85, 0.335], [0.3, 0.04, 0.003], "white", omit=("back",))


build("duct_riser", fp)
