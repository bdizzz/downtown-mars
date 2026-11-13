# The tool cart (#365), first person: brushed steel posts, three trays in the room's colour, each with
# a raised lip, a hazard-yellow drawer box with a handle, a push handle on one end, castors, and tools
# laid on top: a wrench, a hammer, a screwdriver and a spray bottle.
# Run: blender -b --factory-startup -P models/tool_cart.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 0.385, 0.5, sz * 0.21], [0.03, 0.82, 0.03], "metal", omit=("bottom",), tex="brushed")
    for y in (0.2, 0.55, 0.9):
        tray = m.box([0, y, 0], [0.82, 0.05, 0.48], "accent", omit=("bottom",))
        m.inset(m.side(tray, "top"), 0.02, 0.035)
    # A drawer box on the middle tray, and the push handle.
    box = m.box([-0.15, 0.62, 0], [0.3, 0.12, 0.22], "hazard", omit=("bottom",))
    m.inset(m.side(box, "front"), 0.015, 0.006)
    m.box([-0.15, 0.63, 0.115], [0.1, 0.015, 0.012], "dark", omit=("back",))
    m.sweep([(0.4, 0.8, -0.18), (0.44, 0.84, -0.18), (0.44, 0.84, 0.18), (0.4, 0.8, 0.18)], 0.025, "rubber", seg=5, smooth=1, caps=False)
    # Castors: a fork and a wheel at each post.
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 0.385, 0.085, sz * 0.21], [0.04, 0.04, 0.05], "dark")
            m.cyl([sx * 0.385, 0.045, sz * 0.21 + 0.015], 0.085, 0.03, "rubber", seg=8, r=[0, 0, 90])
    # Tools on top: a wrench, a hammer, a screwdriver, a spray bottle.
    m.box([0.15, 0.94, -0.05], [0.24, 0.012, 0.03], "steel", r=[0, 25, 0], tex="brushed")
    for dx in (-0.12, 0.12):
        m.cyl([0.15 + dx * 0.9, 0.94, -0.05 - dx * 0.42], 0.05, 0.012, "steel", seg=6)
    m.cyl([0.05, 0.945, 0.12], 0.025, 0.28, "fibre", seg=6, r=[90, -80, 0])
    m.box([0.19, 0.945, 0.14], [0.05, 0.035, 0.1], "metal", r=[0, -80, 0], tex="brushed")
    m.cyl([-0.2, 0.94, 0.12], 0.03, 0.1, "red", seg=6, r=[0, 0, 90])
    m.cyl([-0.32, 0.94, 0.12], 0.008, 0.14, "steel", seg=4, r=[0, 0, 90])
    m.lathe([-0.25, 0.925, -0.12], [(0.035, 0), (0.035, 0.08), (0.015, 0.1), (0.012, 0.11)], "white", seg=8)
    m.box([-0.24, 0.99, -0.12], [0.05, 0.025, 0.02], "accent", omit=("bottom",))


build("tool_cart", fp)
