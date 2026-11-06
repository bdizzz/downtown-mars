# The 3D printer (#365), first person: a dark cabinet with a glowing screen and a vented front, a
# steel frame of posts, a build plate with a part half printed in the room's colour, a gantry rail
# with the hazard-yellow print head, a filament spool on top feeding it, and a cable chain.
# Run: blender -b --factory-startup -P models/printer_3d.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    cab = m.box([0, 0.4, 0], [1.0, 0.8, 0.9], "dark", omit=("bottom",), tex="brushed")
    m.inset(m.split(m.side(cab, "front")[0], 2, "right"), 0.04, 0.01)
    m.box([-0.22, 0.6, 0.452], [0.32, 0.18, 0.01], "glow", glow=True, omit=("back",))
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 0.46, 1.2, sz * 0.42], [0.04, 0.8, 0.04], "metal", omit=("bottom",), tex="brushed")
    m.box([0, 1.62, 0], [1.0, 0.04, 0.9], "metal", omit=(), tex="brushed")
    m.box([0, 0.86, 0], [0.8, 0.03, 0.7], "steel", omit=("bottom",), tex="brushed")
    m.lathe([0.1, 0.875, 0.05], [(0.14, 0.0), (0.12, 0.08), (0.13, 0.14), (0.1, 0.16), (0.05, 0.16)], "accent", seg=10, caps=True)
    m.box([0, 1.4, 0], [0.9, 0.04, 0.06], "metal", tex="brushed")
    for z in (-0.4, 0.4):
        m.box([0, 1.4, z], [0.92, 0.05, 0.05], "dark")
    head = m.box([0.1, 1.33, 0], [0.12, 0.12, 0.12], "hazard", bevel=0.01, edges="all")
    m.cyl([0.1, 1.24, 0], 0.03, 0.06, "steel", seg=5, d2=0.01)
    m.cyl([0.06, 1.33, 0.065], 0.06, 0.012, "dark", seg=6, r=[90, 0, 0])
    m.lathe([-0.25, 1.64, -0.1], [(0.08, 0.0), (0.2, 0.0), (0.2, 0.01), (0.12, 0.02), (0.12, 0.07), (0.2, 0.08), (0.2, 0.09), (0.08, 0.09)], "white", seg=10)
    m.cyl([-0.25, 1.685, -0.1], 0.24, 0.05, "accent", seg=10, caps=False)
    m.sweep([(-0.25, 1.66, 0.02), (-0.1, 1.55, 0.04), (0.1, 1.42, 0.0)], 0.01, "accent", seg=3, smooth=2, caps=False)
    m.sweep([(-0.45, 1.2, -0.35), (-0.3, 1.38, -0.3), (0.0, 1.42, -0.1), (0.08, 1.38, 0.0)], 0.04, "rubber", seg=4, smooth=2, caps=False)


build("printer_3d", fp)
