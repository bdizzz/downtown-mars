# The radiator bank (#551), first person: two rows of finned steel panels on dark feet, with copper
# headers along the top and bottom of each row, a hazard-yellow bleed valve and a small gauge.
# Run: blender -b --factory-startup -P models/radiator_panel.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for x in (-0.6, 0.6):
        m.box([x, 0.08, 0], [0.08, 0.16, 0.8], "dark", omit=("bottom",))
    for z in (-0.2, 0.2):
        for x in (-0.66, -0.44, -0.22, 0, 0.22, 0.44, 0.66):
            m.box([x, 0.85, z], [0.12, 1.3, 0.3], "steel", omit=("bottom",), tex="brushed")
        for y in (1.58, 0.24):
            m.cyl([0, y, z], 0.09, 1.55, "copper", seg=8, r=[0, 0, 90])
            for sx in (-1, 1):
                m.cyl([sx * 0.755, y, z], 0.11, 0.04, "metal", seg=8, r=[0, 0, 90])
    m.cyl([0.62, 1.58, 0.33], 0.07, 0.06, "hazard", seg=6, r=[90, 0, 0])
    m.cyl([-0.62, 1.4, 0.33], 0.08, 0.03, "metal", seg=10, r=[90, 0, 0])
    m.box([-0.62, 1.4, 0.35], [0.1, 0.1, 0.004], "white", r=[0, 0, 45], omit=("back",))


build("radiator_panel", fp)
