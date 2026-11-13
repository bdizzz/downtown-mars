# The crate stack (#367), first person: four crates of different sizes stacked two high, grained
# composite and one in the room colour, with recessed panels, corner posts, hazard labels and codes,
# and a ratchet strap holding the upper left one down.
# Run: blender -b --factory-startup -P models/crate_stack.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build
from _crates import crate


def fp(m):
    crate(m, (-0.62, 0, 0), (1.2, 1.2, 1.2))
    crate(m, (0.62, 0, 0), (1.2, 1.0, 1.15), c="accent", trim="dark")
    crate(m, (-0.55, 1.2, 0), (1.1, 1.19, 1.1), label=False, skids=False)
    crate(m, (0.6, 1.0, 0.05), (0.9, 0.6, 0.9), skids=False, trim="dark")
    # The strap over the upper crate, down to the lower one, with its ratchet.
    m.box([-0.55, 2.395, 0], [0.06, 0.01, 1.12], "hazard", omit=("bottom",))
    for z in (-0.565, 0.565):
        m.box([-0.55, 1.8, z], [0.06, 1.2, 0.01], "hazard")
    m.box([-0.55, 1.6, 0.585], [0.08, 0.14, 0.03], "steel", tex="brushed")


build("crate_stack", fp)
