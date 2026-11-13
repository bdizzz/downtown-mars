# The bathroom pod (#364), first person: a moulded cubicle of panels with rounded corners and a
# white roof, its door in the room's colour set in a frame with a lever handle and a frosted
# window, a ventilation grille over the door, a glowing lamp over the way in and a towel hook.
# Run: blender -b --factory-startup -P models/bathroom_pod.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    # The walls: back, two sides, and the front either side of the door.
    m.box([0, 1.2, -0.78], [2.2, 2.4, 0.04], "panel", omit=("bottom",), tex="grain")
    for sx in (-1, 1):
        m.box([sx * 1.08, 1.2, 0], [0.04, 2.4, 1.6], "panel", bevel=0.02, edges="vertical", omit=("bottom",), tex="grain")
    front = m.box([0.5, 1.2, 0.78], [1.2, 2.4, 0.04], "panel", omit=("bottom",), tex="grain")
    m.inset(m.split(m.side(front, "front")[0], 2, "top"), 0.08, 0.01)
    m.box([-0.55, 2.28, 0.78], [0.9, 0.24, 0.04], "panel", omit=("bottom",), tex="grain")
    m.box([0, 2.43, 0], [2.24, 0.04, 1.64], "white", bevel=0.02, edges="upper", omit=("bottom",))
    # The door: a frame, the leaf in the room's colour, a frosted window and a lever handle.
    for x in (-1.0, -0.1):
        m.box([x, 1.08, 0.79], [0.05, 2.16, 0.06], "dark", omit=("bottom",))
    m.box([-0.55, 2.14, 0.79], [0.9, 0.05, 0.06], "dark")
    leaf = m.box([-0.55, 1.06, 0.79], [0.8, 2.1, 0.04], "accent", bevel=0.01, edges="vertical", omit=("bottom",))
    m.inset(m.side(leaf, "front"), 0.06, 0.006)
    m.box([-0.55, 1.6, 0.814], [0.3, 0.5, 0.01], "mirror", omit=("back",))
    m.box([-0.24, 1.05, 0.815], [0.05, 0.12, 0.02], "steel", bevel=0.006, omit=("back",), tex="brushed")
    m.sweep([(-0.24, 1.07, 0.825), (-0.24, 1.07, 0.85), (-0.36, 1.07, 0.85)], 0.022, "steel", seg=5, smooth=1, tex="brushed")
    # A grille over the door, the lamp over the way in and a towel hook.
    grille = m.box([-0.55, 2.3, 0.802], [0.5, 0.12, 0.006], "dark", omit=("back",))
    m.inset(m.split(m.side(grille, "front")[0], 4, "top"), 0.01, 0.003, "metal")
    m.box([0.5, 2.1, 0.81], [0.5, 0.12, 0.03], "metal", bevel=0.01, omit=("back",))
    m.box([0.5, 2.1, 0.826], [0.44, 0.08, 0.004], "lamp", glow=True, omit=("back",))
    m.sweep([(0.5, 1.5, 0.8), (0.5, 1.5, 0.84), (0.5, 1.56, 0.86)], 0.016, "steel", seg=4, smooth=2, tex="brushed")


build("bathroom_pod", fp)
