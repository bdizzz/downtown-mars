# The elevator, car waiting (#367), first person: the shaft with the car standing at the landing, its
# panel walls, brushed steel doors with a seam and a glowing floor indicator over them, a roof in the
# room colour with the crosshead, a pulley and the hoist cables rising from it.
# Run: blender -b --factory-startup -P models/elevator_car.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build
from _shaft import shaft


def fp(m):
    shaft(m, cables=False)
    m.box([0, 1.36, -0.05], [2.0, 2.6, 2.0], "panel", bevel=0.03, edges="vertical", omit=("bottom",))
    for x in (-0.48, 0.48):
        m.box([x, 1.2, 0.955], [0.94, 2.2, 0.02], "steel", omit=("back",), tex="brushed")
    m.box([0, 1.2, 0.967], [0.02, 2.2, 0.005], "dark", omit=("back",))
    m.box([0, 0.08, 0.965], [1.96, 0.04, 0.02], "dark", omit=("back",))
    m.box([0, 2.45, 0.955], [1.96, 0.1, 0.02], "steel", omit=("back",), tex="brushed")
    m.box([0, 2.52, 0.965], [0.6, 0.1, 0.01], "dark", omit=("back",))
    m.box([0, 2.52, 0.971], [0.5, 0.06, 0.004], "glow", glow=True, omit=("back",))
    for x in (-0.12, 0.12):
        m.box([x, 2.52, 0.974], [0.03, 0.04, 0.004], "power", glow=True, omit=("back",))
    # The roof, crosshead and pulley.
    m.box([0, 2.7, -0.05], [2.04, 0.1, 2.04], "accent", omit=("bottom",))
    m.box([0, 2.85, -0.05], [2.0, 0.2, 0.16], "metal", tex="brushed")
    for x in (-0.95, 0.95):
        m.box([x, 2.4, -0.05], [0.1, 0.8, 0.16], "metal", tex="brushed")
    m.lathe([0, 3.0, -0.05], [(0.0, 0.0), (0.25, 0.0), (0.25, 0.03), (0.22, 0.05), (0.25, 0.07), (0.25, 0.1), (0.0, 0.1)], "dark", seg=12, r=[90, 0, 0])
    m.cyl([0, 3.2, -0.05], 0.05, 0.12, "steel", seg=6, r=[90, 0, 0])
    for x in (-0.12, 0.0, 0.12):
        m.cyl([x, 3.6, -0.06], 0.02, 0.76, "dark", seg=4, caps=False)


build("elevator_car", fp)
