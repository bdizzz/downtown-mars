# The ingot rack (#365), first person: a steel rack of posts and three dark shelves, the copper ingots
# on them stacked crosswise in tapered layers, the way a smelter stacks them to cool.
# Run: blender -b --factory-startup -P models/ingot_rack.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 0.75, 0.65, sz * 0.26], [0.05, 1.3, 0.05], "metal", omit=("bottom",), tex="brushed")
    for y in (0.4, 0.85, 1.2):
        m.box([0, y, 0], [1.56, 0.04, 0.56], "dark", omit=("left", "right"), tex="tread")
    for y in (0.42, 0.87):
        for x in (-0.52, -0.17, 0.18, 0.53):
            m.box([x, y + 0.04, 0.0], [0.3, 0.06, 0.18], "copper", taper=[0.85, 0.75], omit=("bottom",), tex="brushed")
        for x in (-0.6, -0.36, -0.12, 0.12, 0.36, 0.6):
            m.box([x, y + 0.1, 0.0], [0.12, 0.06, 0.32], "copper", taper=[0.75, 0.85], omit=("bottom",), tex="brushed")
    for x in (-0.4, 0.0, 0.4):
        m.box([x, 1.25, 0.0], [0.3, 0.06, 0.18], "copper", taper=[0.85, 0.75], omit=("bottom",), tex="brushed")
    m.box([0, 0.06, 0], [1.4, 0.12, 0.5], "dark", omit=("bottom",))


build("ingot_rack", fp)
