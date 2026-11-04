# The wall lamp (#364), first person: a rounded wall plate with two screws, a bent arm reaching out,
# a cream fabric shade, flared, and a glowing bulb under it. Run: blender -b --factory-startup -P models/wall_lamp.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.12, -0.005], [0.11, 0.22, 0.03], "metal", bevel=0.012, seg=2, edges="vertical", omit=("back",), tex="brushed")
    for y in (0.04, 0.2):
        m.cyl([0, y, 0.012], 0.014, 0.006, "dark", seg=6, r=[90, 0, 0])
    m.sweep([(0, 0.1, 0.01), (0, 0.1, 0.07), (0, 0.16, 0.13), (0, 0.27, 0.15)], 0.022, "metal", seg=6, smooth=2, tex="brushed")
    m.lathe([0, 0.12, 0.15], [(0.0, 0.0), (0.035, 0.02), (0.045, 0.06), (0.025, 0.1), (0.0, 0.105)], "lamp", seg=8, glow=True)
    m.lathe([0, 0.12, 0.15], [(0.11, 0.0), (0.11, 0.008), (0.1, 0.02), (0.07, 0.19), (0.065, 0.2)], "cream", seg=14, caps=False, tex="fabric")
    m.lathe([0, 0.12, 0.15], [(0.1, 0.02), (0.07, 0.19)], "cream", seg=14, caps=False, tex="fabric")


build("wall_lamp", fp)
