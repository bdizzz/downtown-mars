# The waste container (#365), first person: a tapered body in the room's colour stiffened with ribs,
# two dark lids with their handles, a hazard stripe, lifting pockets on its sides, and four castors.
# Run: blender -b --factory-startup -P models/dumpster.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    body = m.box([0, 0.65, 0], [1.7, 1.0, 1.0], "accent", taper=[1.04, 1.08], omit=("bottom",), tex="grain")
    m.box([0, 0.14, 0], [1.6, 0.04, 0.92], "dark", omit=("top",))
    for x in (-0.6, -0.2, 0.2, 0.6):
        m.box([x, 0.65, 0.525], [0.06, 0.96, 0.04], "accent", omit=("back",))
    m.box([0, 1.12, 0.555], [1.78, 0.08, 0.04], "dark", omit=("back",))
    m.box([0, 0.55, 0.552], [1.62, 0.08, 0.01], "hazard", omit=("back",))
    for x in (-0.44, 0.44):
        lid = m.box([x, 1.2, -0.04], [0.86, 0.06, 1.08], "dark", r=[-6, 0, 0], tex="tread")
        m.sweep([(x - 0.15, 1.2, 0.5), (x - 0.14, 1.25, 0.53), (x + 0.14, 1.25, 0.53), (x + 0.15, 1.2, 0.5)], 0.025, "steel", seg=4, smooth=1, caps=False)
    for x in (-0.89, 0.89):
        m.box([x, 0.7, 0], [0.06, 0.16, 0.5], "dark")
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 0.7, 0.14, sz * 0.4], [0.06, 0.06, 0.08], "dark")
            m.cyl([sx * 0.7, 0.06, sz * 0.4 + 0.02], 0.12, 0.05, "rubber", seg=8, r=[0, 0, 90])


build("dumpster", fp)
