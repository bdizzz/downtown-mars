# The medical bed (#366), first person: a steel frame on four legs with castors, a soft white mattress
# with its back section raised, a cream blanket turned down, a pillow, side rails of steel tube in
# the room colour, a head and foot board, and a clipboard hanging on the foot.
# Run: blender -b --factory-startup -P models/medical_bed.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.cyl([sx * 0.95, 0.32, sz * 0.4], 0.04, 0.5, "steel", seg=6, tex="brushed")
            m.box([sx * 0.95, 0.06, sz * 0.4], [0.04, 0.03, 0.06], "dark")
            m.cyl([sx * 0.95, 0.03, sz * 0.4], 0.06, 0.025, "rubber", seg=6, r=[90, 0, 0])
    m.box([0, 0.6, 0], [2.04, 0.08, 0.9], "steel", omit=("bottom",), tex="brushed")
    m.box([0, 0.3, 0], [1.9, 0.03, 0.06], "metal", tex="brushed")
    # The mattress, its raised back, the blanket and the pillow.
    m.soft([0.25, 0.72, 0], [1.4, 0.16, 0.84], "white", round=0.4, puff=0.1, cuts=2, omit=("bottom",), tex="quilt")
    m.soft([-0.72, 0.86, 0], [0.6, 0.15, 0.84], "white", round=0.4, puff=0.1, cuts=1, r=[0, 0, -22], tex="quilt")
    m.soft([0.35, 0.81, 0], [1.1, 0.04, 0.88], "cream", round=0.3, puff=0.2, cuts=1, tex="fabric")
    m.soft([-0.16, 0.83, 0], [0.12, 0.05, 0.88], "white", round=0.8, puff=0.2, cuts=1, tex="fabric")
    m.soft([-0.8, 0.97, 0], [0.2, 0.1, 0.56], "white", round=1.0, puff=0.4, cuts=1, r=[0, 0, -22], tex="fabric")
    # The side rails, head and foot boards, and the clipboard.
    for sz in (-1, 1):
        m.sweep([(-0.5, 0.64, sz * 0.48), (-0.5, 0.9, sz * 0.48), (0.4, 0.9, sz * 0.48), (0.4, 0.64, sz * 0.48)], 0.035, "accent", seg=5, smooth=2, caps=False)
        m.cyl([-0.05, 0.9, sz * 0.48], 0.02, 0.24, "accent", seg=5, r=[0, 0, 90])
    for x, top in ((-1.07, 1.0), (1.07, 0.88)):
        m.box([x, (0.6 + top) / 2, 0], [0.04, top - 0.6, 0.92], "accent", bevel=0.015, seg=1, edges="upper")
    m.box([1.095, 0.78, 0.2], [0.01, 0.2, 0.15], "composite", r=[0, 0, -6])
    m.box([1.102, 0.77, 0.2], [0.004, 0.16, 0.12], "white", r=[0, 0, -6])


build("medical_bed", fp)
