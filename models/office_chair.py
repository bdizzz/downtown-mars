# The office chair (#363), first person: a five-star base of tapered spokes on castors,
# a turned column with a gas-lift sleeve, a seat mechanism with its lever, a padded seat, armrests
# on bent tubes with soft pads, and a curved back: a dark shell framing a perforated mesh panel in
# the room's colour, a lumbar pad across it. Run: blender -b --factory-startup -P models/office_chair.py
import math
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    # The base: five tapered spokes from a hub, each on a castor.
    for k in range(5):
        a = math.radians(90 + 72 * k)
        cx, cz = math.cos(a), math.sin(a)
        m.box([0.17 * cx, 0.075, 0.17 * cz], [0.05, 0.035, 0.3], "dark", r=[0, 90 - math.degrees(a), 0], taper=[0.8, 1.0])
        m.cyl([0.33 * cx, 0.035, 0.33 * cz], 0.06, 0.04, "rubber", seg=6, r=[90, math.degrees(math.atan2(-cz, cx)), 0])
    # The hub and the column: a gas lift in a sleeve.
    m.lathe([0, 0, 0], [(0.05, 0.06), (0.055, 0.08), (0.03, 0.1), (0.03, 0.26), (0.024, 0.27)], "dark", seg=10)
    m.cyl([0, 0.34, 0], 0.035, 0.16, "metal", seg=10, caps=False, tex="brushed")
    # The mechanism under the seat, and its lever.
    m.box([0, 0.43, 0.02], [0.22, 0.04, 0.24], "dark", bevel=0.01, edges="top")
    m.sweep([(0.1, 0.43, 0.08), (0.2, 0.425, 0.1), (0.24, 0.42, 0.12)], 0.014, "dark", seg=4, smooth=1)
    # The seat: a shell and a padded cushion, its front edge rolled down.
    m.box([0, 0.465, 0.02], [0.5, 0.03, 0.48], "dark", bevel=0.02, edges="vertical")
    m.soft([0, 0.51, 0.025], [0.5, 0.07, 0.48], "dark", round=0.6, puff=0.25, cuts=2, omit=("bottom",), tex="fabric")
    # The armrests: bent tubes up from under the seat, soft pads on top.
    for sx in (-1, 1):
        m.sweep([(sx * 0.16, 0.45, -0.08), (sx * 0.26, 0.47, -0.06), (sx * 0.28, 0.58, -0.02), (sx * 0.28, 0.645, 0.0)], 0.03, "metal", seg=5, smooth=1, tex="brushed")
        m.soft([sx * 0.28, 0.665, 0.02], [0.08, 0.035, 0.3], "dark", round=0.9, puff=0.1, cuts=1)
    # The back: a spine from the seat, a curved shell, and the mesh panel inside it.
    m.sweep([(0, 0.45, -0.12), (0, 0.5, -0.24), (0, 0.62, -0.27)], 0.05, "dark", seg=5, smooth=1)
    shell = [(-0.24, -0.2), (-0.14, -0.24), (0, -0.255), (0.14, -0.24), (0.24, -0.2)]
    m.strip(shell, 0.6, 1.14, 0.03, "dark")
    m.strip([(x * 0.86, z + 0.022) for x, z in shell], 0.64, 1.1, 0.008, "accent", tex="perforated")
    # A lumbar pad across the small of the back.
    m.soft([0, 0.72, -0.21], [0.34, 0.09, 0.035], "dark", round=0.9, puff=0.0, cuts=1, tex="fabric")


build("office_chair", fp)
