# The TV unit (#364), first person: a low composite cabinet with two sliding doors and a shelf of
# cubbies, a dark screen on a wall bracket with its picture glowing, and a speaker each side with
# a perforated grille and a cone. Run: blender -b --factory-startup -P models/tv_unit.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    cab = m.box([0, 0.26, 0], [2.0, 0.44, 0.45], "composite", bevel=0.012, edges="upper", omit=("bottom", "back"), tex="grain")
    m.box([0, 0.02, 0], [1.9, 0.04, 0.41], "dark", omit=("bottom",))
    front = m.side(cab, "front")
    if front:
        doors = m.split(front[0], 3, "right")
        for i, d in enumerate(sorted(doors, key=lambda f: f.calc_center_median().x)):
            m.inset([d], 0.03, 0.18 if i == 1 else 0.006, "dark" if i == 1 else None)
    for x in (-0.6, 0.6):
        m.box([x * 1.12, 0.26, 0.232], [0.12, 0.02, 0.012], "dark", omit=("back",))
    # The screen on its bracket.
    m.box([0, 1.25, -0.205], [0.3, 0.2, 0.04], "dark", omit=("back",))
    m.box([0, 1.25, -0.16], [1.7, 0.95, 0.05], "dark", bevel=0.012, seg=2, edges="vertical")
    m.box([0, 1.255, -0.134], [1.62, 0.87, 0.004], "glow", glow=True, omit=("back",))
    # Two speakers, each a cabinet, a grille and a cone.
    for sx in (-1, 1):
        sp = m.box([sx * 0.8, 0.7, 0.05], [0.18, 0.4, 0.18], "dark", bevel=0.012, edges="vertical", omit=("bottom",))
        m.inset(m.side(sp, "front"), 0.02, 0.005, "metal", tex="perforated")
        m.lathe([sx * 0.8, 0.62, 0.14], [(0.06, 0.0), (0.03, 0.012), (0.012, 0.015), (0.0, 0.016)], "rubber", seg=10, r=[90, 0, 0], caps=False)


build("tv_unit", fp)
