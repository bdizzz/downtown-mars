# The barrels (#365), first person: three turned steel drums with rolling hoops and rims, one in the
# room's colour, one rust, one bare metal, their lids with two bung caps each, a hazard label on one
# and a hand pump in another. Run: blender -b --factory-startup -P models/barrel_group.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    prof = [(0.28, 0.0), (0.3, 0.03), (0.3, 0.29), (0.315, 0.31), (0.3, 0.33), (0.3, 0.59), (0.315, 0.61), (0.3, 0.63), (0.3, 0.89), (0.0, 0.88)]
    for (x, z, c) in ((-0.35, -0.3, "accent"), (0.35, -0.3, "rust"), (0.0, 0.32, "metal")):
        m.lathe([x, 0.0, z], prof, c, seg=10, tex="brushed" if c == "metal" else None)
        for dx in (-0.14, 0.12):
            m.cyl([x + dx, 0.9, z + 0.05], 0.06, 0.03, "dark", seg=6)
    m.box([0.0, 0.46, 0.62], [0.24, 0.24, 0.01], "hazard", omit=("back",))
    m.box([0.0, 0.46, 0.624], [0.12, 0.12, 0.006], "dark", r=[0, 0, 45], omit=("back",))
    m.cyl([0.23, 0.92, -0.25], 0.07, 0.06, "dark", seg=6)
    m.sweep([(0.23, 0.93, -0.22), (0.18, 0.93, -0.1), (0.1, 0.91, -0.02)], 0.025, "rubber", seg=4, smooth=2, caps=False)


build("barrel_group", fp)
