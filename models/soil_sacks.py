# The soil sacks (#365), first person: a pallet of grained slats with four plump fabric sacks of soil
# stacked on it, their tops folded and their labels showing, and a rust-red sack on top.
# Run: blender -b --factory-startup -P models/soil_sacks.py
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
    _pallet(m, 1.3, 0.9, 0.1, "composite")
    for (x, y, z, c, r) in ((-0.31, 0.2, 0.0, "soil", 2), (0.33, 0.2, 0.0, "soil", -3), (0.0, 0.39, 0.0, "soil", 5), (0.03, 0.57, 0.05, "rust", -8)):
        m.soft([x, y, z], [0.6, 0.19, 0.76], c, round=0.6, puff=0.3, cuts=1, r=[0, r, 0], tex="fabric")
        m.box([x, y + 0.05, z - 0.35], [0.5, 0.04, 0.04], c, r=[0, r, 0], omit=("bottom",), tex="fabric")
        m.box([x, y + 0.01, z + 0.382], [0.3, 0.1, 0.004], "cream" if c == "soil" else "power", r=[0, r, 0], omit=("back",))
    m.cyl([0.03, 0.635, 0.3], 0.06, 0.012, "plant", seg=6)


build("soil_sacks", fp)
