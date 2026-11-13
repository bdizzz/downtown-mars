# The ore bin (#365), first person: an open bin of tread-plate steel with a low front lip and corner
# posts, heaped with lumps of rust-red ore and grey stone, and a shovel leaning in it.
# Run: blender -b --factory-startup -P models/ore_bin.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def _rock(m, x, y, z, s, c, k):
    """A lump of rock: a five-sided lathe, squat and turned by a fixed hash."""
    h = math.sin(k * 12.9898) * 43758.5453
    j = (h - math.floor(h)) * 2 - 1
    m.lathe([x, y, z], [(0.0, 0.0), (s * 0.5, s * 0.08), (s * 0.42, s * 0.42), (0.0, s * (0.55 + 0.12 * j))], c, seg=5, r=[12 * j, 70 * j, 9 * j])


def fp(m):
    m.box([0, 0.5, -0.6], [1.6, 1.0, 0.1], "metal", omit=("bottom",), tex="tread")
    for x in (-0.75, 0.75):
        m.box([x, 0.5, 0], [0.1, 1.0, 1.3], "metal", omit=("bottom",), tex="tread")
    m.box([0, 0.3, 0.6], [1.4, 0.6, 0.1], "metal", omit=("bottom",), tex="tread")
    m.box([0, 0.05, 0], [1.4, 0.1, 1.1], "dark", omit=("bottom",))
    for x in (-0.75, 0.75):
        m.box([x, 0.5, 0.61], [0.1, 1.0, 0.06], "hazard", omit=("bottom",))
    m.lathe([0, 0.1, -0.05], [(0.6, 0.0), (0.55, 0.3), (0.3, 0.48), (0.0, 0.52)], "rust", seg=8)
    k = 0
    for (x, y, z, s, c) in ((-0.45, 0.35, 0.2, 0.3, "rust"), (-0.15, 0.4, 0.3, 0.26, "stone"), (0.2, 0.36, 0.28, 0.32, "rust"),
            (0.5, 0.3, 0.2, 0.28, "rust"), (-0.5, 0.45, -0.3, 0.32, "stone"), (0.0, 0.55, -0.15, 0.34, "rust"),
            (0.4, 0.5, -0.3, 0.3, "stone"), (-0.25, 0.6, 0.0, 0.28, "rust"), (0.25, 0.62, 0.0, 0.26, "rust"),
            (-0.05, 0.68, 0.15, 0.24, "stone"), (0.55, 0.4, -0.05, 0.22, "rust"), (-0.55, 0.38, 0.0, 0.24, "rust"),
            (0.1, 0.22, 0.45, 0.2, "stone"), (-0.3, 0.22, 0.45, 0.18, "rust"), (0.35, 0.72, -0.35, 0.22, "rust")):
        _rock(m, x, y, z, s, c, k)
        k += 1
    m.sweep([(0.5, 0.45, -0.1), (0.6, 0.78, 0.0), (0.66, 0.96, 0.05)], 0.035, "fibre", seg=5, smooth=1, tex="grain")
    m.box([0.45, 0.38, -0.12], [0.22, 0.02, 0.26], "steel", r=[0, 20, 60], tex="brushed")


build("ore_bin", fp)
