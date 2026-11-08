# The cargo crate (#367), first person: a grained composite crate on skids, its sides and lid recessed
# into panels between corner posts in the room colour, a band round its middle, a hazard label and a
# stencilled code on the front, and a lifting lug at each top corner.
# Run: blender -b --factory-startup -P models/cargo_crate.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build
from _crates import crate


def fp(m):
    crate(m, (0, 0, 0), (1.2, 1.12, 1.2))
    m.box([0, 0.35, 0], [1.22, 0.06, 1.22], "accent", omit=("bottom", "top"))
    for kx in (-1, 1):
        for kz in (-1, 1):
            m.sweep([(kx * 0.52, 1.12, kz * 0.47), (kx * 0.52, 1.17, kz * 0.5), (kx * 0.52, 1.12, kz * 0.53)], 0.03, "steel", seg=5, smooth=2, caps=False, tex="brushed")
    # Straps over the lid.
    for x in (-0.3, 0.3):
        m.box([x, 1.125, 0], [0.06, 0.01, 1.16], "dark", omit=("bottom",))


build("cargo_crate", fp)
