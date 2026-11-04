# The footlocker (#364), first person: a trunk in the room's colour with a domed lid, dark corner
# straps and edge bands, a hasp and a rope handle at each end. Run: blender -b --factory-startup -P models/footlocker.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.18, 0], [0.88, 0.34, 0.48], "accent", bevel=0.015, edges="vertical", omit=("bottom",), tex="grain")
    # The lid: a band round its edge and a gentle dome.
    m.box([0, 0.37, 0], [0.9, 0.05, 0.5], "dark", bevel=0.01, edges="all", omit=("bottom",))
    m.soft([0, 0.41, 0], [0.86, 0.04, 0.46], "accent", round=0.5, puff=0.5, cuts=1, omit=("bottom",), tex="grain")
    # Straps round the trunk, and a band along its foot.
    for x in (-0.3, 0.3):
        m.box([x, 0.2, 0], [0.06, 0.4, 0.5], "dark", omit=("bottom",), tex="tread")
    m.box([0, 0.03, 0], [0.9, 0.05, 0.5], "dark", omit=("bottom",))
    # The hasp, and rope handles hanging at the ends.
    m.box([0, 0.33, 0.25], [0.08, 0.1, 0.015], "steel", bevel=0.004, omit=("back",), tex="brushed")
    m.box([0, 0.27, 0.252], [0.04, 0.04, 0.02], "copper", omit=("back",))
    for sx in (-1, 1):
        x = sx * 0.43
        m.sweep([(x, 0.26, -0.08), (x + sx * 0.018, 0.2, -0.06), (x + sx * 0.022, 0.18, 0), (x + sx * 0.018, 0.2, 0.06), (x, 0.26, 0.08)], 0.02, "cream", seg=5, smooth=2, caps=False, tex="fabric")


build("footlocker", fp)
