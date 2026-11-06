# The furnace (#365), first person: a dark steel body with a recessed front, a stone surround round a
# glowing mouth behind a rust door hung on hinges and propped open, a tapping spout, a hood in the
# room's colour, a banded chimney, hazard-striped pillars and a gauge.
# Run: blender -b --factory-startup -P models/furnace.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    body = m.box([0, 1.3, 0], [2.6, 2.6, 2.4], "dark", omit=("bottom",), tex="tread")
    m.inset(m.side(body, "front"), 0.12, 0.04)
    m.box([0, 1.0, 1.18], [1.5, 1.2, 0.08], "stone", omit=("back",))
    mouth = m.box([0, 0.95, 1.2], [1.0, 0.75, 0.06], "stone", omit=("back",))
    m.inset(m.side(mouth, "front"), 0.04, 0.2, "fire", glow=True)
    # The door, raised on its guides by two chains, and the tapping trough with metal glowing in it.
    m.box([0, 1.66, 1.23], [1.0, 0.5, 0.05], "rust", omit=("back",), tex="tread")
    for x in (-0.56, 0.56):
        m.box([x, 1.2, 1.22], [0.08, 1.4, 0.05], "metal", omit=("back",), tex="brushed")
        m.sweep([(x * 0.7, 1.9, 1.24), (x * 0.75, 2.2, 1.23), (x * 0.8, 2.6, 1.0)], 0.025, "dark", seg=3, smooth=2, caps=False)
    trough = m.box([0, 0.5, 1.15], [0.4, 0.1, 0.2], "copper", omit=("bottom",))
    m.inset(m.side(trough, "top"), 0.04, 0.04, "fire", glow=True)
    for x in (-1.0, -0.7, 0.7, 1.0):
        for y in (0.4, 1.0, 1.6, 2.2):
            m.cyl([x, y, 1.2], 0.04, 0.02, "steel", seg=4, caps=False, r=[90, 0, 0])
    m.box([0, 2.7, 0], [2.0, 0.2, 1.8], "accent", taper=[0.85, 0.85], omit=("bottom",), tex="grain")
    m.lathe([0.6, 2.8, -0.4], [(0.25, 0.0), (0.25, 1.15), (0.28, 1.15), (0.28, 1.2), (0.0, 1.2)], "metal", seg=10, tex="brushed")
    for y in (3.2, 3.6):
        m.lathe([0.6, y, -0.4], [(0.27, 0.0), (0.27, 0.06)], "dark", seg=10, caps=False)
    for x in (-1.32, 1.32):
        m.box([x, 1.3, 0.3], [0.06, 2.4, 0.2], "hazard", omit=("bottom",))
    m.cyl([-0.9, 1.9, 1.22], 0.24, 0.05, "steel", seg=10, r=[90, 0, 0])
    m.box([-0.9, 1.9, 1.25], [0.16, 0.16, 0.004], "white", r=[0, 0, 45], omit=("back",))
    m.box([-0.89, 1.91, 1.254], [0.08, 0.012, 0.004], "fire", r=[0, 0, 40], omit=("back",))


build("furnace", fp)
