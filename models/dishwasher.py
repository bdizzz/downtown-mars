# The dishwasher (#366), first person: a pass-through hood machine: a steel base cabinet with two doors
# on a dark kick plate, a hood with a deep opening onto a rack of plates and a bar handle, a glowing control
# panel, a steam vent on top, and a basket of cups waiting beside it.
# Run: blender -b --factory-startup -P models/dishwasher.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    base = m.box([0, 0.47, 0], [1.2, 0.82, 0.7], "steel", omit=("bottom", "back", "top"), tex="brushed")
    for d in m.split(m.side(base, "front")[0], 2, "right"):
        m.inset([d], 0.03, 0.008)
    m.box([0, 0.04, 0.02], [1.16, 0.08, 0.64], "dark", omit=("bottom",))
    for x in (-0.08, 0.08):
        m.box([x, 0.75, 0.355], [0.03, 0.14, 0.02], "dark", omit=("back",))
    m.box([0, 0.9, 0], [1.2, 0.04, 0.7], "steel", omit=("bottom",), tex="brushed")
    # The hood, its window onto the plates, the handle and the panel.
    hood = m.box([-0.15, 1.37, -0.02], [0.84, 0.9, 0.62], "steel", omit=("bottom", "back"), tex="brushed")
    m.inset(m.side(hood, "front"), 0.08, 0.2, "dark")
    for k in range(7):
        m.cyl([-0.39 + 0.08 * k, 1.17, 0.17], 0.24, 0.012, "white", seg=10, r=[90, 0, 0])
    m.box([-0.15, 1.04, 0.17], [0.66, 0.02, 0.2], "metal", omit=("bottom",), tex="perforated")
    m.sweep([(-0.5, 1.72, 0.29), (-0.5, 1.72, 0.34), (0.2, 1.72, 0.34), (0.2, 1.72, 0.29)], 0.03, "steel", seg=6, smooth=1, caps=False, tex="brushed")
    panel = m.box([0.43, 1.45, 0.2], [0.3, 0.3, 0.06], "dark", omit=("back",))
    m.inset(m.side(panel, "front"), 0.04, 0.005, "glow", glow=True)
    m.box([0.43, 1.25, 0.23], [0.06, 0.04, 0.02], "power", glow=True, omit=("back",))
    m.cyl([-0.15, 1.86, -0.1], 0.14, 0.08, "steel", seg=10, tex="brushed")
    # A basket of cups beside it.
    m.box([0.43, 0.97, 0.05], [0.3, 0.1, 0.3], "dark", omit=("bottom",), tex="perforated")
    for dx in (-0.07, 0.07):
        for dz in (-0.07, 0.07):
            m.lathe([0.43 + dx, 1.02, 0.05 + dz], [(0.03, 0.0), (0.034, 0.07), (0.03, 0.07), (0.026, 0.01), (0.0, 0.01)], "white", seg=8, caps=False)


build("dishwasher", fp)
