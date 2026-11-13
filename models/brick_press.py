# The brick press (#365), first person: a base in the room's colour, two steel columns, a dark
# crosshead with a turned hydraulic ram pressing a platen into the mould, a rust-red brick just
# pressed, hoses looping to a control box with buttons.
# Run: blender -b --factory-startup -P models/brick_press.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    base = m.box([0, 0.4, 0], [1.4, 0.8, 1.0], "accent", omit=("bottom",), tex="grain")
    m.inset(m.side(base, "front"), 0.06, 0.015)
    for x in (-0.6, 0.6):
        m.cyl([x, 1.3, 0], 0.12, 1.0, "steel", seg=8, caps=False, tex="brushed")
        m.cyl([x, 1.72, 0], 0.16, 0.08, "dark", seg=6)
    m.box([0, 1.85, 0], [1.4, 0.2, 0.5], "dark", bevel=0.02, edges="upper", omit=("bottom",))
    m.lathe([0, 1.2, 0], [(0.08, 0.0), (0.08, 0.3), (0.13, 0.32), (0.13, 0.55)], "steel", seg=10, tex="brushed")
    m.box([0, 1.16, 0.05], [0.7, 0.06, 0.42], "metal", tex="brushed")
    mould = m.box([0, 0.86, 0.05], [0.8, 0.12, 0.5], "metal", omit=("bottom",), tex="brushed")
    m.inset(m.side(mould, "top"), 0.06, 0.05, "dark")
    m.box([0.0, 0.88, 0.05], [0.24, 0.07, 0.12], "rust", omit=("bottom",))
    for x in (-0.25, 0.25):
        m.sweep([(x * 1.2, 1.88, 0.2), (x * 1.6, 1.9, 0.35), (x * 2.2, 1.6, 0.45), (x * 2.4, 1.2, 0.47)], 0.04, "rubber", seg=4, smooth=2, caps=False)
    m.box([0.56, 1.1, 0.42], [0.2, 0.3, 0.12], "dark", bevel=0.01, edges="all")
    for k, c in enumerate(("plant", "red", "power")):
        m.cyl([0.56, 1.2 - 0.08 * k, 0.485], 0.04, 0.02, c, seg=6, r=[90, 0, 0])


build("brick_press", fp)
