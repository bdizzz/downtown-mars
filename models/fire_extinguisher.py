# The fire extinguisher (#365), first person: a turned red cylinder with a domed top on a dark wall
# bracket with straps, its valve head and lever, a pressure gauge, a black hose curling down to the
# nozzle in a clip, and a red sign above with a white symbol.
# Run: blender -b --factory-startup -P models/fire_extinguisher.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.3, 0.008], [0.12, 0.26, 0.016], "dark", omit=("back",))
    m.lathe([0, 0.03, 0.1], [(0.0, 0.0), (0.07, 0.0), (0.078, 0.02), (0.078, 0.44), (0.065, 0.5), (0.03, 0.53), (0.022, 0.53)], "red", seg=12)
    m.lathe([0, 0.06, 0.1], [(0.081, 0.0), (0.081, 0.025)], "dark", seg=12, caps=False)
    m.lathe([0, 0.33, 0.1], [(0.081, 0.0), (0.081, 0.03)], "dark", seg=12, caps=False)
    # The valve head, lever and gauge.
    m.cyl([0, 0.58, 0.1], 0.045, 0.06, "dark", seg=8)
    m.box([0.04, 0.62, 0.1], [0.14, 0.02, 0.035], "steel", r=[0, 0, -8], tex="brushed")
    m.box([0.03, 0.6, 0.1], [0.12, 0.015, 0.03], "steel", r=[0, 0, 6], tex="brushed")
    m.cyl([-0.035, 0.6, 0.13], 0.035, 0.015, "white", seg=8, r=[90, 0, 0])
    # The hose, down the side to a nozzle in a clip.
    m.sweep([(-0.03, 0.56, 0.12), (-0.08, 0.55, 0.15), (-0.095, 0.45, 0.17), (-0.08, 0.28, 0.17), (-0.07, 0.2, 0.17)], 0.022, "rubber", seg=5, smooth=2, caps=False)
    m.cyl([-0.07, 0.17, 0.17], 0.03, 0.07, "dark", seg=6, d2=0.02)
    m.box([-0.07, 0.25, 0.165], [0.04, 0.02, 0.03], "steel")
    # A sign above it.
    m.box([0, 0.78, 0.005], [0.22, 0.14, 0.01], "red", omit=("back",))
    m.box([-0.04, 0.78, 0.011], [0.04, 0.08, 0.003], "white", omit=("back",))
    m.box([0.03, 0.8, 0.011], [0.06, 0.02, 0.003], "white", omit=("back",))
    m.box([0.05, 0.76, 0.011], [0.02, 0.05, 0.003], "white", r=[0, 0, -30], omit=("back",))


build("fire_extinguisher", fp)
