# The filing cabinet (#367), first person: a brushed steel carcass on a dark plinth, four drawers
# recessed into its front, each with a cup handle and a label holder with a card, a lock at the top,
# and on top a tray of papers and a mug of pens.
# Run: blender -b --factory-startup -P models/filing_cabinet.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.03, 0], [0.46, 0.06, 0.6], "dark", omit=("bottom",))
    body = m.box([0, 0.65, -0.02], [0.5, 1.18, 0.64], "metal", omit=("bottom",), tex="brushed")
    drawers = m.split(m.side(body, "front")[0], 4, "top")
    m.inset(drawers, 0.015, 0.01)
    for k in range(4):
        y = 0.06 + 0.295 * k + 0.2
        m.sweep([(-0.07, y, 0.3), (-0.06, y - 0.03, 0.315), (0.06, y - 0.03, 0.315), (0.07, y, 0.3)], 0.016, "steel", seg=4, smooth=1, caps=False, tex="brushed")
        m.box([0, y + 0.05, 0.302], [0.1, 0.04, 0.006], "steel", omit=("back",))
        m.box([0, y + 0.05, 0.305], [0.08, 0.025, 0.004], "cream", omit=("back",))
    m.cyl([0.17, 1.17, 0.302], 0.025, 0.012, "steel", seg=8, r=[90, 0, 0])
    m.box([0.17, 1.17, 0.31], [0.004, 0.012, 0.004], "dark")
    # On top: a paper tray and a mug of pens.
    m.box([-0.06, 1.25, -0.04], [0.3, 0.008, 0.38], "dark", omit=("bottom",))
    for k, s in ((0, 0.0), (1, 0.03), (2, -0.03)):
        m.box([-0.06 + s * 0.3, 1.258 + k * 0.006, -0.04], [0.21, 0.006, 0.3], "white", r=[0, s * 60, 0])
    m.lathe([0.16, 1.24, 0.12], [(0.0, 0.0), (0.035, 0.0), (0.04, 0.05), (0.035, 0.05), (0.0, 0.04)], "accent", seg=8)
    for k, c in enumerate(("hazard", "dark", "red")):
        m.cyl([0.15 + 0.012 * k, 1.29, 0.12 + 0.008 * (k - 1)], 0.008, 0.02, c, seg=4)


build("filing_cabinet", fp)
