# The bricks on a pallet (#365), first person: a grained pallet with four courses of red and rust
# bricks laid crosswise, course on course, held by two steel straps.
# Run: blender -b --factory-startup -P models/brick_pallet.py
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
    _pallet(m, 1.2, 1.0, 0.12, "fibre")
    for layer in range(4):
        y = 0.12 + 0.075 + 0.15 * layer
        c = "red" if layer % 2 == 0 else "rust"
        if layer % 2 == 0:
            for x in (-0.42, -0.14, 0.14, 0.42):
                for z in (-0.24, 0.24):
                    m.box([x, y, z], [0.26, 0.14, 0.46], c, omit=("bottom",), tex="tread")
        else:
            for z in (-0.37, -0.125, 0.125, 0.37):
                for x in (-0.3, 0.3):
                    m.box([x, y, z], [0.58, 0.14, 0.22], c, omit=("bottom",), tex="tread")
    for x in (-0.25, 0.25):
        m.sweep([(x, 0.12, 0.49), (x, 0.725, 0.49), (x, 0.74, 0.475), (x, 0.74, -0.475), (x, 0.725, -0.49), (x, 0.12, -0.49)], 0.02, "steel", seg=3, smooth=1, caps=False)


build("brick_pallet", fp)
