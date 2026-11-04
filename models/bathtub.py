# The bathtub (#364), first person: a white tub with a rolled rim and a deep basin, water in it,
# a mixer tap and spout at the head, a plug chain, and a cream towel folded over the side.
# Run: blender -b --factory-startup -P models/bathtub.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    tub = m.box([0, 0.3, 0], [1.7, 0.6, 0.8], "white", omit=("bottom",))
    m.box([0, 0.03, 0], [1.6, 0.06, 0.72], "white", omit=("bottom",))
    m.inset(m.side(tub, "top"), 0.08, 0.0)
    basin = m.side(tub, "top")
    m.inset(basin, 0.05, 0.36)
    m.box([0, 0.48, 0], [1.42, 0.01, 0.56], "water", bevel=0.004, omit=("bottom",))
    m.sweep([(-0.83, 0.6, -0.38), (-0.83, 0.6, 0.38), (0.83, 0.6, 0.38), (0.83, 0.6, -0.38), (-0.83, 0.6, -0.38)], 0.05, "white", seg=6, smooth=1)
    # The tap: a mixer, a spout over the water and a chain to the plug.
    m.cyl([-0.78, 0.66, 0], 0.05, 0.12, "steel", seg=8, tex="brushed")
    m.sweep([(-0.78, 0.7, 0), (-0.78, 0.74, 0), (-0.68, 0.74, 0), (-0.64, 0.7, 0)], 0.03, "steel", seg=6, smooth=2, tex="brushed")
    for z in (-0.08, 0.08):
        m.lathe([-0.78, 0.6, z], [(0.02, 0.0), (0.02, 0.08), (0.04, 0.09), (0.04, 0.11), (0.0, 0.11)], "steel", seg=6, tex="brushed")
    m.sweep([(-0.72, 0.62, 0.0), (-0.7, 0.5, 0.0), (-0.62, 0.485, 0.0)], 0.006, "steel", seg=3, smooth=2)
    # A towel folded over the side, hanging down the front.
    m.soft([0.5, 0.635, 0.3], [0.32, 0.03, 0.22], "cream", round=0.8, puff=0.2, cuts=1, tex="fabric")
    m.soft([0.5, 0.5, 0.425], [0.32, 0.28, 0.025], "cream", round=0.8, puff=0.0, cuts=1, tex="fabric")


build("bathtub", fp)
