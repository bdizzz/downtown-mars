# The dining table (#364), first person: a long panel top on tapered steel legs, a padded bench in
# the room's colour along each side on steel trestles, six plates with a cup at each, and a bowl
# in the middle. Run: blender -b --factory-startup -P models/dining_table.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.73, 0], [2.4, 0.04, 0.9], "panel", bevel=0.012, seg=2, edges="all", tex="grain")
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 1.1, 0.355, sz * 0.36], [0.05, 0.71, 0.05], "metal", taper=[0.75, 0.75], tex="brushed")
        m.box([sx * 1.1, 0.12, 0], [0.04, 0.04, 0.72], "metal", omit=("bottom",), tex="brushed")
    m.box([0, 0.67, 0], [2.1, 0.06, 0.03], "metal", omit=("top",), tex="brushed")
    # The benches: a padded seat on two trestles each.
    for sz in (-1, 1):
        m.soft([0, 0.46, sz * 0.78], [2.2, 0.07, 0.36], "accent", round=0.6, puff=0.2, cuts=1, tex="fabric")
        for sx in (-1, 1):
            m.box([sx * 0.95, 0.21, sz * 0.78], [0.05, 0.42, 0.3], "metal", taper=[1.0, 0.7], omit=("bottom",), tex="brushed")
    # Places: a plate and a cup at each, a bowl in the middle.
    for x in (-0.7, 0, 0.7):
        for sz in (-1, 1):
            m.lathe([x, 0.75, sz * 0.25], [(0.0, 0.0), (0.12, 0.012), (0.13, 0.018), (0.0, 0.006)], "white", seg=8, caps=False)
            m.lathe([x + 0.17, 0.75, sz * 0.2], [(0.025, 0.0), (0.032, 0.08), (0.0, 0.07)], "accent", seg=6, caps=False)
    m.lathe([0, 0.75, 0], [(0.0, 0.0), (0.05, 0.0), (0.1, 0.05), (0.11, 0.08), (0.0, 0.05)], "accent", seg=12, caps=False)


build("dining_table", fp)
