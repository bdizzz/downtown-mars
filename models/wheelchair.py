# The wheelchair (#366), first person: two big wheels with rubber tyres, push rims and spokes, small
# castors at the front, a frame of bent steel tube with push handles and grips, a padded seat and a
# sling back in cushion fabric, armrests, and a footplate. The wheels span the whole footprint's depth,
# so everything else tucks inside them.
# Run: blender -b --factory-startup -P models/wheelchair.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for sx in (-1, 1):
        x = sx * 0.29
        m.lathe([x, 0.3, 0], [(0.27, -0.018), (0.3, 0.0), (0.27, 0.018), (0.27, -0.018)], "rubber", seg=12, r=[0, 0, 90], caps=False)
        m.lathe([x + sx * 0.02, 0.3, 0], [(0.25, -0.006), (0.25, 0.006)], "steel", seg=12, r=[0, 0, 90], caps=False)
        for k in range(3):
            m.box([x, 0.3, 0], [0.008, 0.52, 0.008], "metal", r=[60 * k, 0, 0])
        m.cyl([x, 0.3, 0], 0.06, 0.05, "dark", seg=6, r=[0, 0, 90])
        # The castor and the frame.
        m.cyl([sx * 0.2, 0.05, 0.22], 0.1, 0.03, "rubber", seg=6, r=[0, 0, 90])
        m.box([sx * 0.2, 0.12, 0.22], [0.02, 0.1, 0.04], "metal", omit=("bottom", "top"))
        m.sweep([(sx * 0.21, 0.18, 0.22), (sx * 0.21, 0.48, 0.2), (sx * 0.21, 0.5, -0.12), (sx * 0.21, 1.0, -0.18), (sx * 0.21, 1.04, -0.25)], 0.025, "steel", seg=5, smooth=2, caps=False, tex="brushed")
        m.cyl([sx * 0.21, 1.04, -0.24], 0.034, 0.1, "rubber", seg=6, r=[90, 0, 0])
        m.sweep([(sx * 0.22, 0.5, 0.16), (sx * 0.22, 0.7, 0.14), (sx * 0.22, 0.7, -0.1), (sx * 0.22, 0.5, -0.12)], 0.02, "steel", seg=5, smooth=1, caps=False, tex="brushed")
        m.box([sx * 0.22, 0.715, 0.02], [0.05, 0.03, 0.22], "dark", bevel=0.01, edges="top", omit=("bottom",))
        m.sweep([(sx * 0.2, 0.45, 0.2), (sx * 0.16, 0.12, 0.25)], 0.02, "steel", seg=5, smooth=1, tex="brushed")
    # The seat, the back and the footplate.
    m.soft([0, 0.52, 0.04], [0.42, 0.06, 0.4], "cushion", round=0.6, puff=0.2, cuts=1, tex="fabric")
    m.soft([0, 0.78, -0.18], [0.42, 0.4, 0.04], "cushion", round=0.5, puff=0.15, cuts=1, r=[-8, 0, 0], tex="fabric")
    m.box([0, 0.11, 0.24], [0.34, 0.015, 0.1], "dark", omit=("bottom",), tex="tread")


build("wheelchair", fp)
