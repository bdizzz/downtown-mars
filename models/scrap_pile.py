# The scrap pile (#365), first person: a dark pallet heaped with scrap: bent sheets of rust and metal,
# a length of copper pipe with an elbow, a toothed gear, a wheel rim, a coil spring and steel rods.
# Run: blender -b --factory-startup -P models/scrap_pile.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.05, 0], [1.8, 0.1, 1.4], "dark", omit=("bottom",), tex="tread")
    m.box([-0.3, 0.3, 0], [0.9, 0.04, 0.8], "rust", r=[0, 20, 14], tex="tread")
    m.box([0.4, 0.25, 0.2], [0.7, 0.03, 0.6], "metal", r=[0, -30, -10], tex="brushed")
    m.box([-0.1, 0.2, -0.4], [0.8, 0.03, 0.4], "metal", r=[-12, 10, 6], tex="brushed")
    m.sweep([(-0.7, 0.2, 0.5), (0.1, 0.42, 0.1), (0.5, 0.5, -0.3), (0.55, 0.65, -0.45)], 0.12, "copper", seg=8, smooth=1, caps=False, tex="brushed")
    gear = m.cyl([0.45, 0.52, 0.35], 0.36, 0.06, "steel", seg=12, r=[70, 0, 20], tex="brushed")
    for a in range(0, 360, 30):
        r = math.radians(a)
        m.box([0.45 + 0.2 * math.cos(r) * math.cos(math.radians(20)), 0.52 + 0.2 * math.sin(r) * 0.34, 0.35 + 0.2 * math.sin(r) * 0.94], [0.06, 0.05, 0.06], "steel", r=[70, -a, 20])
    m.lathe([-0.55, 0.42, -0.25], [(0.22, 0.0), (0.25, 0.02), (0.25, 0.12), (0.22, 0.14), (0.18, 0.12), (0.18, 0.02)], "dark", seg=12, caps=False, r=[60, 20, 0])
    pts = [(-0.3 + 0.08 * math.cos(t / 6 * math.tau), 0.5 + 0.08 * math.sin(t / 6 * math.tau), 0.15 + 0.03 * t) for t in range(13)]
    m.sweep(pts, 0.02, "steel", seg=3, smooth=1, caps=False)
    for k in range(3):
        m.cyl([0.1, 0.62 + 0.03 * k, -0.05 + 0.06 * k], 0.025, 1.2, "steel", seg=4, caps=False, r=[0, 30 - 15 * k, 82])


build("scrap_pile", fp)
