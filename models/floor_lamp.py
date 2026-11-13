# The floor lamp (#364), first person: a weighted, turned base, a pole with a joint collar, a cream
# fabric shade, flared and rimmed, round a glowing bulb, and a switch on a cord.
# Run: blender -b --factory-startup -P models/floor_lamp.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.lathe([0, 0, 0], [(0.17, 0.0), (0.18, 0.012), (0.16, 0.035), (0.06, 0.05), (0.025, 0.06), (0.0, 0.062)], "dark", seg=14)
    m.cyl([0, 0.8, 0], 0.025, 1.5, "metal", seg=8, caps=False, tex="brushed")
    m.lathe([0, 0.85, 0], [(0.022, 0.0), (0.03, 0.01), (0.03, 0.05), (0.022, 0.06)], "dark", seg=8, caps=False)
    # The bulb, its holder, and the shade round it.
    m.lathe([0, 1.5, 0], [(0.022, 0.0), (0.03, 0.04), (0.02, 0.06)], "dark", seg=8)
    m.lathe([0, 1.5, 0], [(0.0, 0.05), (0.04, 0.07), (0.05, 0.11), (0.03, 0.15), (0.0, 0.16)], "lamp", seg=10, glow=True)
    m.lathe([0, 1.44, 0], [(0.2, 0.0), (0.2, 0.012), (0.19, 0.03), (0.15, 0.3), (0.14, 0.31)], "cream", seg=16, caps=False, tex="fabric")
    m.lathe([0, 1.44, 0], [(0.19, 0.03), (0.15, 0.3)], "cream", seg=16, caps=False, tex="fabric")
    # The cord, and the switch on it.
    m.sweep([(0.012, 0.07, 0.0), (0.12, 0.03, 0.06), (0.18, 0.006, 0.16)], 0.008, "dark", seg=3, smooth=3)
    m.box([0.09, 0.044, 0.04], [0.025, 0.02, 0.05], "cream", bevel=0.006, r=[0, -30, 0])


build("floor_lamp", fp)
