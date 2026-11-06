# The fab bench (#365), first person: a white bench on steel legs, an oscilloscope with a glowing
# trace, a soldering station in the room's colour with its iron in a coiled stand, a monitor on an
# arm, a magnifier lamp with a glowing ring, a green circuit board and small parts bins.
# Run: blender -b --factory-startup -P models/fab_bench.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 0.925, 0.44, sz * 0.33], [0.05, 0.88, 0.05], "metal", omit=("bottom",), tex="brushed")
    m.box([0, 0.9, 0], [2.0, 0.04, 0.8], "white", bevel=0.008, edges="upper")
    m.box([0, 0.3, 0], [1.86, 0.03, 0.7], "metal", omit=("left", "right"), tex="perforated")
    scope = m.box([-0.55, 1.05, -0.12], [0.46, 0.26, 0.36], "dark", bevel=0.02, edges="vertical")
    m.box([-0.62, 1.07, 0.062], [0.24, 0.16, 0.006], "glow", glow=True, omit=("back",))
    for (x0, y0, x1, y1) in ((-0.73, 1.06, -0.67, 1.1), (-0.67, 1.1, -0.61, 1.04), (-0.61, 1.04, -0.55, 1.1)):
        m.box([(x0 + x1) / 2, (y0 + y1) / 2, 0.067], [math.hypot(x1 - x0, y1 - y0), 0.008, 0.003], "plant", glow=True, r=[0, 0, math.degrees(math.atan2(y1 - y0, x1 - x0))], omit=("back",))
    for k in range(3):
        m.cyl([-0.4, 1.12 - 0.05 * k, 0.065], 0.03, 0.02, "metal", seg=6, r=[90, 0, 0])
    st = m.box([0.25, 0.97, 0.05], [0.3, 0.1, 0.22], "accent", bevel=0.015, edges="upper")
    m.box([0.21, 0.99, 0.162], [0.1, 0.04, 0.004], "fire", glow=True, omit=("back",))
    ring = [(0.5 + 0.035 * math.cos(a / 6 * math.tau), 0.95 + 0.012 * a, 0.08 + 0.035 * math.sin(a / 6 * math.tau)) for a in range(13)]
    m.sweep(ring, 0.012, "steel", seg=3, smooth=1, caps=False)
    m.cyl([0.5, 1.03, 0.1], 0.025, 0.18, "fire", seg=6, r=[60, 0, 0])
    m.sweep([(0.35, 0.98, 0.1), (0.42, 0.93, 0.18), (0.5, 0.97, 0.15)], 0.012, "rubber", seg=3, smooth=2, caps=False)
    m.box([0.7, 1.08, -0.3], [0.06, 0.2, 0.06], "dark")
    mon = m.box([0.7, 1.32, -0.25], [0.45, 0.28, 0.04], "dark")
    m.inset(m.side(mon, "front"), 0.02, 0.008, "glow", glow=True)
    m.sweep([(-0.85, 0.92, -0.3), (-0.85, 1.35, -0.3), (-0.6, 1.5, 0.0), (-0.5, 1.45, 0.12)], 0.025, "metal", seg=4, smooth=2, tex="brushed")
    m.lathe([-0.5, 1.38, 0.14], [(0.08, 0.0), (0.1, 0.0), (0.1, 0.04), (0.08, 0.04)], "dark", seg=10)
    m.lathe([-0.5, 1.38, 0.14], [(0.08, 0.005), (0.0, 0.01)], "mirror", seg=10)
    m.box([-0.1, 0.93, 0.15], [0.3, 0.012, 0.2], "felt", r=[0, 8, 0])
    for (x, z) in ((-0.15, 0.13), (-0.05, 0.18), (0.0, 0.11)):
        m.box([x, 0.94, z], [0.04, 0.012, 0.03], "dark")
    for k in range(3):
        m.box([0.62 + 0.1 * k, 0.94, 0.25], [0.08, 0.04, 0.12], ("blueprint", "red", "hazard")[k], omit=("bottom",))


build("fab_bench", fp)
