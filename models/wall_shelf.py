# The wall shelf (#364), first person: a fibre-composite shelf on two dark brackets, three books
# leaning in the room's colour, rust and board-grey, a copper jar with a lid and a little mirrored
# globe. Run: blender -b --factory-startup -P models/wall_shelf.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.14, 0.1], [1.0, 0.035, 0.22], "fibre", bevel=0.008, edges="upper", tex="grain")
    for x in (-0.38, 0.38):
        m.box([x, 0.07, 0.0], [0.025, 0.1, 0.02], "dark", omit=("back",))
        m.sweep([(x, 0.02, 0.0), (x, 0.06, 0.1), (x, 0.12, 0.18)], 0.016, "dark", seg=4, smooth=1)
    # Books: three upright, leaning on each other, and a bookend.
    for x, h, c, r in ((-0.34, 0.22, "accent", 0), (-0.29, 0.24, "rust", 0), (-0.22, 0.25, "board", -14)):
        m.box([x, 0.158 + h / 2, 0.1], [0.045, h, 0.16], c, bevel=0.003, r=[0, 0, r], omit=("bottom",))
    m.box([-0.39, 0.23, 0.1], [0.01, 0.14, 0.1], "metal", omit=("bottom",))
    # A copper jar with a lid, and a mirrored globe.
    m.lathe([0.05, 0.158, 0.1], [(0.05, 0.0), (0.06, 0.03), (0.06, 0.13), (0.045, 0.15), (0.045, 0.16)], "copper", seg=10, tex="brushed")
    m.lathe([0.05, 0.318, 0.1], [(0.05, 0.0), (0.05, 0.012), (0.012, 0.025), (0.01, 0.04), (0.0, 0.045)], "copper", seg=10, tex="brushed")
    m.lathe([0.3, 0.158, 0.1], [(0.03, 0.0), (0.03, 0.012), (0.06, 0.04), (0.07, 0.09), (0.06, 0.13), (0.03, 0.155), (0.0, 0.16)], "mirror", seg=10)


build("wall_shelf", fp)
