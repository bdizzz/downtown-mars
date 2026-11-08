# The plan table (#367), first person: a drafting table on brushed steel legs with a crossbar and a
# footrest, its top tilted toward you, and on it a glowing plan sheet drawn with white lines and room
# outlines, a parallel rule across its foot, a pencil tray, a rolled plan in a hazard tube and two
# loose rolls of paper.
# Run: blender -b --factory-startup -P models/blueprint_table.py
import math
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build

TILT = 12
TOP = 0.95
C, S = math.cos(math.radians(TILT)), math.sin(math.radians(TILT))


def on(x, h, z):
    """A point h above the tilted top at (x, z) across it, in the item's frame."""
    return [x, TOP + h * C - z * S, h * S + z * C]


def fp(m):
    for x in (-0.92, 0.92):
        for z in (-0.55, 0.55):
            h = TOP - z * S - 0.02
            m.box([x, h / 2, z], [0.05, h, 0.05], "metal", tex="brushed")
            m.box([x, 0.01, z], [0.08, 0.02, 0.08], "rubber", omit=("bottom",))
        m.box([x, 0.2, 0], [0.04, 0.04, 1.06], "metal", tex="brushed")
    m.box([0, 0.2, -0.55], [1.8, 0.04, 0.04], "metal", tex="brushed")
    m.box([0, 0.22, 0.4], [1.8, 0.025, 0.2], "metal", tex="perforated")
    # The top, its plan sheet and the lines on it.
    m.box(on(0, 0, 0), [2.0, 0.05, 1.28], "panel", bevel=0.01, edges="top", r=[TILT, 0, 0], tex="grain")
    m.box(on(0, 0.026, -0.02), [1.76, 0.003, 1.06], "blueprint", glow=True, r=[TILT, 0, 0])
    for x0, z0, w, d in ((-0.7, -0.45, 0.6, 0.4), (-0.1, -0.45, 0.5, 0.4), (-0.7, -0.05, 0.4, 0.45), (-0.3, -0.05, 0.9, 0.45), (0.4, -0.45, 0.4, 0.85)):
        for (px, pz, sx, sz) in ((x0 + w / 2, z0, w, 0.008), (x0 + w / 2, z0 + d, w, 0.008), (x0, z0 + d / 2, 0.008, d), (x0 + w, z0 + d / 2, 0.008, d)):
            m.box(on(px, 0.029, pz), [sx, 0.003, sz], "white", glow=True, r=[TILT, 0, 0], omit=("bottom",))
    for k in range(4):
        m.box(on(0.62, 0.029, -0.38 + 0.08 * k), [0.12 - 0.02 * k, 0.003, 0.012], "white", glow=True, r=[TILT, 0, 0], omit=("bottom",))
    # The parallel rule, a pencil tray and a pencil.
    m.box(on(0, 0.04, 0.5), [1.9, 0.02, 0.06], "steel", r=[TILT, 0, 0], tex="brushed")
    m.box(on(0, 0.04, 0.5), [1.9, 0.026, 0.008], "dark", r=[TILT, 0, 0])
    m.box(on(0.75, 0.03, 0.6), [0.3, 0.02, 0.05], "dark", r=[TILT, 0, 0])
    m.cyl(on(0.75, 0.05, 0.6), 0.012, 0.22, "hazard", seg=6, r=[TILT, 0, 90])
    # The rolls along the back.
    m.cyl(on(-0.3, 0.065, -0.45), 0.08, 0.9, "hazard", seg=10, r=[TILT, 0, 90])
    m.cyl(on(0.28, 0.06, -0.45), 0.07, 0.6, "cream", seg=8, r=[TILT, 0, 90])
    m.cyl(on(0.62, 0.055, -0.36), 0.06, 0.4, "white", seg=8, r=[TILT, 30, 90])


build("blueprint_table", fp)
