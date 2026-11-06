# The school desk (#366), first person: a grained top with a rounded edge and a pencil groove on bent
# steel-tube legs, a book box under it, an open exercise book and a pencil, and a chair in the room
# colour facing it: a moulded seat, a curved back, and steel legs with rubber feet.
# Run: blender -b --factory-startup -P models/student_desk.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.74, -0.2], [1.0, 0.035, 0.6], "panel", bevel=0.01, seg=2, edges="all", tex="grain")
    m.box([0, 0.759, -0.45], [0.8, 0.004, 0.02], "dark", omit=("bottom",))
    for sx in (-1, 1):
        m.sweep([(sx * 0.44, 0.0, -0.45), (sx * 0.44, 0.72, -0.45), (sx * 0.44, 0.72, 0.05), (sx * 0.44, 0.0, 0.05)], 0.03, "metal", seg=6, smooth=1, caps=False, tex="brushed")
    m.box([0, 0.62, -0.22], [0.84, 0.02, 0.5], "metal", omit=("bottom",), tex="perforated")
    m.box([0, 0.66, 0.04], [0.84, 0.1, 0.012], "metal", tex="perforated")
    # An exercise book and a pencil.
    for sx in (-1, 1):
        m.box([0.2 + sx * 0.08, 0.76, -0.22], [0.155, 0.006, 0.22], "white", r=[0, 0, sx * -3], omit=("bottom",))
    for k in range(4):
        m.box([0.12, 0.7645, -0.28 + 0.04 * k], [0.12, 0.001, 0.004], "water", omit=("bottom",))
    m.cyl([-0.15, 0.765, -0.2], 0.008, 0.17, "hazard", seg=6, r=[0, 25, 90])
    # The chair.
    m.box([0, 0.45, 0.38], [0.44, 0.04, 0.42], "accent", bevel=0.02, seg=2, edges="all")
    m.strip([(-0.22, 0.6), (-0.1, 0.585), (0.1, 0.585), (0.22, 0.6)], 0.58, 0.9, 0.025, "accent")
    for sx in (-1, 1):
        m.sweep([(sx * 0.19, 0.0, 0.2), (sx * 0.19, 0.43, 0.2), (sx * 0.19, 0.43, 0.58), (sx * 0.19, 0.0, 0.58)], 0.025, "metal", seg=6, smooth=1, caps=False, tex="brushed")
        m.sweep([(sx * 0.19, 0.43, 0.58), (sx * 0.19, 0.6, 0.6)], 0.025, "metal", seg=6, smooth=1, tex="brushed")
        for z in (0.2, 0.58):
            m.cyl([sx * 0.19, 0.01, z], 0.035, 0.02, "rubber", seg=6)


build("student_desk", fp)
