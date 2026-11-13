# The bin (#365), first person: a turned dark bin with a band in green, a rim in the room's colour, a
# domed swing lid with a dark opening, and a bag's edge folded over the lip.
# Run: blender -b --factory-startup -P models/trash_bin.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.lathe([0, 0.0, 0], [(0.22, 0.0), (0.24, 0.02), (0.25, 0.7), (0.25, 0.72)], "dark", seg=12, tex="brushed")
    m.lathe([0, 0.33, 0], [(0.255, 0.0), (0.255, 0.07)], "leaf", seg=12, caps=False)
    m.lathe([0, 0.72, 0], [(0.27, 0.0), (0.27, 0.04), (0.24, 0.05)], "accent", seg=12, caps=False)
    m.lathe([0, 0.68, 0], [(0.258, 0.0), (0.258, 0.05)], "rubber", seg=12, caps=False)
    m.lathe([0, 0.76, 0], [(0.24, 0.0), (0.2, 0.05), (0.12, 0.085), (0.0, 0.09)], "accent", seg=12)
    m.box([0, 0.79, 0.17], [0.22, 0.06, 0.06], "rubber", r=[-30, 0, 0], omit=("back",))
    for x in (-0.12, 0.12):
        m.cyl([x, 0.36, 0.25], 0.04, 0.02, "steel", seg=6, r=[90, 0, 0])


build("trash_bin", fp)
