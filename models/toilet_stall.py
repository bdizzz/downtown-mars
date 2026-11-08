# The toilet stall (#367), first person: partition walls standing on steel feet under a headrail, a
# door in the room colour swung half open on its hinges, with a lever, an occupancy light and a coat
# hook; inside, a turned pan with an open seat and a raised lid, a cistern with a flush button, and
# a roll on its holder.
# Run: blender -b --factory-startup -P models/toilet_stall.py
import math
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build

FOOT = 0.14  # the walls stand this far off the floor


def fp(m):
    # The walls: two sides and a back, raised on feet, and a pilaster beside the door.
    h = 2.0 - FOOT
    for x in (-0.53, 0.53):
        m.box([x, FOOT + h / 2, -0.02], [0.03, h, 1.48], "panel", bevel=0.008, edges="vertical")
        for z in (-0.68, 0.64):
            m.cyl([x, FOOT / 2, z], 0.035, FOOT, "steel", seg=6, caps=False, tex="brushed")
    m.box([0, FOOT + h / 2, -0.745], [1.04, h, 0.03], "panel", omit=("back",))
    m.box([-0.415, FOOT + h / 2, 0.72], [0.2, h, 0.03], "panel", bevel=0.008, edges="vertical")
    m.box([0, 2.035, 0.72], [1.1, 0.05, 0.05], "steel", tex="brushed")
    # The door, hinged on the pilaster and swung 35 degrees in.
    hx, hz, w, a = -0.31, 0.72, 0.8, math.radians(35)
    cx, cz = hx + math.cos(a) * w / 2, hz - math.sin(a) * w / 2
    m.box([cx, FOOT + 0.04 + (h - 0.08) / 2, cz], [w, h - 0.08, 0.03], "accent", bevel=0.006, edges="vertical", r=[0, 35, 0])
    for y in (0.5, 1.7):
        m.cyl([hx, y, hz], 0.03, 0.12, "steel", seg=6)
    lx, lz = hx + math.cos(a) * (w - 0.08), hz - math.sin(a) * (w - 0.08)
    nx, nz = math.sin(a), math.cos(a)  # the door's outward normal
    m.cyl([lx + nx * 0.02, 1.0, lz + nz * 0.02], 0.05, 0.02, "steel", seg=8, r=[90, 0, -35])
    m.box([lx + nx * 0.035 - math.cos(a) * 0.05, 1.0, lz + nz * 0.035 + math.sin(a) * 0.05], [0.12, 0.022, 0.022], "steel", r=[0, 35, 0])
    m.box([lx + nx * 0.02, 1.1, lz + nz * 0.02], [0.05, 0.02, 0.012], "plant", glow=True, r=[0, 35, 0])
    kx, kz = hx + math.cos(a) * 0.4, hz - math.sin(a) * 0.4
    m.sweep([(kx - nx * 0.015, 1.65, kz - nz * 0.015), (kx - nx * 0.05, 1.62, kz - nz * 0.05), (kx - nx * 0.06, 1.66, kz - nz * 0.06)], 0.018, "steel", seg=4, smooth=2)
    # The pan, seat, lid and cistern.
    m.lathe([0, 0, -0.42], [(0.0, 0.0), (0.12, 0.0), (0.11, 0.12), (0.17, 0.32), (0.185, 0.38), (0.15, 0.38), (0.07, 0.28), (0.0, 0.26)], "white", seg=12)
    m.lathe([0, 0.38, -0.42], [(0.12, 0.0), (0.19, 0.0), (0.195, 0.015), (0.185, 0.03), (0.125, 0.03)], "white", seg=12, caps=False)
    m.box([0, 0.6, -0.6], [0.38, 0.42, 0.035], "white", bevel=0.015, edges="vertical", r=[-8, 0, 0])
    m.box([0, 0.62, -0.68], [0.42, 0.42, 0.1], "white", bevel=0.02, edges="upper", omit=("bottom",))
    m.cyl([0, 0.84, -0.68], 0.07, 0.012, "steel", seg=10)
    m.cyl([0, 0.2, -0.72], 0.06, 0.12, "white", seg=8, r=[90, 0, 0])
    # The roll on its holder, on the right wall.
    m.box([0.505, 0.8, -0.3], [0.03, 0.1, 0.16], "steel", tex="brushed")
    m.cyl([0.44, 0.78, -0.3], 0.11, 0.1, "white", seg=10, r=[0, 0, 90], tex="fabric")


build("toilet_stall", fp)
