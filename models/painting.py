# The painting (#364), first person: a moulded fibre-composite frame round a cream mat, and in it a
# little Mars landscape in relief: a glowing sky, rust hills in layers, a composite dome of the
# colony at their foot and a pale sun. Run: blender -b --factory-startup -P models/painting.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    frame = m.box([0, 0.35, 0], [0.9, 0.7, 0.04], "fibre", omit=("back",), tex="grain")
    m.inset(m.side(frame, "front"), 0.05, 0.012)
    m.box([0, 0.35, 0.012], [0.78, 0.58, 0.004], "cream", omit=("back",))
    m.box([0, 0.47, 0.016], [0.7, 0.26, 0.004], "glow", omit=("back",))
    # Hills in layers, the farthest highest.
    m.strip([(-0.35, 0.02), (-0.15, 0.02), (0.05, 0.02), (0.35, 0.02)], 0.2, 0.36, 0.004, "rust")
    m.box([-0.12, 0.27, 0.024], [0.46, 0.18, 0.004], "rust", r=[0, 0, 6], omit=("back",))
    m.box([0.18, 0.21, 0.026], [0.34, 0.1, 0.004], "composite", r=[0, 0, -4], omit=("back",))
    # The colony's dome, and the sun.
    m.lathe([0.2, 0.24, 0.028], [(0.07, 0.0), (0.06, 0.018), (0.03, 0.03), (0.0, 0.033)], "white", seg=8, r=[90, 0, 0])
    m.cyl([0.22, 0.52, 0.02], 0.08, 0.006, "power", seg=10, r=[90, 0, 0])


build("painting", fp)
