# The dumbbell rack (#366), first person: a two-tier steel rack with sloped cradles on square legs and
# rubber feet, and eight hexagonal dumbbells, dark and in the room colour, growing heavier along the
# rack, their steel handles knurled.
# Run: blender -b --factory-startup -P models/dumbbell_rack.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 0.74, 0.36, sz * 0.18], [0.05, 0.68, 0.05], "metal", omit=("bottom",), tex="brushed")
            m.box([sx * 0.74, 0.01, sz * 0.18], [0.08, 0.02, 0.08], "rubber", omit=("bottom",))
    for y, z, tilt in ((0.36, 0.06, 12), (0.68, -0.06, 12)):
        m.box([0, y, z], [1.56, 0.03, 0.3], "dark", r=[tilt, 0, 0], tex="tread")
        m.box([0, y + 0.03, z + 0.15], [1.56, 0.04, 0.02], "metal", r=[tilt, 0, 0], tex="brushed")
    # The dumbbells: hex heads on knurled handles.
    for row, (y, z) in enumerate(((0.43, 0.06), (0.75, -0.06))):
        for k, d in enumerate((0.1, 0.12, 0.14, 0.16)):
            x = -0.6 + 0.4 * k
            c = "accent" if k % 2 else "dark"
            m.cyl([x, y + d / 2 - 0.05, z], 0.03, 0.2, "steel", seg=6, r=[0, 0, 90], tex="tread")
            for sx in (-1, 1):
                m.cyl([x + sx * 0.12, y + d / 2 - 0.05, z], d, 0.05, c, seg=6, r=[0, 0, 90])


build("dumbbell_rack", fp)
