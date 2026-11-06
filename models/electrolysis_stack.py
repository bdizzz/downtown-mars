# The electrolysis stack (#365), first person: a dark skid, six brushed cell stacks separated by
# plates in the room's colour and clamped by tie rods, a manifold on top, copper bus bars down the
# front, a white hydrogen separator and a steel oxygen separator with hazard caps, a water inlet and a
# glowing panel. Run: blender -b --factory-startup -P models/electrolysis_stack.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.12, 0], [2.6, 0.24, 1.0], "dark", omit=("bottom",), tex="tread")
    for k in range(6):
        x = -1.0 + 0.4 * k
        cell = m.box([x, 0.85, 0], [0.32, 1.2, 0.9], "steel", omit=("bottom", "left", "right"), tex="brushed")
        m.inset(m.split(m.side(cell, "front")[0], 3, "top"), 0.02, 0.006)
    for k in range(5):
        m.box([-0.8 + 0.4 * k, 0.85, 0], [0.08, 1.24, 0.94], "accent", omit=("bottom",))
    for x in (-1.2, 1.2):
        m.box([x, 0.85, 0], [0.08, 1.3, 1.0], "dark", omit=("bottom",))
    for y in (0.4, 1.3):
        for z in (-0.42, 0.42):
            m.cyl([0, y, z], 0.04, 2.52, "steel", seg=5, caps=False, r=[0, 0, 90])
    m.box([0, 1.52, 0], [2.6, 0.08, 0.9], "metal", bevel=0.02, edges="upper", omit=("bottom",), tex="brushed")
    for x in (-0.6, 0.6):
        m.sweep([(x, 1.4, 0.48), (x, 0.6, 0.48), (x + 0.2, 0.3, 0.48)], 0.04, "copper", seg=4, smooth=1, caps=False)
    # The separators on top, with caps; the water inlet; the panel.
    m.lathe([-0.7, 1.56, 0], [(0.12, 0.0), (0.12, 0.62), (0.08, 0.7), (0.0, 0.72)], "white", seg=10)
    m.lathe([0.7, 1.56, 0], [(0.12, 0.0), (0.12, 0.62), (0.08, 0.7), (0.0, 0.72)], "metal", seg=10, tex="brushed")
    for x in (-0.7, 0.7):
        m.cyl([x, 2.3, 0], 0.08, 0.06, "hazard", seg=8)
    m.sweep([(-0.7, 1.9, 0.12), (-0.7, 1.95, 0.25), (0.0, 1.95, 0.3), (0.7, 1.95, 0.25), (0.7, 1.9, 0.12)], 0.04, "steel", seg=4, smooth=2, caps=False)
    m.cyl([-1.45, 0.5, 0], 0.18, 0.3, "water", seg=8, r=[0, 0, 90])
    m.cyl([-1.55, 0.5, 0], 0.24, 0.04, "steel", seg=8, r=[0, 0, 90])
    m.box([1.0, 0.95, 0.52], [0.4, 0.3, 0.03], "dark", omit=("back",))
    m.box([1.0, 0.97, 0.535], [0.32, 0.18, 0.004], "glow", glow=True, omit=("back",))


build("electrolysis_stack", fp)
