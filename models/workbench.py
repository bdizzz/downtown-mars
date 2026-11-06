# The workbench (#365), first person: dark legs, a thick grained composite top, a lower shelf with a
# drawer unit in the room's colour, a vice clamped to the corner, a hazard-yellow tool box, a
# perforated back board with tools on pegs, a plank held in a clamp, and a glowing lamp strip.
# Run: blender -b --factory-startup -P models/workbench.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 0.925, 0.44, sz * 0.33], [0.06, 0.88, 0.06], "dark", omit=("bottom",))
    m.box([0, 0.9, 0], [2.0, 0.06, 0.8], "composite", bevel=0.01, edges="upper", tex="grain")
    m.box([0, 0.3, 0], [1.86, 0.03, 0.7], "dark", omit=("left", "right"), tex="tread")
    drawers = m.box([-0.4, 0.58, 0.02], [0.6, 0.52, 0.6], "accent", omit=("bottom", "back"))
    for d in m.split(m.side(drawers, "front")[0], 3, "top"):
        m.inset([d], 0.025, 0.008)
    for y in (0.42, 0.58, 0.75):
        m.box([-0.4, y, 0.33], [0.16, 0.02, 0.02], "steel")
    # The vice, the tool box, a plank in a clamp.
    m.box([0.82, 0.97, 0.22], [0.2, 0.08, 0.14], "metal", tex="brushed")
    m.box([0.82, 1.0, 0.31], [0.2, 0.1, 0.04], "metal", tex="brushed")
    m.cyl([0.82, 1.0, 0.36], 0.025, 0.06, "steel", seg=5, r=[90, 0, 0])
    m.cyl([0.82, 1.0, 0.385], 0.02, 0.16, "steel", seg=5, r=[0, 0, 90])
    tb = m.box([-0.35, 1.0, 0.0], [0.42, 0.14, 0.22], "hazard", bevel=0.01, edges="upper")
    m.sweep([(-0.47, 1.07, 0.0), (-0.45, 1.13, 0.0), (-0.25, 1.13, 0.0), (-0.23, 1.07, 0.0)], 0.02, "dark", seg=4, smooth=2, caps=False)
    m.box([0.25, 0.95, 0.12], [0.7, 0.04, 0.18], "fibre", r=[0, -6, 0], tex="grain")
    m.sweep([(0.4, 0.88, 0.2), (0.4, 1.0, 0.2), (0.4, 1.02, 0.12)], 0.025, "red", seg=4, smooth=1, caps=False)
    # The back board, its tools, the lamp strip.
    m.box([0, 1.5, -0.37], [2.0, 1.0, 0.04], "composite", omit=("back",), tex="perforated")
    for x, h in ((-0.7, 0.4), (-0.55, 0.3), (-0.4, 0.36), (-0.1, 0.42), (0.3, 0.3), (0.6, 0.38)):
        m.box([x, 1.55, -0.335], [0.04, h, 0.02], "steel", omit=("back",), tex="brushed")
    m.cyl([0.0, 1.7, -0.32], 0.12, 0.04, "hazard", seg=8, r=[90, 0, 0])
    lamp = m.box([0, 2.05, -0.3], [1.8, 0.05, 0.12], "dark")
    m.inset(m.side(lamp, "bottom"), 0.015, 0.006, "lamp", glow=True)


build("workbench", fp)
