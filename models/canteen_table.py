# The canteen table (#366), first person: a long grained top with a rounded edge on tapered steel
# legs joined by a rail, padded benches in the room colour on both sides on their own trestles, three
# trays laid with a plate of food, a bowl and a spoon, and salt and pepper in the middle.
# Run: blender -b --factory-startup -P models/canteen_table.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.73, 0], [2.6, 0.04, 0.9], "panel", bevel=0.012, seg=2, tex="grain")
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 1.2, 0.355, sz * 0.36], [0.05, 0.71, 0.05], "metal", taper=[0.75, 0.75], omit=("top",), tex="brushed")
        m.box([sx * 1.2, 0.12, 0], [0.04, 0.04, 0.68], "metal", tex="brushed")
    m.cyl([0, 0.12, 0], 0.04, 2.36, "metal", seg=6, r=[0, 0, 90], tex="brushed")
    # The benches.
    for sz in (-1, 1):
        m.soft([0, 0.45, sz * 0.75], [2.4, 0.07, 0.34], "accent", round=0.6, puff=0.2, cuts=1, omit=("bottom",), tex="fabric")
        m.box([0, 0.405, sz * 0.75], [2.36, 0.02, 0.3], "dark", omit=("top",))
        for x in (-1.05, 1.05):
            m.box([x, 0.2, sz * 0.75], [0.05, 0.4, 0.06], "metal", omit=("top", "bottom"), tex="brushed")
            m.box([x, 0.02, sz * 0.75], [0.07, 0.04, 0.3], "metal", omit=("bottom",), tex="brushed")
    # Three trays, each with a plate of food, a bowl and a spoon (the table's footprint is 0.8 m
    # tall, so nothing on it stands more than 5 cm), and salt and pepper.
    for x, z, c in ((-0.75, 0.2, "rust"), (0.15, -0.2, "leaf"), (0.85, 0.2, "cream")):
        m.box([x, 0.757, z], [0.42, 0.014, 0.3], "white", omit=("bottom",))
        m.lathe([x - 0.05, 0.764, z], [(0.08, 0.0), (0.11, 0.018), (0.1, 0.018), (0.0, 0.006)], "cream", seg=8, caps=False)
        m.cyl([x - 0.05, 0.774, z], 0.13, 0.01, c, seg=6)
        m.lathe([x + 0.13, 0.764, z - 0.06], [(0.025, 0.0), (0.045, 0.03), (0.04, 0.03), (0.0, 0.006)], "accent", seg=6, caps=False)
        m.box([x + 0.14, 0.766, z + 0.07], [0.012, 0.004, 0.14], "steel", omit=("bottom",))
    for dx, c in ((-0.03, "white"), (0.03, "dark")):
        m.lathe([-0.3 + dx, 0.75, -0.05], [(0.018, 0.0), (0.02, 0.035), (0.012, 0.045), (0.0, 0.048)], c, seg=6, caps=False)


build("canteen_table", fp)
