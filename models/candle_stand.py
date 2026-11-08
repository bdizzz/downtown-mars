# The candle stand (#367), first person: a turned copper candelabrum, a domed foot, a stem with knops
# and a broad dish with a raised rim, and in it three candles of different heights with wax running
# down them, each with a wick and a flame.
# Run: blender -b --factory-startup -P models/candle_stand.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.lathe([0, 0, 0], [(0.0, 0.0), (0.2, 0.0), (0.2, 0.02), (0.15, 0.05), (0.06, 0.1), (0.04, 0.14), (0.0, 0.14)], "copper", seg=12, tex="brushed")
    m.lathe([0, 0.14, 0], [(0.025, 0.0), (0.025, 0.22), (0.045, 0.25), (0.025, 0.28), (0.022, 0.55), (0.045, 0.58), (0.03, 0.72), (0.0, 0.73)], "copper", seg=10, caps=False, tex="brushed")
    # The dish: its underside, its rim and the floor inside.
    m.lathe([0, 0.86, 0], [(0.0, 0.0), (0.05, 0.0), (0.22, 0.03), (0.245, 0.06), (0.235, 0.065), (0.215, 0.04), (0.0, 0.035)], "copper", seg=14, tex="brushed")
    for x, z, h in ((-0.12, 0.04, 0.14), (0.0, -0.06, 0.18), (0.12, 0.05, 0.1)):
        y = 0.895
        m.lathe([x, y, z], [(0.0, 0.0), (0.03, 0.0), (0.03, h - 0.01), (0.022, h), (0.0, h - 0.005)], "white", seg=6)
        m.lathe([x, y, z], [(0.0, 0.0), (0.045, 0.0), (0.04, 0.012), (0.0, 0.014)], "white", seg=6, caps=False)
        m.cyl([x + 0.025, y + h - 0.04, z + 0.01], 0.012, 0.05, "white", seg=4)
        m.cyl([x, y + h + 0.004, z], 0.004, 0.016, "dark", seg=4, caps=False)
        top = min(1.15 - (y + h + 0.004), 0.065)
        m.lathe([x, y + h + 0.004, z], [(0.0, 0.0), (0.014, top * 0.3), (0.011, top * 0.6), (0.0, top)], "fire", glow=True, seg=6, caps=False)


build("candle_stand", fp)
