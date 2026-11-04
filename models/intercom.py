# The intercom (#364), first person: a panel unit with rounded corners, a glowing screen set into
# it, a speaker grille, two buttons and a blinking green light. Run: blender -b --factory-startup -P models/intercom.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    body = m.box([0, 0.15, 0.0], [0.2, 0.3, 0.04], "panel", bevel=0.015, seg=2, edges="vertical", omit=("back",))
    m.box([0, 0.2, 0.021], [0.14, 0.1, 0.004], "glow", glow=True, omit=("back",))
    grille = m.box([0, 0.27, 0.021], [0.1, 0.03, 0.004], "dark", omit=("back",))
    m.inset(m.split(m.side(grille, "front")[0], 4, "right"), 0.004, 0.002, "metal")
    for y in (0.09, 0.05):
        m.box([0, y, 0.022], [0.1, 0.022, 0.01], "dark", bevel=0.004, edges="upper", omit=("back",))
    m.cyl([0.07, 0.27, 0.022], 0.016, 0.006, "plant", seg=6, r=[90, 0, 0], glow=True)


build("intercom", fp)
