# The seedling bench (#365), first person: a brushed steel table on square legs, four seedling trays
# with rows of sprouting cotyledons, a perforated shelf underneath with two soft sacks of soil, a
# watering can and a hand trowel. Run: blender -b --factory-startup -P models/seed_table.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 0.94, 0.405, sz * 0.36], [0.04, 0.81, 0.04], "metal", omit=("bottom", "top"), tex="brushed")
    m.box([0, 0.83, 0], [2.0, 0.04, 0.8], "steel", bevel=0.008, edges="upper", tex="brushed")
    m.box([0, 0.3, 0], [1.92, 0.025, 0.76], "metal", omit=("left", "right"), tex="perforated")
    # Four trays of seedlings, each a recessed tray with rows of sprouts.
    for tx in (-0.7, -0.23, 0.23, 0.7):
        tray = m.box([tx, 0.885, 0], [0.4, 0.07, 0.6], "dark", omit=("bottom",))
        m.inset(m.side(tray, "top"), 0.015, 0.03, "soil")
        for k in range(4):
            sx, sz = tx + (-0.1 if k % 2 else 0.1), -0.18 + 0.12 * k
            for a in (0, 180):
                m.blade([sx, 0.89, sz], a + 25 * k + tx * 40, 35, 0.06, 0.045, "leaf", droop=0.01, seg=1)
    # Under the bench: sacks of soil, a watering can, a trowel.
    for x, r in ((-0.55, 4), (0.05, -3)):
        m.soft([x, 0.42, 0.0], [0.5, 0.2, 0.42], "composite", round=0.6, puff=0.25, cuts=1, r=[0, r, 0], tex="fabric")
        m.box([x, 0.53, 0.0], [0.5, 0.012, 0.06], "soil", r=[0, r, 0], omit=("bottom",))
    m.lathe([0.6, 0.313, 0.05], [(0.1, 0), (0.11, 0.12), (0.08, 0.2), (0.0, 0.21)], "accent", seg=8)
    m.sweep([(0.68, 0.38, 0.05), (0.78, 0.46, 0.05), (0.86, 0.5, 0.05)], 0.025, "accent", seg=5, smooth=1)
    m.sweep([(0.55, 0.47, 0.05), (0.6, 0.56, 0.05), (0.68, 0.5, 0.05)], 0.02, "dark", seg=4, smooth=2, caps=False)
    m.box([-0.15, 0.32, 0.25], [0.18, 0.012, 0.07], "steel", r=[0, 20, 0], tex="brushed")
    m.cyl([-0.3, 0.33, 0.3], 0.03, 0.12, "fibre", seg=6, r=[90, -70, 0])


build("seed_table", fp)
