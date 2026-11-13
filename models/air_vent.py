# The air vent (#364), first person: a steel frame with a screw in each corner, a dark
# duct behind, and angled louvres across it. Run: blender -b --factory-startup -P models/air_vent.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    frame = m.box([0, 0.18, 0.0], [0.7, 0.36, 0.025], "steel", omit=("back",), tex="brushed")
    m.inset(m.side(frame, "front"), 0.05, 0.02, "dark")
    for k in range(6):
        m.box([0, 0.06 + k * 0.048, 0.0], [0.6, 0.035, 0.006], "metal", r=[35, 0, 0], tex="brushed")
    for sx in (-1, 1):
        for y in (0.03, 0.33):
            m.cyl([sx * 0.32, y, 0.014], 0.014, 0.004, "dark", seg=6, r=[90, 0, 0])


build("air_vent", fp)
