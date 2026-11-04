# The sofa (#357; first person since #360): a deep fibre-composite frame in the room's colour, two soft seat cushions,
# a rounded back and arms, and a cream throw pillow. Run: blender -b --factory-startup -P models/sofa.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.2, 0], [2.0, 0.4, 0.9], "accent", bevel=0.05, edges="upper", omit=("bottom",))
    m.box([0, 0.73, -0.36], [1.74, 0.56, 0.18], "accent", bevel=0.07, seg=2, edges="top", omit=("bottom",))
    for sx in (-1, 1):
        m.box([sx * 0.92, 0.52, 0.03], [0.17, 0.3, 0.84], "accent", bevel=0.06, seg=2, edges="top", omit=("bottom",))
    for x in (-0.42, 0.42):
        m.box([x, 0.47, 0.06], [0.82, 0.14, 0.74], "cushion", bevel=0.05, seg=2, edges="top", omit=("bottom",))
    m.box([-0.55, 0.72, -0.22], [0.36, 0.3, 0.1], "cream", bevel=0.04, edges="all", r=[-15, 8, 0])
    for sx in (-1, 1):  # short feet
        m.box([sx * 0.88, 0.02, 0.32], [0.08, 0.04, 0.08], "dark", omit=("top", "bottom"))


build("sofa", fp)
