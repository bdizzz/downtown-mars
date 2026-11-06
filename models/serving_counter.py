# The serving counter (#366), first person: a counter in the room colour with four inset panels and a
# tray slide of steel tubes, four hotel pans sunk in a steel top (a stew with a ladle, greens, mash and
# bread rolls), a slanted glass sneeze guard on posts, and a glowing menu screen on two poles behind.
# Run: blender -b --factory-startup -P models/serving_counter.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    body = m.box([0, 0.52, 0], [2.4, 0.96, 0.66], "accent", omit=("bottom", "top"))
    for p in m.split(m.side(body, "front")[0], 4, "right"):
        m.inset([p], 0.05, 0.01)
    m.box([0, 0.04, 0.02], [2.36, 0.08, 0.6], "dark", omit=("bottom",))
    for x in (-1.1, -0.4, 0.4, 1.1):
        m.box([x, 0.91, 0.345], [0.03, 0.08, 0.03], "steel", omit=("back",))
    for y in (0.88, 0.94):
        m.cyl([0, y, 0.36], 0.025, 2.36, "steel", seg=6, r=[0, 0, 90], tex="brushed")
    m.box([0, 1.02, 0], [2.44, 0.04, 0.72], "steel", omit=("bottom",), tex="brushed")
    # Four pans of food.
    for x, c in ((-0.81, "rust"), (-0.27, "leaf"), (0.27, "cream"), (0.81, "soil")):
        pan = m.box([x, 1.05, 0.05], [0.48, 0.02, 0.44], "steel", omit=("bottom",), tex="brushed")
        m.inset(m.side(pan, "top"), 0.02, 0.012, c)
    for k in range(6):
        m.blade([-0.39 + 0.12 * (k % 3), 1.048, -0.01 + 0.12 * (k // 3)], 30 + 60 * k, 20, 0.1, 0.05, "leaf", droop=0.01, seg=1)
    for k in range(5):
        m.lathe([0.67 + 0.07 * k, 1.046, 0.05 + (0.08 if k % 2 else -0.06)], [(0.05, 0.0), (0.05, 0.02), (0.035, 0.045), (0.0, 0.05)], "soil", seg=6)
    m.lathe([-0.88, 1.04, 0.02], [(0.0, 0.0), (0.04, 0.01), (0.05, 0.04), (0.045, 0.04), (0.0, 0.02)], "steel", seg=8, caps=False)
    m.sweep([(-0.88, 1.08, 0.0), (-0.93, 1.2, -0.05), (-0.98, 1.24, -0.12)], 0.016, "steel", seg=4, smooth=2, tex="brushed")
    # The sneeze guard.
    for x in (-1.1, 0.0, 1.1):
        m.cyl([x, 1.24, -0.12], 0.03, 0.4, "steel", seg=6, tex="brushed")
    m.box([0, 1.46, -0.03], [2.3, 0.012, 0.34], "mirror", r=[25, 0, 0])
    # The menu screen on its poles.
    for x in (-0.7, 0.7):
        m.cyl([x, 1.72, -0.33], 0.04, 1.36, "dark", seg=6)
    scr = m.box([0, 2.3, -0.3], [1.6, 0.5, 0.06], "dark", omit=("back",))
    m.inset(m.side(scr, "front"), 0.04, 0.01, "glow", glow=True)
    for k in range(4):
        m.box([-0.3, 2.42 - 0.08 * k, -0.274], [0.7, 0.02, 0.003], "white", glow=True, omit=("back",))
        m.box([0.5, 2.42 - 0.08 * k, -0.274], [0.14, 0.02, 0.003], "power", glow=True, omit=("back",))


build("serving_counter", fp)
