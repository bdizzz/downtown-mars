# The exercise bike (#366), first person: front and back stabiliser bars on rubber feet, a frame of
# bent steel tube, a flywheel in the room colour behind a guard, a crank with pedals, a padded saddle
# on its post, and handlebars with grips round a small glowing console.
# Run: blender -b --factory-startup -P models/exercise_bike.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for z in (-0.5, 0.5):
        m.cyl([0, 0.05, z], 0.06, 0.5, "dark", seg=8, r=[0, 0, 90])
        for sx in (-1, 1):
            m.cyl([sx * 0.23, 0.015, z], 0.06, 0.03, "rubber", seg=6)
    # The frame.
    m.sweep([(0, 0.08, -0.5), (0, 0.3, -0.25), (0, 0.42, 0.05), (0, 0.5, 0.3), (0, 0.08, 0.5)], 0.06, "metal", seg=6, smooth=2, caps=False, tex="brushed")
    m.sweep([(0, 0.3, -0.25), (0, 0.85, -0.38)], 0.05, "metal", seg=6, smooth=1, tex="brushed")
    m.sweep([(0, 0.48, 0.3), (0, 1.0, 0.46)], 0.05, "metal", seg=6, smooth=1, tex="brushed")
    # The flywheel and its guard, the crank and pedals.
    m.lathe([0, 0.38, 0.3], [(0.0, -0.04), (0.23, -0.04), (0.25, -0.02), (0.25, 0.02), (0.23, 0.04), (0.0, 0.04)], "accent", seg=16, r=[0, 0, 90], caps=False)
    m.lathe([0, 0.38, 0.3], [(0.27, -0.05), (0.27, 0.05)], "dark", seg=16, r=[0, 0, 90], caps=False)
    m.cyl([0, 0.3, 0.02], 0.1, 0.1, "dark", seg=10, r=[0, 0, 90])
    for sx in (-1, 1):
        m.box([sx * 0.07, 0.3 - sx * 0.07, 0.02 + sx * 0.03], [0.02, 0.18, 0.03], "steel", r=[sx * 25, 0, 0])
        m.box([sx * 0.13, 0.3 - sx * 0.15, 0.02 + sx * 0.06], [0.1, 0.025, 0.06], "rubber", tex="tread")
    # The saddle and its post.
    m.cyl([0, 0.92, -0.39], 0.035, 0.14, "steel", seg=6, tex="brushed")
    m.soft([0, 1.0, -0.38], [0.24, 0.07, 0.3], "cushion", round=0.8, puff=0.3, cuts=1, tex="fabric")
    # The handlebars, the grips and the console.
    m.sweep([(-0.215, 1.1, 0.34), (-0.2, 1.06, 0.46), (0.0, 1.04, 0.5), (0.2, 1.06, 0.46), (0.215, 1.1, 0.34)], 0.032, "metal", seg=6, smooth=2, caps=False, tex="brushed")
    for sx in (-1, 1):
        m.cyl([sx * 0.212, 1.09, 0.38], 0.042, 0.1, "rubber", seg=6, r=[90, 0, 0])
    con = m.box([0, 1.12, 0.5], [0.16, 0.1, 0.04], "dark", r=[-30, 0, 0])
    m.inset(m.side(con, "front"), 0.015, 0.003, "glow", glow=True)


build("exercise_bike", fp)
