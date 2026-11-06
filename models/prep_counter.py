# The prep counter (#366), first person: a cabinet of three composite drawers with bar handles and a
# stripe in the room colour, a steel top with a sink sunk into it and a gooseneck tap, a chopping
# board with a tomato, greens, a knife and a bowl, and a shelf of three jars on the wall.
# Run: blender -b --factory-startup -P models/prep_counter.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    base = m.box([0, 0.46, 0], [2.0, 0.84, 0.68], "panel", omit=("bottom", "back", "top"), tex="grain")
    m.box([0, 0.04, 0.02], [1.96, 0.08, 0.62], "dark", omit=("bottom",))
    for d in m.split(m.side(base, "front")[0], 3, "right"):
        m.inset([d], 0.03, 0.008, "composite", tex="grain")
    for x in (-0.66, 0.0, 0.66):
        m.box([x, 0.76, 0.35], [0.24, 0.02, 0.025], "steel", omit=("back",), tex="brushed")
    m.box([0, 0.2, 0.343], [1.96, 0.02, 0.01], "accent", omit=("back",))
    # The top, the sink and the tap.
    m.box([0, 0.9, 0], [2.04, 0.04, 0.72], "steel", omit=("bottom",), tex="brushed")
    sink = m.box([-0.5, 0.922, 0.02], [0.56, 0.004, 0.44], "steel", omit=("bottom",), tex="brushed")
    m.inset(m.side(sink, "top"), 0.02, 0.16, "steel", tex="brushed")
    m.box([-0.5, 0.78, 0.02], [0.5, 0.01, 0.38], "water", omit=("bottom",))
    m.sweep([(-0.5, 0.92, -0.29), (-0.5, 1.2, -0.29), (-0.5, 1.27, -0.2), (-0.5, 1.2, -0.11), (-0.5, 1.14, -0.11)], 0.028, "steel", seg=6, smooth=2, tex="brushed")
    m.box([-0.4, 0.95, -0.29], [0.08, 0.02, 0.03], "steel", omit=("bottom",))
    # A chopping board, a tomato, greens, a knife and a bowl.
    m.box([0.4, 0.935, 0.05], [0.5, 0.03, 0.34], "composite", bevel=0.008, edges="top", omit=("bottom",), tex="grain")
    m.lathe([0.3, 0.95, 0.05], [(0.0, 0.0), (0.04, 0.01), (0.05, 0.04), (0.035, 0.07), (0.0, 0.075)], "rust", seg=8)
    m.box([0.3, 1.027, 0.05], [0.02, 0.008, 0.02], "leaf", omit=("bottom",))
    for k in range(5):
        m.blade([0.48, 0.955, 0.05], 40 + 70 * k, 18, 0.12, 0.05, "leaf", droop=0.01, seg=1)
    m.box([0.55, 0.955, -0.06], [0.2, 0.006, 0.03], "steel", r=[0, 20, 0], omit=("bottom",), tex="brushed")
    m.box([0.42, 0.958, -0.1], [0.1, 0.014, 0.025], "dark", r=[0, 20, 0], omit=("bottom",))
    m.lathe([0.8, 0.92, 0.1], [(0.05, 0.0), (0.1, 0.04), (0.11, 0.08), (0.1, 0.08), (0.04, 0.012)], "accent", seg=10, caps=False)
    # The shelf and its jars.
    m.box([0, 1.6, -0.3], [2.0, 0.03, 0.12], "steel", tex="brushed")
    for x in (-0.82, 0.82):
        m.box([x, 1.54, -0.33], [0.03, 0.1, 0.06], "dark")
    for x, c in ((-0.7, "white"), (-0.3, "cream"), (0.1, "white")):
        m.lathe([x, 1.615, -0.3], [(0.05, 0.0), (0.055, 0.01), (0.055, 0.1), (0.045, 0.11), (0.0, 0.11)], c, seg=8)
        m.cyl([x, 1.735, -0.3], 0.07, 0.03, "copper", seg=8)


build("prep_counter", fp)
