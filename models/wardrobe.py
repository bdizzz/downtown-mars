# The wardrobe (#364), first person: a grained fibre-composite carcass on a dark plinth under a
# dark crown, two doors each with two recessed panels and a long steel bar handle, a vent slot over
# each door. Run: blender -b --factory-startup -P models/wardrobe.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 1.02, -0.01], [1.18, 1.88, 0.56], "fibre", omit=("bottom", "back"), tex="grain")
    m.box([0, 0.04, 0], [1.16, 0.08, 0.56], "dark", omit=("bottom",))
    m.box([0, 2.0, 0], [1.24, 0.06, 0.62], "dark", bevel=0.015, edges="upper", omit=("bottom",))
    # Two doors, a hair proud of the carcass, each with a panel and a vent slot.
    for sx in (-1, 1):
        door = m.box([sx * 0.297, 1.02, 0.28], [0.586, 1.84, 0.03], "fibre", omit=("back",), tex="grain")
        front = m.side(door, "front")
        panels = m.split(front[0], 2, "top") if front else []
        if len(panels) == 2:
            low, high = sorted(panels, key=lambda f: f.calc_center_median().y)
            m.inset([low], 0.06, 0.015)
            m.inset([high], 0.06, 0.015)
        m.box([sx * 0.297, 1.88, 0.298], [0.36, 0.03, 0.01], "dark", omit=("back",))
        # The bar handle, standing off the door on two feet.
        x = sx * 0.05
        m.sweep([(x, 1.22, 0.295), (x, 1.22, 0.32), (x, 0.86, 0.32), (x, 0.86, 0.295)], 0.018, "steel", seg=5, smooth=1, caps=False, tex="brushed")


build("wardrobe", fp)
