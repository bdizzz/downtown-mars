# The weight bench (#366), first person: a padded bench in cushion fabric on a steel frame with feet,
# two uprights with J-hooks holding a barbell, its plates turned with rims and hubs, collars, and a
# knurled grip.
# Run: blender -b --factory-startup -P models/weight_bench.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def plate(m, x, d):
    m.lathe([x, 1.1, -0.45], [(0.03, -0.035), (d / 2 - 0.015, -0.035), (d / 2, 0.0), (d / 2 - 0.015, 0.035), (0.03, 0.035)], "dark", seg=10, r=[0, 0, 90], caps=False)


def fp(m):
    m.soft([0, 0.47, 0.1], [0.32, 0.08, 1.2], "cushion", round=0.6, puff=0.15, cuts=2, tex="fabric")
    m.box([0, 0.415, 0.1], [0.24, 0.03, 1.1], "dark")
    for z in (-0.4, 0.6):
        m.box([0, 0.21, z], [0.06, 0.4, 0.06], "metal", omit=("bottom",), tex="brushed")
        m.box([0, 0.02, z], [0.4, 0.04, 0.06], "metal", omit=("bottom",), tex="brushed")
        for sx in (-1, 1):
            m.cyl([sx * 0.2, 0.02, z], 0.05, 0.04, "rubber", seg=6)
    m.box([0, 0.03, -0.45], [1.2, 0.06, 0.08], "metal", omit=("bottom",), tex="brushed")
    # The uprights and J-hooks.
    for sx in (-1, 1):
        m.box([sx * 0.55, 0.62, -0.45], [0.06, 1.2, 0.06], "metal", omit=("bottom",), tex="brushed")
        m.sweep([(sx * 0.55, 1.06, -0.42), (sx * 0.55, 1.06, -0.38), (sx * 0.55, 1.12, -0.37)], 0.03, "dark", seg=4, smooth=1)
    # The barbell.
    m.cyl([0, 1.1, -0.45], 0.03, 1.1, "steel", seg=8, r=[0, 0, 90], tex="tread")
    for sx in (-1, 1):
        m.cyl([sx * 0.7, 1.1, -0.45], 0.05, 0.36, "steel", seg=8, r=[0, 0, 90], tex="brushed")
        plate(m, sx * 0.66, 0.42)
        plate(m, sx * 0.735, 0.3)
        m.cyl([sx * 0.79, 1.1, -0.45], 0.07, 0.03, "accent", seg=8, r=[0, 0, 90])


build("weight_bench", fp)
