# The baler (#365), first person: a body in the room's colour with a recessed dark chamber door and
# its latch, a hydraulic cylinder on top, a glowing panel with buttons, a guard grille, and a finished
# bale of composite on the floor in front, tied with wire.
# Run: blender -b --factory-startup -P models/baler.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    body = m.box([0, 1.0, 0], [1.6, 2.0, 1.4], "accent", omit=("bottom",), tex="grain")
    m.inset(m.split(m.side(body, "left")[0], 4, "top"), 0.04, 0.01)
    door = m.box([0, 0.6, 0.705], [1.24, 0.9, 0.02], "dark", omit=("back",), tex="tread")
    m.inset(m.split(m.side(door, "front")[0], 5, "right"), 0.03, 0.01, "rubber")
    m.box([0.5, 1.1, 0.72], [0.14, 0.05, 0.04], "steel")
    m.lathe([0, 2.0, 0], [(0.32, 0.0), (0.32, 0.25), (0.25, 0.27), (0.25, 0.32), (0.12, 0.34), (0.0, 0.36)], "metal", seg=10, tex="brushed")
    for x in (-0.25, 0.25):
        m.sweep([(x, 2.25, 0.2), (x * 1.5, 2.2, 0.55), (x * 2.2, 1.9, 0.69)], 0.04, "rubber", seg=4, smooth=2, caps=False)
    m.box([0.6, 1.5, 0.71], [0.24, 0.34, 0.02], "dark", omit=("back",))
    m.box([0.6, 1.58, 0.722], [0.18, 0.12, 0.004], "glow", glow=True, omit=("back",))
    for k, c in enumerate(("plant", "red")):
        m.cyl([0.55 + 0.1 * k, 1.42, 0.725], 0.04, 0.02, c, seg=6, r=[90, 0, 0])
    bale = m.soft([0, 0.32, 1.3], [1.0, 0.6, 0.86], "composite", round=0.2, puff=0.06, cuts=1, tex="fabric")
    for x in (-0.3, 0.0, 0.3):
        m.sweep([(x, 0.02, 0.87), (x, 0.63, 0.87), (x, 0.63, 1.73), (x, 0.02, 1.73)], 0.015, "steel", seg=3, smooth=1, caps=False)


build("baler", fp)
