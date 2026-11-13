# The girder stack (#367), first person: nine rusted I-beams in three layers, each layer on dark timber
# bearers, tied with two steel bands, and a tag hanging from the top beam.
# Run: blender -b --factory-startup -P models/girder_stack.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build

L = 3.1  # beam length


def beam(m, y, z):
    """An I-beam 0.2 tall and 0.25 wide, its bottom at y."""
    for fy in (y + 0.0125, y + 0.1875):
        m.box([0, fy, z], [L, 0.025, 0.25], "rust", tex="brushed")
    m.box([0, y + 0.1, z], [L, 0.15, 0.025], "rust", omit=("top", "bottom"), tex="brushed")


def fp(m):
    y = 0.0
    for layer in range(3):
        for x in (-1.2, 1.2):
            m.box([x, y + 0.02, 0], [0.12, 0.04, 1.06], "dark", omit=("bottom",) if layer == 0 else (), tex="grain")
        y += 0.04
        for z in (-0.33, 0, 0.33):
            beam(m, y, z)
        y += 0.2
        if layer < 2:
            y -= 0.01
    # The bands.
    for x in (-0.6, 0.6):
        m.box([x, y + 0.004, 0], [0.04, 0.008, 1.0], "steel", omit=("bottom",))
        for z in (-0.5, 0.5):
            m.box([x, y / 2, z], [0.04, y, 0.008], "steel")
    m.box([0.6, y - 0.1, 0.505], [0.07, 0.06, 0.012], "steel")
    # The tag.
    m.sweep([(-1.0, y, 0.45), (-1.0, y - 0.04, 0.47), (-1.0, y - 0.08, 0.48)], 0.006, "dark", seg=4, smooth=2, caps=False)
    m.box([-1.0, y - 0.13, 0.48], [0.08, 0.1, 0.004], "hazard")


build("girder_stack", fp)
