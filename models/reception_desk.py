# The reception desk (#366), first person: a counter in the room colour with three inset panels on a
# kick plate, a grained transaction top with a rounded edge, papers, a pen and a bell on it, and behind
# it a lower work surface on steel legs with a monitor, a keyboard and a phone.
# Run: blender -b --factory-startup -P models/reception_desk.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    body = m.box([0, 0.57, 0], [2.6, 1.06, 0.5], "accent", omit=("bottom", "top"))
    for p in m.split(m.side(body, "front")[0], 3, "right"):
        m.inset([p], 0.06, 0.012)
    m.box([0, 0.04, 0.02], [2.56, 0.08, 0.44], "dark", omit=("bottom",))
    m.box([0, 1.125, 0.05], [2.7, 0.05, 0.62], "composite", bevel=0.015, seg=2, tex="grain")
    # Papers, a pen and a bell on the top.
    m.box([0.9, 1.151, 0.12], [0.24, 0.003, 0.3], "white", r=[0, -6, 0], omit=("bottom",))
    m.box([0.6, 1.151, 0.15], [0.16, 0.003, 0.22], "cream", r=[0, 8, 0], omit=("bottom",))
    m.cyl([0.75, 1.157, 0.05], 0.01, 0.14, "dark", seg=5, r=[0, 30, 90])
    m.lathe([-0.9, 1.15, 0.15], [(0.045, 0.0), (0.045, 0.006), (0.04, 0.02), (0.025, 0.045), (0.0, 0.05)], "copper", seg=10)
    m.cyl([-0.9, 1.205, 0.15], 0.01, 0.012, "copper", seg=6)
    # The work surface behind.
    m.box([0, 0.73, -0.5], [2.4, 0.04, 0.5], "panel", bevel=0.01, seg=1, tex="grain")
    for x in (-0.6, 0.6):
        m.box([x, 0.355, -0.5], [0.05, 0.71, 0.46], "metal", omit=("top",), tex="brushed")
    m.box([-0.5, 0.8, -0.6], [0.06, 0.1, 0.06], "dark")
    m.box([-0.5, 0.755, -0.6], [0.2, 0.01, 0.14], "dark", omit=("bottom",))
    mon = m.box([-0.5, 1.03, -0.55], [0.5, 0.31, 0.04], "dark")
    m.inset(m.side(mon, "front"), 0.02, 0.005, "glow", glow=True)
    m.box([-0.5, 0.757, -0.38], [0.42, 0.015, 0.14], "dark", omit=("bottom",))
    for r in range(3):
        m.box([-0.5, 0.766, -0.42 + 0.04 * r], [0.38, 0.006, 0.028], "metal", omit=("bottom",))
    m.box([0.4, 0.77, -0.55], [0.18, 0.04, 0.16], "dark", bevel=0.01, edges="top", omit=("bottom",))
    m.box([0.4, 0.8, -0.6], [0.2, 0.03, 0.05], "dark", bevel=0.012, edges="all")


build("reception_desk", fp)
