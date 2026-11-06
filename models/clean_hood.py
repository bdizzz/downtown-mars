# The clean hood (#365), first person: a white cabinet with two inset doors and a steel work surface,
# a tilted glass sash with a handle, a glowing light panel at the back of the work space, a filter
# housing on top with a perforated grille and a stripe in the room's colour, and a few wafers and
# tweezers inside. Run: blender -b --factory-startup -P models/clean_hood.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    cab = m.box([0, 0.45, 0], [1.8, 0.9, 0.9], "white", omit=("bottom",))
    for d in m.split(m.side(cab, "front")[0], 2, "right"):
        m.inset([d], 0.04, 0.01)
    for x in (-0.08, 0.08):
        m.box([x, 0.65, 0.455], [0.02, 0.14, 0.02], "steel")
    m.box([0, 0.92, 0.0], [1.76, 0.04, 0.86], "steel", omit=("bottom",), tex="brushed")
    for x in (-0.89, 0.89):
        m.box([x, 1.25, 0.0], [0.02, 0.7, 0.9], "white", omit=("bottom",))
    m.box([0, 1.25, -0.43], [1.76, 0.7, 0.04], "glow", glow=True, omit=("front",))
    m.box([0, 1.25, -0.4], [1.76, 0.7, 0.02], "glow", glow=True, omit=("back",))
    m.box([0, 1.32, 0.38], [1.76, 0.56, 0.015], "mirror", r=[-12, 0, 0])
    m.box([0, 1.03, 0.43], [0.8, 0.03, 0.04], "steel", tex="brushed")
    top = m.box([0, 1.95, 0], [1.8, 0.7, 0.9], "white", omit=("bottom",))
    m.inset(m.side(top, "front"), 0.08, 0.02, "metal", tex="perforated")
    m.box([0, 1.62, 0.452], [1.4, 0.06, 0.008], "accent", omit=("back",))
    for k in range(4):
        m.cyl([-0.5 + 0.03 * k, 0.95 + 0.012 * k, 0.05], 0.2, 0.01, "mirror", seg=10)
    m.lathe([0.4, 0.94, 0.1], [(0.0, 0.0), (0.12, 0.0), (0.12, 0.04), (0.0, 0.04)], "white", seg=10)
    m.box([0.1, 0.95, 0.15], [0.14, 0.01, 0.012], "steel", r=[0, 20, 0])


build("clean_hood", fp)
