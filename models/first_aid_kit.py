# The first-aid box (#365), first person: a white case with softened edges hung on the wall, a red
# cross on its lid, a hinge down its side, a steel latch, a carry handle on top and a label.
# Run: blender -b --factory-startup -P models/first_aid_kit.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.19, 0.04], [0.4, 0.36, 0.08], "white", bevel=0.02, seg=2, edges="all")
    m.box([0, 0.19, 0.1], [0.38, 0.34, 0.04], "white", bevel=0.015, seg=2, edges="all")
    m.box([0, 0.19, 0.082], [0.4, 0.008, 0.004], "metal", omit=("back",))
    m.box([0, 0.2, 0.121], [0.18, 0.05, 0.006], "red", omit=("back",))
    m.box([0, 0.2, 0.121], [0.05, 0.18, 0.006], "red", omit=("back",))
    m.cyl([-0.185, 0.19, 0.08], 0.025, 0.3, "metal", seg=6)
    m.box([0.18, 0.19, 0.1], [0.03, 0.08, 0.05], "steel", bevel=0.005, edges="all", tex="brushed")
    m.sweep([(-0.08, 0.37, 0.07), (-0.07, 0.395, 0.07), (0.07, 0.395, 0.07), (0.08, 0.37, 0.07)], 0.02, "dark", seg=5, smooth=2, caps=False)
    m.box([0, 0.05, 0.121], [0.2, 0.04, 0.004], "cream", omit=("back",))


build("first_aid_kit", fp)
