# The fridge (#366), first person: a tall white cabinet with a door and a freezer drawer, steel bar
# handles on stand-offs, a glowing display, a note and two magnets in the room colour, and a dark
# kick plate with a perforated grille.
# Run: blender -b --factory-startup -P models/fridge.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    body = m.box([0, 1.04, -0.04], [0.88, 1.92, 0.72], "white", omit=("bottom",))
    for door in m.split(m.side(body, "front")[0], 2, "top"):
        m.inset([door], 0.012, 0.006)
    m.box([0, 0.04, -0.02], [0.84, 0.08, 0.66], "dark", omit=("bottom",))
    m.box([0, 0.04, 0.31], [0.7, 0.05, 0.01], "metal", omit=("back",), tex="perforated")
    # Handles on stand-offs.
    for y0, y1 in ((1.25, 1.85), (0.3, 0.75)):
        m.sweep([(0.33, y0, 0.32), (0.33, y0, 0.37), (0.33, y1, 0.37), (0.33, y1, 0.32)], 0.03, "steel", seg=6, smooth=1, caps=False, tex="brushed")
    # The display, a note and magnets.
    disp = m.box([-0.22, 1.72, 0.325], [0.2, 0.12, 0.01], "dark", omit=("back",))
    m.inset(m.side(disp, "front"), 0.015, 0.0, "glow", glow=True)
    m.box([-0.05, 1.35, 0.322], [0.18, 0.22, 0.003], "cream", r=[0, 0, 4], omit=("back",))
    for y, w in ((1.4, 0.12), (1.36, 0.1), (1.32, 0.12), (1.28, 0.08)):
        m.box([-0.05, y, 0.3245], [w, 0.01, 0.002], "dark", r=[0, 0, 4], omit=("back",))
    for x, y in ((-0.06, 1.45), (0.15, 1.1)):
        m.cyl([x, y, 0.328], 0.04, 0.012, "accent", seg=8, r=[90, 0, 0])


build("fridge", fp)
