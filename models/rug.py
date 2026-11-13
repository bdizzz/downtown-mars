# The rug (#364), first person: a woven rug with a soft edge, a band in the room's colour round a
# plain middle, a diamond at its heart, and a fringe of tassels at each end.
# Run: blender -b --factory-startup -P models/rug.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.008, 0], [2.2, 0.016, 1.68], "cushion", bevel=0.006, edges="upper", omit=("bottom",), tex="fabric")
    m.box([0, 0.0165, 0], [1.9, 0.002, 1.36], "accent", omit=("bottom",), tex="fabric")
    m.box([0, 0.018, 0], [1.56, 0.002, 1.02], "cushion", omit=("bottom",), tex="fabric")
    m.box([0, 0.0195, 0], [0.42, 0.002, 0.42], "accent", r=[0, 45, 0], omit=("bottom",), tex="fabric")
    m.box([0, 0.021, 0], [0.2, 0.002, 0.2], "cream", r=[0, 45, 0], omit=("bottom",), tex="fabric")
    # The fringe: tassels along each end.
    for sx in (-1, 1):
        for k in range(12):
            z = -0.77 + k * 0.14
            m.box([sx * 1.14, 0.004, z], [0.08, 0.008, 0.035], "cream", r=[0, (k % 3 - 1) * 8, 0], omit=("bottom",), tex="fabric")


build("rug", fp)
