# The cement bags (#365), first person: a pallet of grained slats stacked three layers high with plump
# grey fabric bags, laid crosswise in each layer, a printed band on each, one bag torn at the corner
# with a little pile spilled. Run: blender -b --factory-startup -P models/bag_stack.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def _pallet(m, w, d, h=0.12, c="fibre"):
    """A pallet: top slats on three runners, its height h."""
    for z in (-d / 2 + 0.05, 0.0, d / 2 - 0.05):
        m.box([0, h * 0.35, z], [w, h * 0.7, 0.1], c, omit=("bottom",), tex="grain")
    n = 5
    for k in range(n):
        m.box([-w / 2 + w / n * (k + 0.5), h - 0.015, 0], [w / n - 0.03, 0.03, d], c, omit=("bottom",), tex="grain")


def fp(m):
    _pallet(m, 1.3, 1.0, 0.12, "composite")
    for layer in range(3):
        y = 0.23 + 0.22 * layer
        if layer % 2 == 0:
            for x in (-0.31, 0.31):
                m.soft([x, y, 0], [0.6, 0.21, 0.92], "stone", round=0.6, puff=0.3, cuts=1, r=[0, 2 * (layer - 1), 0], tex="fabric")
                m.box([x, y + 0.02, 0.462], [0.4, 0.08, 0.004], "hazard", omit=("back",))
        else:
            for z in (-0.24, 0.24):
                m.soft([0, y, z], [1.24, 0.21, 0.46], "stone", round=0.6, puff=0.3, cuts=1, tex="fabric")
                m.box([0.4, y + 0.02, z + 0.232], [0.3, 0.08, 0.004], "hazard", omit=("back",))


build("bag_stack", fp)
