# The bench (#366), first person: a backless park bench of five grained composite slats with rounded
# tops on two bent steel-tube frames with rubber feet, its slat ends capped in the room colour.
# Run: blender -b --factory-startup -P models/bench.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for k in range(5):
        z = -0.2 + 0.1 * k
        m.box([0, 0.45, z], [1.7, 0.04, 0.085], "composite", bevel=0.01, edges="top", omit=("bottom",), tex="grain")
        for sx in (-1, 1):
            m.box([sx * 0.865, 0.45, z], [0.03, 0.04, 0.085], "accent", bevel=0.006, edges="top", omit=("bottom",))
    for sx in (-1, 1):
        x = sx * 0.68
        m.sweep([(x, 0.02, -0.22), (x, 0.38, -0.21), (x, 0.42, -0.17), (x, 0.42, 0.17), (x, 0.38, 0.21), (x, 0.02, 0.22)], 0.035, "metal", seg=6, smooth=2, caps=False, tex="brushed")
        m.cyl([x, 0.2, 0], 0.025, 0.42, "metal", seg=6, r=[90, 0, 0], tex="brushed")
        for z in (-0.22, 0.22):
            m.cyl([x, 0.012, z], 0.05, 0.024, "rubber", seg=6)
    m.cyl([0, 0.2, 0], 0.025, 1.36, "metal", seg=6, r=[0, 0, 90], tex="brushed")


build("bench", fp)
