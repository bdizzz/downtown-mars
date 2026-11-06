# The patient monitor (#366), first person: a five-star base on castors, a steel pole with a basket and
# a white pump unit, and a dark monitor on a bracket, its glowing screen showing a heartbeat trace and
# readings, with a cable looping down to the pump.
# Run: blender -b --factory-startup -P models/monitor_stand.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for k in range(5):
        a = math.radians(90 + 72 * k)
        x, z = 0.22 * math.cos(a), 0.22 * math.sin(a)
        m.box([x / 2, 0.06, z / 2], [0.04, 0.03, 0.22], "dark", r=[0, -math.degrees(a) + 90, 0], taper=[0.8, 0.8])
        m.cyl([x, 0.025, z], 0.05, 0.025, "rubber", seg=8, r=[90, -math.degrees(a), 0])
    m.lathe([0, 0.04, 0], [(0.05, 0.0), (0.05, 0.04), (0.03, 0.06), (0.0, 0.06)], "dark", seg=8)
    m.cyl([0, 0.8, 0], 0.035, 1.5, "steel", seg=8, tex="brushed")
    # The basket and the pump.
    m.box([0, 0.75, 0.1], [0.24, 0.1, 0.16], "metal", omit=("top",), tex="perforated")
    pump = m.box([0, 1.08, 0.07], [0.22, 0.18, 0.1], "white", omit=("back",))
    m.inset(m.side(pump, "front"), 0.02, 0.005, "dark")
    m.box([-0.04, 1.1, 0.122], [0.08, 0.04, 0.004], "glow", glow=True, omit=("back",))
    for x in (0.05, 0.08):
        m.box([x, 1.05, 0.122], [0.02, 0.02, 0.008], "power", omit=("back",))
    # The monitor and its trace.
    m.box([0, 1.5, 0.03], [0.08, 0.1, 0.06], "dark")
    mon = m.box([0, 1.5, 0.08], [0.5, 0.36, 0.06], "dark", bevel=0.01, edges="vertical")
    m.box([0, 1.5, 0.111], [0.42, 0.28, 0.004], "glow", glow=True, omit=("back",))
    trace = [(-0.19, 1.54), (-0.1, 1.54), (-0.08, 1.6), (-0.06, 1.48), (-0.04, 1.56), (-0.02, 1.54), (0.07, 1.54)]
    m.sweep([(x, y, 0.115) for x, y in trace], 0.006, "plant", seg=3, smooth=1, glow=True)
    for k, c in enumerate(("plant", "power", "water")):
        m.box([0.14, 1.6 - 0.07 * k, 0.115], [0.08, 0.035, 0.002], c, glow=True, omit=("back",))
    m.sweep([(0.1, 1.33, 0.05), (0.14, 1.25, 0.1), (0.1, 1.15, 0.12)], 0.012, "dark", seg=4, smooth=2)


build("monitor_stand", fp)
