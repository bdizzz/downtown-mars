# The stool (#363), first person: a turned, domed steel base, a column with a gas-lift sleeve and
# its height lever, a round footrest ring on three spokes, and a padded round seat in the room's
# colour, its edge rolled over a dark rim. Run: blender -b --factory-startup -P models/stool.py
import math
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    # The base: a low dome, turned, with a rubber ring under it.
    m.lathe([0, 0, 0], [(0.17, 0.0), (0.17, 0.012), (0.155, 0.03), (0.11, 0.05), (0.05, 0.062), (0.03, 0.066)], "metal", seg=14)
    m.lathe([0, 0, 0], [(0.168, 0.0), (0.172, 0.006)], "rubber", seg=14, caps=False)
    # The column, its gas-lift sleeve at the top, and the lever under the seat.
    m.cyl([0, 0.2, 0], 0.045, 0.28, "metal", seg=8, caps=False, tex="brushed")
    m.lathe([0, 0, 0], [(0.034, 0.32), (0.034, 0.4), (0.03, 0.41)], "dark", seg=8)
    m.sweep([(0.02, 0.405, 0), (0.09, 0.4, 0.02), (0.13, 0.395, 0.03)], 0.012, "dark", seg=4, smooth=2)
    # The footrest: a ring on three spokes.
    ring = [(0.15 * math.cos(a), 0.17, 0.15 * math.sin(a)) for a in (2 * math.pi * k / 10 for k in range(11))]
    m.sweep(ring, 0.02, "metal", seg=5, smooth=2, caps=False, tex="brushed")
    for k in range(3):
        a = 2 * math.pi * k / 3 + math.pi / 2
        m.sweep([(0.02 * math.cos(a), 0.17, 0.02 * math.sin(a)), (0.145 * math.cos(a), 0.17, 0.145 * math.sin(a))], 0.014, "metal", seg=4, smooth=1, caps=False)
    # The seat: a dark pan, and the cushion rolled over its edge.
    m.lathe([0, 0, 0], [(0.06, 0.41), (0.17, 0.42), (0.18, 0.43)], "dark", seg=14, caps=False)
    m.lathe([0, 0, 0], [(0.178, 0.425), (0.19, 0.44), (0.192, 0.46), (0.183, 0.475), (0.15, 0.484), (0.08, 0.489), (0.0, 0.49)], "accent", seg=14, tex="fabric")


build("stool", fp)
