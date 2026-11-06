# The cable tray (#365), first person: a ladder tray of two side rails and rungs on wall brackets,
# four cables in different colours laid along it with a little slack, held by ties.
# Run: blender -b --factory-startup -P models/cable_tray.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for z in (0.02, 0.29):
        m.box([0, 0.05, z], [1.8, 0.09, 0.015], "metal", omit=("left", "right"), tex="brushed")
    for k in range(10):
        m.box([-0.81 + 0.18 * k, 0.012, 0.155], [0.03, 0.015, 0.27], "metal", omit=("front", "back"), tex="brushed")
    for x in (-0.8, 0.0, 0.8):
        m.box([x, 0.07, 0.005], [0.05, 0.14, 0.01], "dark", omit=("back",))
        m.box([x, 0.0, 0.155], [0.04, 0.01, 0.3], "dark", omit=("front", "back"))
    for k, (c, z) in enumerate((("dark", 0.07), ("rubber", 0.13), ("hazard", 0.19), ("blueprint", 0.245))):
        sag = 0.008 * (k % 2)
        pts = [(-0.9, 0.04, z), (-0.45, 0.038 - sag, z + 0.01), (0.0, 0.04, z - 0.01), (0.45, 0.038 - sag, z + 0.01), (0.9, 0.04, z)]
        m.sweep(pts, 0.045, c, seg=5, smooth=2, caps=False)
    for x in (-0.45, 0.45):
        m.box([x, 0.04, 0.16], [0.012, 0.06, 0.25], "white", omit=("bottom",))


build("cable_tray", fp)
