# The medicine cabinet (#366), first person: a white cabinet with two doors, each with a frosted window
# and a bar handle, a cross in the room colour, two drawers underneath on a dark kick plate, and a box
# of gloves and two bottles on top.
# Run: blender -b --factory-startup -P models/med_cabinet.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    upper = m.box([0, 1.2, 0], [1.2, 1.24, 0.5], "white", omit=("bottom", "back"))
    for d in m.split(m.side(upper, "front")[0], 2, "right"):
        mid = m.inset([d], 0.04, 0.006)
        m.inset(mid, 0.08, 0.012, "mirror")
    lower = m.box([0, 0.33, 0], [1.2, 0.5, 0.5], "white", omit=("bottom", "back", "top"))
    for d in m.split(m.side(lower, "front")[0], 2, "right"):
        m.inset([d], 0.03, 0.008)
    m.box([0, 0.04, -0.01], [1.16, 0.08, 0.46], "dark", omit=("bottom",))
    for sx in (-1, 1):
        m.box([sx * 0.06, 1.15, 0.262], [0.025, 0.3, 0.025], "steel", omit=("back",), tex="brushed")
        m.box([sx * 0.3, 0.45, 0.258], [0.2, 0.025, 0.018], "steel", omit=("back",), tex="brushed")
    m.box([-0.3, 1.64, 0.255], [0.24, 0.07, 0.01], "accent", omit=("back",))
    m.box([-0.3, 1.64, 0.255], [0.07, 0.24, 0.01], "accent", omit=("back",))
    # On top: gloves and two bottles.
    m.box([0.25, 1.86, 0.02], [0.24, 0.08, 0.13], "cream", omit=("bottom",))
    m.box([0.25, 1.901, 0.02], [0.09, 0.002, 0.04], "dark", omit=("bottom",))
    for x, c in ((-0.2, "rust"), (-0.3, "white")):
        m.lathe([x, 1.82, 0.0], [(0.035, 0.0), (0.035, 0.05), (0.015, 0.065), (0.015, 0.08), (0.0, 0.08)], c, seg=8)


build("med_cabinet", fp)
