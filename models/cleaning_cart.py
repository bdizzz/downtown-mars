# The cleaning cart (#367), first person: a cabinet on swivel castors with two doors and a push
# handle, a yellow mop bucket with its wringer and a mop standing in it, two spray bottles with
# triggers, a roll of paper towel on a rod and a dark bin bag hanging from the end.
# Run: blender -b --factory-startup -P models/cleaning_cart.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    # Castors: a fork and a wheel at each corner.
    for sx in (-1, 1):
        for sz in (-1, 1):
            x, z = sx * 0.36, sz * 0.18
            m.box([x, 0.11, z], [0.05, 0.05, 0.05], "dark", omit=("top",))
            m.cyl([x, 0.045, z], 0.09, 0.03, "rubber", seg=6, r=[0, 0, 90])
    # The cabinet, its doors and the tray on top.
    m.box([0, 0.47, 0], [0.84, 0.66, 0.46], "accent", bevel=0.02, edges="vertical", omit=("bottom",))
    m.box([0, 0.15, 0], [0.86, 0.04, 0.48], "dark", omit=("top",))
    for sx in (-1, 1):
        m.box([sx * 0.205, 0.47, 0.233], [0.39, 0.56, 0.008], "accent", omit=("back",))
        m.sweep([(sx * 0.04, 0.6, 0.237), (sx * 0.04, 0.6, 0.257), (sx * 0.04, 0.48, 0.257), (sx * 0.04, 0.48, 0.237)], 0.016, "steel", seg=4, smooth=1, caps=False)
    m.box([0, 0.815, 0], [0.9, 0.03, 0.5], "panel", bevel=0.01, edges="top", omit=("bottom",), tex="tread")
    # The push handle at the left end.
    m.sweep([(-0.44, 0.7, -0.19), (-0.455, 1.02, -0.19), (-0.455, 1.04, -0.15), (-0.455, 1.04, 0.15), (-0.455, 1.02, 0.19), (-0.44, 0.7, 0.19)], 0.03, "metal", seg=6, smooth=1, caps=False, tex="brushed")
    m.cyl([-0.455, 1.04, 0], 0.04, 0.22, "rubber", seg=8, r=[90, 0, 0])
    # The bucket, its wringer and the mop.
    m.lathe([0.22, 0.83, 0], [(0.0, 0.0), (0.12, 0.0), (0.15, 0.24), (0.14, 0.24), (0.115, 0.06), (0.0, 0.06)], "hazard", seg=10)
    m.cyl([0.22, 0.95, 0], 0.255, 0.005, "water", seg=10)
    m.box([0.22, 1.08, -0.06], [0.24, 0.1, 0.1], "dark")
    m.sweep([(0.1, 1.07, 0.02), (0.06, 1.12, 0.1), (0.1, 1.16, 0.18)], 0.02, "dark", seg=4, smooth=2)
    m.cyl([0.24, 1.35, 0.06], 0.028, 0.95, "fibre", seg=6, r=[0, 0, -3], tex="grain")
    m.cyl([0.265, 1.8, 0.06], 0.036, 0.09, "accent", seg=6, r=[0, 0, -3])
    m.cyl([0.22, 0.99, 0.06], 0.14, 0.1, "cream", seg=8, d2=0.06, tex="fabric")
    # Spray bottles.
    for x, c in ((-0.36, "water"), (-0.24, "plant")):
        m.lathe([x, 0.83, 0.12], [(0.0, 0.0), (0.045, 0.0), (0.045, 0.15), (0.02, 0.2), (0.0, 0.21)], c, seg=6)
        m.box([x, 1.065, 0.12], [0.03, 0.04, 0.07], "white")
        m.box([x, 1.04, 0.15], [0.015, 0.04, 0.012], "white", r=[-20, 0, 0])
    # The paper towel and the bin bag.
    m.cyl([-0.1, 0.92, -0.12], 0.014, 0.3, "steel", seg=5, r=[0, 0, 90])
    m.cyl([-0.1, 0.92, -0.12], 0.12, 0.22, "white", seg=10, r=[0, 0, 90], tex="fabric")
    m.box([0.43, 0.76, 0], [0.02, 0.04, 0.2], "steel")
    m.soft([0.45, 0.56, 0], [0.04, 0.34, 0.26], "dark", round=0.9, puff=0.1, cuts=1)


build("cleaning_cart", fp)
