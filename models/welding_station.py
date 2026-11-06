# The welding bay (#365), first person: a steel table with a slotted dark top and a rusty work piece
# clamped on it with a glowing weld bead, a screen in the room's colour on a frame at its side, the
# welder in hazard yellow on the floor with a green gas bottle, cables and a torch on a hook.
# Run: blender -b --factory-startup -P models/welding_station.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 0.725, 0.405, sz * 0.375], [0.05, 0.81, 0.05], "metal", omit=("bottom",), tex="brushed")
    top = m.box([0, 0.83, 0], [1.6, 0.04, 0.9], "dark", tex="tread")
    m.inset(m.split(m.side(top, "top")[0], 6, "right"), 0.015, 0.012)
    m.box([0, 0.3, 0], [1.5, 0.03, 0.8], "dark", omit=("left", "right"))
    m.box([0.05, 0.9, 0.0], [0.6, 0.1, 0.18], "rust", r=[0, 10, 0], tex="tread")
    m.box([0.2, 0.92, 0.12], [0.36, 0.08, 0.12], "rust", r=[0, -80, 0], tex="tread")
    m.sweep([(-0.1, 0.96, 0.08), (0.1, 0.96, 0.1), (0.18, 0.96, 0.16)], 0.025, "fire", seg=4, smooth=2, glow=True)
    m.sweep([(-0.3, 0.86, 0.1), (-0.3, 0.98, 0.1), (-0.2, 1.0, 0.04)], 0.03, "red", seg=4, smooth=1, caps=False)
    # The screen on its frame.
    m.box([-0.9, 1.05, 0], [0.025, 1.85, 0.95], "accent", omit=(), tex="fabric")
    for z in (-0.48, 0.48):
        m.box([-0.9, 1.0, z], [0.04, 2.0, 0.04], "metal", omit=("bottom",))
    for y in (0.12, 1.98):
        m.box([-0.9, y, 0], [0.04, 0.04, 1.0], "metal")
    # The welder and its gas bottle, cables, the torch.
    w = m.box([0.55, 0.3, -0.2], [0.5, 0.6, 0.4], "hazard", bevel=0.02, edges="upper", omit=("bottom",))
    m.box([0.55, 0.42, 0.005], [0.36, 0.18, 0.01], "dark", omit=("back",))
    for x in (0.45, 0.6):
        m.cyl([x, 0.42, 0.012], 0.05, 0.02, "metal", seg=8, r=[90, 0, 0])
    m.box([0.68, 0.45, 0.012], [0.08, 0.04, 0.01], "glow", glow=True, omit=("back",))
    m.lathe([0.55, 0.6, -0.25], [(0.09, 0.0), (0.09, 0.52), (0.05, 0.58), (0.03, 0.62)], "leaf", seg=8)
    m.cyl([0.55, 1.24, -0.25], 0.06, 0.06, "steel", seg=6)
    m.sweep([(0.55, 0.15, 0.0), (0.4, 0.05, 0.25), (0.0, 0.05, 0.35), (-0.4, 0.15, 0.4), (-0.6, 0.6, 0.42), (-0.7, 0.75, 0.43)], 0.035, "rubber", seg=4, smooth=2, caps=False)
    m.cyl([-0.7, 0.82, 0.44], 0.04, 0.16, "dark", seg=6, r=[20, 0, 0])


build("welding_station", fp)
