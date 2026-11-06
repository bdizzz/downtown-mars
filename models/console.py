# The control console (#365), first person: a dark cabinet with inset doors and a kick plate, a stripe
# in the room's colour, a sloped desk with a glowing screen, rows of keys, a joystick and two knobs,
# and a raised monitor on a stand with a glowing display.
# Run: blender -b --factory-startup -P models/console.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    cab = m.box([0, 0.45, 0.0], [1.3, 0.9, 0.7], "dark", omit=("bottom",), tex="brushed")
    for door in m.split(m.side(cab, "front")[0], 2, "right"):
        m.inset([door], 0.04, 0.01)
    m.box([0, 0.05, 0.355], [1.26, 0.08, 0.012], "rubber", omit=("back",))
    m.box([0, 0.75, 0.356], [1.2, 0.035, 0.008], "accent", omit=("back",))
    for x in (-0.12, 0.12):
        m.box([x, 0.45, 0.36], [0.02, 0.12, 0.02], "steel", omit=("back",))
    # The sloped desk: a screen, keys, a joystick, knobs.
    desk = m.box([0, 1.0, 0.07], [1.3, 0.08, 0.8], "panel", r=[-20, 0, 0], tex="grain")
    m.box([-0.2, 1.06, 0.03], [0.6, 0.012, 0.36], "glow", glow=True, r=[-20, 0, 0], omit=("bottom",))
    for k in range(8):
        for row in (0, 1):
            m.box([0.2 + 0.05 * (k % 4) + 0.2 * (k // 4) - 0.05, 1.04 + 0.04 * row - 0.03, 0.26 - 0.1 * row], [0.04, 0.02, 0.04], "accent" if (k + row) % 3 else "power", r=[-20, 0, 0], omit=("bottom",))
    m.lathe([-0.5, 1.06, 0.2], [(0.05, 0.0), (0.03, 0.02), (0.012, 0.03), (0.012, 0.11), (0.025, 0.12), (0.025, 0.15), (0.0, 0.16)], "rubber", seg=8, r=[-20, 0, 0])
    for x in (0.42, 0.52):
        m.cyl([x, 1.08, 0.0], 0.05, 0.03, "metal", seg=8, r=[-20, 0, 0], tex="brushed")
    # The monitor on its stand.
    m.box([0, 1.3, -0.3], [0.06, 0.24, 0.06], "dark")
    mon = m.box([0, 1.57, -0.26], [0.72, 0.44, 0.05], "dark", r=[-5, 0, 0])
    m.inset(m.side(mon, "front"), 0.025, 0.01, "glow", glow=True)
    m.box([0.0, 1.57, -0.22], [0.5, 0.012, 0.004], "white", glow=True, r=[-5, 0, 0], omit=("back",))


build("console", fp)
