# The reactor vessel (#365), first person: a turned steel vessel with a domed head on a dark base
# ring, a bolted flange round its middle in the room's colour, a glowing sight glass, insulation
# bands, a nozzle on top, an angled feed pipe with a flange, and a ladder up its side.
# Run: blender -b --factory-startup -P models/reactor_vessel.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.lathe([0, 0.0, 0], [(1.0, 0.0), (1.0, 0.3), (0.82, 0.32)], "dark", seg=14, caps=False, tex="tread")
    m.lathe([0, 0.3, 0], [(0.8, 0.0), (0.8, 2.4), (0.75, 2.6), (0.6, 2.82), (0.35, 2.95), (0.0, 2.98)], "steel", seg=14, tex="brushed")
    m.lathe([0, 1.4, 0], [(0.86, 0.0), (0.86, 0.2)], "accent", seg=14, caps=False)
    for a in range(0, 360, 30):
        r = math.radians(a + 15)
        m.cyl([0.86 * math.cos(r), 1.5, 0.86 * math.sin(r)], 0.04, 0.26, "steel", seg=4, caps=False)
    for y in (0.8, 2.1):
        m.lathe([0, y, 0], [(0.81, 0.0), (0.81, 0.05)], "metal", seg=14, caps=False)
    m.box([0, 1.0, 0.8], [0.44, 0.34, 0.04], "metal", omit=("back",))
    m.box([0, 1.0, 0.82], [0.36, 0.26, 0.02], "fire", glow=True, omit=("back",))
    m.cyl([0, 3.3, 0], 0.2, 0.6, "metal", seg=8, caps=False, tex="brushed")
    m.cyl([0, 3.58, 0], 0.32, 0.05, "steel", seg=8)
    m.sweep([(0.4, 2.6, 0.0), (0.9, 2.95, 0.0), (1.2, 3.1, 0.0), (1.4, 3.1, 0.0)], 0.15, "metal", seg=8, smooth=1, caps=False, tex="brushed")
    m.cyl([1.4, 3.1, 0], 0.26, 0.05, "steel", seg=8, r=[0, 0, 90])
    for z in (-0.18, 0.18):
        m.box([-0.84, 1.5, z], [0.04, 3.0, 0.04], "hazard", omit=("bottom",))
    for y in (0.35, 0.7, 1.05, 1.4, 1.75, 2.1, 2.45, 2.8):
        m.cyl([-0.84, y, 0], 0.03, 0.36, "hazard", seg=4, caps=False, r=[90, 0, 0])


build("reactor_vessel", fp)
