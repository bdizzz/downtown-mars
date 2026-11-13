# The wide painting (#364), first person: a long moulded fibre-composite frame round a cream mat,
# and a panorama in relief: a sky in the room's colour, rust mesas with flat tops, a green band of
# farm domes along the valley floor, and a white moon. Run: blender -b --factory-startup -P models/painting_wide.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    frame = m.box([0, 0.45, 0], [1.8, 0.9, 0.04], "fibre", omit=("back",), tex="grain")
    m.inset(m.side(frame, "front"), 0.06, 0.012)
    m.box([0, 0.45, 0.012], [1.66, 0.76, 0.004], "cream", omit=("back",))
    m.box([0, 0.62, 0.016], [1.58, 0.34, 0.004], "accent", omit=("back",))
    # Mesas: flat-topped, sloping sides, two layers.
    for x, w, h, z in ((-0.45, 0.6, 0.3, 0.02), (0.3, 0.5, 0.24, 0.02), (-0.05, 0.7, 0.16, 0.026), (0.55, 0.4, 0.12, 0.026)):
        m.box([x, 0.2 + h / 2, z], [w, h, 0.004], "rust", taper=[0.7, 1.0], omit=("back",))
    # The valley floor: a band of fields and a row of farm domes.
    m.box([0, 0.18, 0.03], [1.58, 0.1, 0.004], "plant", omit=("back",))
    for x in (0.25, 0.4, 0.55):
        m.lathe([x, 0.2, 0.032], [(0.05, 0.0), (0.04, 0.03), (0.0, 0.045)], "white", seg=6, r=[90, 0, 0])
    m.cyl([-0.55, 0.68, 0.02], 0.12, 0.006, "white", seg=12, r=[90, 0, 0])


build("painting_wide", fp)
