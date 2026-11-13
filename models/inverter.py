# The inverter cabinet (#365), first person: a pale cabinet on dark feet, its door recessed with a
# louvred vent below and a glowing display above, a hazard stripe and warning plate, a lever handle,
# and a cable gland on top with conduit rising to the ceiling run.
# Run: blender -b --factory-startup -P models/inverter.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    cab = m.box([0, 0.95, 0], [1.0, 1.8, 0.6], "panel", omit=("bottom",), tex="grain")
    m.inset(m.side(cab, "front"), 0.04, 0.012)
    vent = m.box([0, 0.5, 0.29], [0.7, 0.4, 0.01], "panel", omit=("back",))
    m.inset(m.split(m.side(vent, "front")[0], 6, "top"), 0.015, 0.008, "dark")
    m.box([0, 1.45, 0.29], [0.44, 0.24, 0.012], "dark", omit=("back",))
    m.box([0, 1.46, 0.297], [0.38, 0.16, 0.004], "glow", glow=True, omit=("back",))
    m.box([0, 1.15, 0.29], [0.92, 0.05, 0.008], "hazard", omit=("back",))
    m.box([-0.25, 0.92, 0.292], [0.14, 0.12, 0.004], "hazard", omit=("back",))
    m.box([-0.25, 0.92, 0.295], [0.06, 0.06, 0.003], "dark", r=[0, 0, 45], omit=("back",))
    m.box([0.38, 1.0, 0.31], [0.04, 0.2, 0.03], "dark", bevel=0.008, edges="all")
    m.box([0.38, 1.08, 0.33], [0.03, 0.03, 0.03], "steel")
    for x in (-0.42, 0.42):
        m.box([x, 0.025, 0], [0.1, 0.05, 0.56], "dark", omit=("bottom",))
    m.cyl([0.3, 1.88, -0.15], 0.14, 0.06, "dark", seg=8)
    m.cyl([0.3, 1.95, -0.15], 0.1, 0.1, "rubber", seg=8, caps=False)


build("inverter", fp)
