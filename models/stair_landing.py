# The stair well (#367), first person: the guard round the opening a flight comes up through. A brushed
# steel top rail with rounded corners and a mid rail on round posts with foot plates along both sides
# and the far end, hazard kick plates at their foot, and a hazard nosing where the flight arrives.
# Run: blender -b --factory-startup -P models/stair_landing.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build

X, Z0, Z1 = 1.37, -3.15, 3.17  # the guard's sides, the arrival end and the far end


def u(y, r=0.12):
    """The guard's U at height y: up one side, across the far end with rounded corners, down the other."""
    return [(-X, y, Z0), (-X, y, Z1 - r), (-X + r * 0.3, y, Z1 - r * 0.3), (-X + r, y, Z1), (X - r, y, Z1), (X - r * 0.3, y, Z1 - r * 0.3), (X, y, Z1 - r), (X, y, Z0)]


def fp(m):
    m.sweep(u(1.0), 0.05, "steel", seg=6, smooth=1, tex="brushed")
    m.sweep(u(0.5), 0.03, "steel", seg=5, smooth=1)
    posts = [(-X, z) for z in (Z0, -1.6, 0.0, 1.6)] + [(X, z) for z in (Z0, -1.6, 0.0, 1.6)] + [(-X + 0.12, Z1 - 0.05), (X - 0.12, Z1 - 0.05), (0.0, Z1)]
    for x, z in posts:
        m.cyl([x, 0.5, z], 0.045, 0.98, "steel", seg=6, caps=False, tex="brushed")
        m.box([x, 0.006, z], [0.09, 0.012, 0.09], "dark", omit=("bottom",))
    # Kick plates and the nosing.
    for x in (-X, X):
        m.box([x, 0.06, (Z0 + Z1 - 0.1) / 2], [0.02, 0.1, Z1 - Z0 - 0.15], "hazard", omit=("bottom",), tex="tread")
    m.box([0, 0.06, Z1], [2.6, 0.1, 0.02], "hazard", omit=("bottom",), tex="tread")
    m.box([0, 0.012, Z0 - 0.01], [2.7, 0.024, 0.08], "hazard", omit=("bottom",), tex="tread")
    for k in range(9):
        m.box([-1.2 + 0.3 * k, 0.025, Z0 - 0.01], [0.12, 0.003, 0.08], "dark", omit=("bottom",), r=[0, 30, 0])


build("stair_landing", fp)
