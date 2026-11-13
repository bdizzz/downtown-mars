# The suit locker (#367), first person: an open steel alcove on a dark plinth with a hanger bar and a
# shelf, and in it a pressure suit: a soft white torso with a life-support pack behind, a chest unit
# of glowing buttons, arms and legs as padded tubes with accent bands, gloves and boots, and the
# helmet on its neck ring with a mirrored visor; a spare oxygen bottle on the shelf.
# Run: blender -b --factory-startup -P models/suit_locker.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 1.1, -0.36], [0.98, 2.2, 0.06], "metal", omit=("back",), tex="brushed")
    for x in (-0.48, 0.48):
        m.box([x, 1.1, -0.01], [0.04, 2.2, 0.76], "metal", bevel=0.01, edges="vertical", tex="brushed")
    m.box([0, 0.04, -0.01], [0.92, 0.08, 0.76], "dark", omit=("bottom",), tex="tread")
    m.box([0, 2.0, -0.05], [0.92, 0.03, 0.62], "metal", tex="perforated")
    m.lathe([0.3, 2.015, -0.15], [(0.0, 0.0), (0.06, 0.0), (0.06, 0.12), (0.03, 0.16), (0.012, 0.17), (0.0, 0.17)], "hazard", seg=6)
    # The pack and the torso.
    m.box([0, 1.22, -0.2], [0.42, 0.56, 0.18], "white", bevel=0.03, edges="vertical")
    m.soft([0, 1.2, -0.02], [0.46, 0.5, 0.26], "white", round=0.7, puff=0.05, cuts=1, tex="fabric")
    m.box([0, 0.88, -0.02], [0.38, 0.18, 0.24], "white", bevel=0.04, edges="vertical", tex="fabric")
    m.box([0, 1.2, 0.12], [0.22, 0.14, 0.05], "panel", omit=("back",))
    for k, c in enumerate(("glow", "fire", "plant")):
        m.box([-0.06 + 0.06 * k, 1.21, 0.148], [0.035, 0.03, 0.008], c, glow=True, omit=("back",))
    m.box([0, 1.155, 0.148], [0.14, 0.012, 0.006], "dark", omit=("back",))
    m.sweep([(0.18, 1.35, -0.12), (0.22, 1.3, 0.05), (0.08, 1.24, 0.13)], 0.03, "dark", seg=4, smooth=2)
    m.box([0, 1.3, 0.11], [0.3, 0.04, 0.02], "accent", omit=("back",))
    # Arms, hanging, and gloves.
    for sx in (-1, 1):
        m.sweep([(sx * 0.24, 1.38, -0.03), (sx * 0.3, 1.15, 0.0), (sx * 0.31, 0.92, 0.04)], 0.12, "white", seg=5, smooth=2, tex="fabric")
        m.cyl([sx * 0.315, 0.85, 0.05], 0.09, 0.14, "dark", seg=6, d2=0.07)
        # Legs and boots.
        m.sweep([(sx * 0.1, 0.84, -0.02), (sx * 0.11, 0.5, 0.0), (sx * 0.11, 0.2, -0.01)], 0.15, "white", seg=5, smooth=1, tex="fabric")
        m.box([sx * 0.11, 0.18, 0.03], [0.14, 0.14, 0.26], "dark", bevel=0.03, edges="upper", omit=("bottom",))
        m.box([sx * 0.11, 0.095, 0.03], [0.15, 0.03, 0.27], "rubber", omit=("bottom",))
    # The neck ring and helmet.
    m.cyl([0, 1.47, -0.02], 0.26, 0.05, "steel", seg=10, tex="brushed")
    m.lathe([0, 1.49, -0.02], [(0.12, 0.0), (0.17, 0.04), (0.19, 0.14), (0.17, 0.27), (0.1, 0.34), (0.0, 0.36)], "white", seg=10, caps=False)
    m.lathe([0, 1.66, 0.08], [(0.13, 0.0), (0.12, 0.04), (0.08, 0.08), (0.0, 0.1)], "mirror", seg=10, r=[90, 0, 0], caps=False)


build("suit_locker", fp)
