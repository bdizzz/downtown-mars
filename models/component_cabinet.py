# The parts cabinet (#365), first person: a pale steel cabinet of sixteen small drawers in two
# columns, their fronts recessed with label cards, white and in the room's colour, each with a pull,
# on a dark plinth with a top rail. Run: blender -b --factory-startup -P models/component_cabinet.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    # Two columns, each its own carcass so its front cuts cleanly into eight drawers.
    for k, x in enumerate((-0.3, 0.3)):
        col = m.box([x, 0.93, 0], [0.6, 1.66, 0.5], "panel", omit=("bottom", "right" if x < 0 else "left"), tex="grain")
        for j, d in enumerate(sorted(m.split(m.side(col, "front")[0], 8, "top"), key=lambda f: f.calc_center_median().y)):
            m.inset([d], 0.02, 0.008, "accent" if (j + k) % 3 == 0 else "white")
    for x in (-0.3, 0.3):
        for j in range(8):
            y = 0.1 + 0.2075 * (j + 0.5)
            m.box([x, y - 0.04, 0.255], [0.12, 0.018, 0.018], "steel")
            m.box([x, y + 0.03, 0.243], [0.18, 0.05, 0.003], "cream", omit=("back",))
    m.box([0, 0.05, 0], [1.16, 0.1, 0.46], "dark", omit=("bottom",))
    m.box([0, 1.78, 0], [1.2, 0.04, 0.5], "dark", bevel=0.01, edges="upper", omit=("bottom",))


build("component_cabinet", fp)
