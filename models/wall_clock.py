# The wall clock (#364), first person: a turned dark case with a rounded bezel, a white face with
# twelve hour marks, a hand for the hours and one for the minutes on a centre boss.
# Run: blender -b --factory-startup -P models/wall_clock.py
import math
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.lathe([0, 0.2, -0.02], [(0.19, 0.0), (0.2, 0.01), (0.2, 0.035), (0.185, 0.045), (0.17, 0.04)], "dark", seg=20, r=[90, 0, 0], caps=False)
    m.cyl([0, 0.2, 0.017], 0.34, 0.006, "white", seg=20, r=[90, 0, 0])
    for k in range(12):
        a = k * math.tau / 12
        big = k % 3 == 0
        m.box([0.14 * math.sin(a), 0.2 + 0.14 * math.cos(a), 0.021], [0.012, 0.035 if big else 0.02, 0.003], "dark", r=[0, 0, -math.degrees(a)], omit=("back",))
    m.box([0.0, 0.245, 0.024], [0.016, 0.1, 0.003], "dark", omit=("back",))
    m.box([0.05, 0.2, 0.026], [0.12, 0.012, 0.003], "dark", r=[0, 0, 8], omit=("back",))
    m.cyl([0, 0.2, 0.027], 0.02, 0.006, "copper", seg=8, r=[90, 0, 0])


build("wall_clock", fp)
