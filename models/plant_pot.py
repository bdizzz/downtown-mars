# The plant pot (#364), first person: a tapered pot with a rolled rim in the room's colour, dark
# soil, a rust-red cane, and a leafy plant: long leaves arching out from the crown in tiers, the
# lower ones drooping, the top ones upright. Run: blender -b --factory-startup -P models/plant_pot.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.lathe([0, 0, 0], [(0.18, 0.0), (0.2, 0.02), (0.25, 0.44), (0.25, 0.46), (0.0, 0.46)], "panel", seg=12, tex="grain")
    m.lathe([0, 0, 0], [(0.25, 0.44), (0.275, 0.45), (0.275, 0.49), (0.255, 0.5), (0.23, 0.48)], "accent", seg=12, caps=False)
    m.lathe([0, 0, 0], [(0.0, 0.47), (0.23, 0.47)], "soil", seg=12, caps=False)
    m.cyl([0.05, 0.75, 0.02], 0.016, 0.56, "rust", seg=5)
    # Stems from the crown, then the leaves in three tiers.
    for k in range(3):
        m.blade([0, 0.47, 0], k * 120, 80, 0.5, 0.025, "plant", seg=2, roll=90)
    for tier, (y, n, pitch, length, droop) in enumerate(((0.62, 9, 15, 0.31, 0.14), (0.82, 8, 35, 0.3, 0.09), (1.0, 7, 55, 0.3, 0.05), (1.18, 5, 75, 0.26, 0.02))):
        for k in range(n):
            yaw = k * 360 / n + tier * 20
            m.blade([0, y, 0], yaw, pitch, length, 0.16, "leaf" if (k + tier) % 2 else "plant", droop=droop, roll=8 * (k % 3 - 1), seg=2)


build("plant_pot", fp)
