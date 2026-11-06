# The brick kiln (#365), first person: a kiln of rust-red brick in courses under an arched crown,
# banded by steel straps, a dark iron door frame round a glowing firing door, two glowing peepholes,
# and a stone chimney with iron bands. Run: blender -b --factory-startup -P models/kiln.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    body = m.box([0, 1.1, 0], [2.4, 2.2, 2.2], "rust", omit=("bottom",), tex="tread")
    for s in ("left", "right", "back"):
        m.inset(m.split(m.side(body, s)[0], 6, "top"), 0.01, 0.01)
    m.lathe([-1.2, 2.2, 0], [(0.0, 0.0), (1.1, 0.0), (1.1, 2.4), (0.0, 2.4)], "rust", seg=12, r=[0, 0, -90], tex="tread")
    for x in (-1.0, 0.0, 1.0):
        m.box([x, 1.1, 0], [0.08, 2.2, 2.24], "metal", omit=("bottom",), tex="brushed")
    frame = m.box([0, 0.78, 1.11], [1.3, 1.2, 0.04], "dark", omit=("back",), tex="tread")
    m.inset(m.side(frame, "front"), 0.1, 0.03, "rust")
    m.box([0, 0.72, 1.12], [0.9, 0.8, 0.02], "fire", glow=True, omit=("back",))
    for x in (-0.3, 0.3):
        m.box([x, 0.72, 1.125], [0.04, 0.8, 0.02], "dark", omit=("back",))
    for x in (-0.9, 0.9):
        m.cyl([x, 1.6, 1.11], 0.12, 0.04, "dark", seg=8, r=[90, 0, 0])
        m.cyl([x, 1.6, 1.12], 0.07, 0.03, "fire", seg=8, r=[90, 0, 0], glow=True)
    m.lathe([0.8, 2.9, -0.5], [(0.24, 0.0), (0.24, 1.1)], "stone", seg=10, caps=False, tex="tread")
    for y in (3.1, 3.5, 3.94):
        m.lathe([0.8, y, -0.5], [(0.26, 0.0), (0.26, 0.06)], "dark", seg=10, caps=False)


build("kiln", fp)
