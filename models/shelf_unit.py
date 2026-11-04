# The shelf unit (#364), first person: steel uprights pierced with slots and five perforated steel
# shelves, holding crates with handle cut-outs, a hazard-marked tool box, a storage bin in the room's
# colour, a tub with a lid and a folded blanket. Run: blender -b --factory-startup -P models/shelf_unit.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 0.68, 1.0, sz * 0.23], [0.04, 2.0, 0.04], "metal", omit=("bottom",), tex="brushed")
        m.box([sx * 0.68, 0.35, 0], [0.02, 0.03, 0.42], "metal", omit=("bottom",))
    for y in (0.1, 0.6, 1.1, 1.6, 1.98):
        m.box([0, y, 0], [1.32, 0.025, 0.48], "metal", omit=("left", "right"), tex="perforated")
    # Crates with handle cut-outs.
    for x, y, c in ((-0.35, 0.3, "composite"), (-0.3, 1.3, "composite")):
        crate = m.box([x, y, 0], [0.5, 0.36, 0.4], c, bevel=0.01, edges="vertical", omit=("bottom",), tex="grain")
        m.inset(m.side(crate, "front"), 0.06, 0.015)
        m.box([x, y + 0.12, 0.201], [0.14, 0.04, 0.01], "dark", omit=("back",))
    # A storage bin in the room's colour, its lid a shade proud.
    m.box([0.3, 0.78, 0], [0.6, 0.32, 0.4], "accent", bevel=0.02, edges="vertical", omit=("bottom",))
    m.box([0.3, 0.955, 0], [0.62, 0.03, 0.42], "accent", bevel=0.01, edges="upper", omit=("bottom",))
    # A tool box, hazard-marked, with a carry handle.
    m.box([0.35, 1.22, 0], [0.4, 0.2, 0.3], "hazard", bevel=0.015, edges="upper", omit=("bottom",))
    m.sweep([(0.25, 1.32, 0), (0.27, 1.38, 0), (0.43, 1.38, 0), (0.45, 1.32, 0)], 0.02, "dark", seg=4, smooth=1, caps=False)
    # A tub with a lid, and a folded blanket on the top shelf.
    m.lathe([0.4, 0.115, 0], [(0.1, 0.0), (0.125, 0.33), (0.13, 0.35), (0.0, 0.36)], "white", seg=10)
    m.soft([0, 1.8, 0], [0.9, 0.3, 0.4], "composite", round=0.6, puff=0.1, cuts=1, omit=("bottom",), tex="fabric")


build("shelf_unit", fp)
