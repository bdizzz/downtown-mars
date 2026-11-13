# The pallet rack (#367), first person: perforated uprights in hazard yellow braced in zigzags, beams in
# the room colour at three levels with mesh decks, and on them pallets of crates and wrapped loads,
# and two ribbed drums on the top deck.
# Run: blender -b --factory-startup -P models/pallet_rack.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def pallet(m, x, y, w=1.1, d=0.9):
    for k in (-1, 0, 1):
        m.box([x + k * (w / 2 - 0.05), y + 0.04, 0], [0.1, 0.08, d], "composite", omit=("bottom",), tex="grain")
    m.box([x, y + 0.1, 0], [w, 0.04, d], "composite", omit=("bottom",), tex="grain")


def fp(m):
    for x in (-1.36, 1.36):
        for z in (-0.5, 0.5):
            m.box([x, 1.6, z], [0.08, 3.2, 0.08], "hazard", tex="perforated")
        # The bracing between the front and back uprights.
        for k in range(3):
            y0, y1 = 0.15 + k * 1.0, 1.1 + k * 1.0
            zf = 0.46 if k % 2 == 0 else -0.46
            m.sweep([(x, y0, zf), (x, y1, -zf)], 0.03, "metal", seg=4, smooth=1, caps=False)
        m.box([x, 0.01, 0], [0.08, 0.02, 1.1], "dark", omit=("bottom",))
    for y in (1.05, 2.05, 3.05):
        for z in (-0.5, 0.5):
            m.box([0, y, z], [2.64, 0.1, 0.06], "accent")
        m.box([0, y + 0.06, 0], [2.64, 0.02, 0.94], "metal", tex="perforated")
    # The floor level: two pallets, a crate and a wrapped stack.
    pallet(m, -0.65, 0.0)
    m.box([-0.65, 0.52, 0], [1.0, 0.8, 0.84], "composite", bevel=0.02, edges="vertical", omit=("bottom",), tex="grain")
    m.box([-0.65, 0.6, 0.425], [0.3, 0.16, 0.01], "hazard", omit=("back",))
    pallet(m, 0.65, 0.0)
    m.soft([0.65, 0.47, 0], [1.0, 0.7, 0.84], "accent", round=0.15, puff=0.04, cuts=1)
    # The middle level.
    pallet(m, -0.6, 1.08, w=1.2)
    m.soft([-0.6, 1.57, 0], [1.1, 0.7, 0.84], "accent", round=0.15, puff=0.04, cuts=1)
    m.box([0.7, 1.5, 0], [1.0, 0.7, 0.84], "composite", bevel=0.02, edges="vertical", omit=("bottom",), tex="grain")
    m.box([0.7, 1.55, 0.425], [0.3, 0.16, 0.01], "hazard", omit=("back",))
    # The top level: two drums and a crate between.
    for x in (-0.85, 0.85):
        m.lathe([x, 2.08, 0], [(0.0, 0.0), (0.27, 0.0), (0.28, 0.02), (0.27, 0.36), (0.28, 0.38), (0.27, 0.74), (0.0, 0.74)], "rust", seg=10)
        m.cyl([x + 0.12, 2.83, 0.05], 0.06, 0.02, "dark", seg=6)
    m.box([0, 2.38, 0], [0.5, 0.6, 0.7], "composite", omit=("bottom",), tex="grain")


build("pallet_rack", fp)
