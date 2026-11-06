# The operating table (#366), first person: a turned pedestal on a broad base, a column in a ribbed
# boot, a padded white top with a head rest and two straps in the room colour, and a surgical lamp on a
# boom from a steel pole: a white dome with a glowing face and a handle in the middle.
# Run: blender -b --factory-startup -P models/operating_table.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.04, 0.1], [0.6, 0.08, 0.7], "white", bevel=0.03, seg=2, edges="upper", omit=("bottom",))
    m.lathe([0, 0.08, 0.1], [(0.16, 0.0), (0.14, 0.04), (0.15, 0.08), (0.12, 0.12), (0.14, 0.16), (0.12, 0.2), (0.14, 0.24), (0.12, 0.28), (0.1, 0.3)], "dark", seg=8, caps=False)
    m.cyl([0, 0.6, 0.1], 0.18, 0.6, "metal", seg=10, tex="brushed")
    m.box([0, 0.92, 0.1], [0.5, 0.06, 0.5], "metal", tex="brushed")
    # The top, its head rest and straps.
    m.box([0, 0.97, 0], [0.62, 0.04, 1.84], "steel", tex="brushed")
    m.soft([0, 1.02, 0.05], [0.58, 0.08, 1.7], "white", round=0.6, puff=0.1, cuts=2, omit=("bottom",), tex="quilt")
    m.soft([0, 1.02, -0.86], [0.34, 0.07, 0.2], "white", round=0.8, puff=0.3, cuts=1, tex="quilt")
    for z in (-0.2, 0.5):
        m.box([0, 1.065, z], [0.6, 0.012, 0.06], "accent", omit=("bottom",))
    # The pole, the boom and the lamp.
    m.cyl([0, 1.5, -0.95], 0.08, 3.0, "metal", seg=8, tex="brushed")
    m.sweep([(0, 2.92, -0.95), (0, 2.94, -0.6), (0, 2.94, -0.2), (0, 2.86, 0.1)], 0.06, "metal", seg=6, smooth=2, tex="brushed")
    m.lathe([0, 2.62, 0.1], [(0.32, 0.0), (0.34, 0.03), (0.3, 0.12), (0.18, 0.2), (0.05, 0.24), (0.0, 0.25)], "white", seg=12)
    m.cyl([0, 2.615, 0.1], 0.56, 0.012, "lamp", seg=12, glow=True)
    m.lathe([0, 2.6, 0.1], [(0.18, 0.0), (0.195, 0.0), (0.1875, 0.01), (0.18, 0.0)], "steel", seg=10, caps=False)
    m.cyl([0, 2.55, 0.1], 0.04, 0.12, "dark", seg=8)


build("operating_table", fp)
