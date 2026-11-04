# The wall textile (#364), first person: a woven hanging on a fibre-composite rod with turned ends,
# hung from two cords, in folds, banded in the room's colour, hazard yellow, cream and rust, a
# diamond woven into its middle, and a row of tassels at its foot.
# Run: blender -b --factory-startup -P models/wall_textile.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.cyl([0, 1.18, 0.03], 0.035, 0.76, "fibre", seg=8, r=[0, 0, 90], tex="grain")
    for sx in (-1, 1):
        m.lathe([sx * 0.38, 1.18, 0.03], [(0.0, 0.0), (0.03, 0.01), (0.025, 0.035), (0.0, 0.04)], "dark", seg=8, r=[0, 0, -90 * sx])
        m.sweep([(sx * 0.3, 1.2, 0.03), (sx * 0.15, 1.24, 0.0), (0, 1.25, -0.01)], 0.006, "dark", seg=3, smooth=2)
    # The cloth in folds, and its bands.
    folds = [(-0.35 + i * 0.1, 0.03 + (0.008 if i % 2 else -0.004)) for i in range(8)]
    m.strip(folds, 0.12, 1.17, 0.012, "cushion", tex="fabric")
    for y, c in ((0.98, "accent"), (0.82, "hazard"), (0.5, "rust"), (0.34, "accent")):
        m.strip([(x, z + 0.008) for x, z in folds], y - 0.04, y + 0.04, 0.004, c, tex="fabric")
    m.box([0, 0.66, 0.05], [0.16, 0.16, 0.006], "power", r=[0, 0, 45], omit=("back",), tex="fabric")
    m.box([0, 0.66, 0.054], [0.08, 0.08, 0.006], "cream", r=[0, 0, 45], omit=("back",), tex="fabric")
    # Tassels.
    for k in range(6):
        x = -0.3 + k * 0.12
        m.lathe([x, 0.0, 0.03], [(0.0, 0.0), (0.016, 0.02), (0.012, 0.1), (0.006, 0.12)], "cushion", seg=5, tex="fabric")


build("wall_textile", fp)
