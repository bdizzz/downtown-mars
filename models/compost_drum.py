# The compost drum (#365), first person: a turned drum in the room's colour with ribbed dark bands,
# lying on two steel A-frame stands, a hatch with a latch on its side, a turned axle cap, a crank
# handle at one end and a tray underneath. Run: blender -b --factory-startup -P models/compost_drum.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for x in (-0.55, 0.55):
        m.sweep([(x, 0.03, -0.42), (x, 0.82, 0.0), (x, 0.03, 0.42)], 0.06, "metal", seg=4, smooth=1, caps=False, tex="brushed")
        m.box([x, 0.3, 0], [0.05, 0.05, 0.62], "metal")
    m.box([0, 0.12, 0], [1.3, 0.04, 0.7], "dark", omit=("bottom",), tex="tread")
    m.lathe([-0.75, 0.9, 0], [(0.0, 0.0), (0.42, 0.0), (0.5, 0.06), (0.5, 0.3), (0.52, 0.32), (0.5, 0.34), (0.5, 0.73), (0.52, 0.75), (0.5, 0.77), (0.5, 1.18), (0.52, 1.2), (0.5, 1.22), (0.5, 1.44), (0.42, 1.5), (0.0, 1.5)], "accent", seg=12, r=[0, 0, -90], tex="grain")
    for x in (-0.55, 0.0, 0.55):
        m.lathe([x - 0.03, 0.9, 0], [(0.52, 0.0), (0.52, 0.06)], "dark", seg=12, caps=False, r=[0, 0, -90])
    hatch = m.box([0.27, 1.39, 0.0], [0.4, 0.04, 0.4], "accent", omit=("bottom",))
    m.inset(m.side(hatch, "top"), 0.03, 0.01, "dark")
    m.box([0.27, 1.42, 0.22], [0.1, 0.03, 0.04], "steel")
    m.cyl([0.8, 0.9, 0], 0.16, 0.12, "steel", seg=8, r=[0, 0, 90], tex="brushed")
    m.sweep([(0.86, 0.9, 0), (0.88, 0.9, 0.0), (0.88, 0.62, 0.05), (0.9, 0.6, 0.12)], 0.035, "steel", seg=4, smooth=1, caps=False)
    m.cyl([0.9, 0.6, 0.18], 0.04, 0.12, "rubber", seg=6, r=[90, 0, 0])


build("compost_drum", fp)
