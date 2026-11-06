# The safety sign (#365), first person: a hazard-yellow plate with a recessed border, the warning
# symbol as a dark diamond with an exclamation mark, a label strip and four screws.
# Run: blender -b --factory-startup -P models/safety_sign.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    plate = m.box([0, 0.3, 0.0], [0.6, 0.6, 0.02], "hazard", omit=("back",))
    m.inset(m.side(plate, "front"), 0.025, 0.004)
    m.box([0, 0.33, 0.006], [0.34, 0.34, 0.004], "dark", r=[0, 0, 45], omit=("back",))
    m.box([0, 0.33, 0.009], [0.27, 0.27, 0.004], "hazard", r=[0, 0, 45], omit=("back",))
    m.box([0, 0.36, 0.012], [0.035, 0.12, 0.004], "dark", taper=[1.3, 1], omit=("back",))
    m.cyl([0, 0.27, 0.012], 0.04, 0.004, "dark", seg=8, r=[90, 0, 0])
    m.box([0, 0.08, 0.006], [0.4, 0.06, 0.004], "dark", omit=("back",))
    for x in (-0.1, 0.0, 0.1):
        m.box([x, 0.08, 0.009], [0.07, 0.015, 0.003], "hazard", omit=("back",))
    for x in (-0.26, 0.26):
        for y in (0.04, 0.56):
            m.cyl([x, y, 0.012], 0.022, 0.006, "steel", seg=6, r=[90, 0, 0])


build("safety_sign", fp)
