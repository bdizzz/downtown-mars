# The fireplace (#364), first person: a stone surround in coursed blocks, a dark firebox with a
# grate, logs of fibre composite in it and flames dancing on them, a fibre-composite mantel shelf,
# and two candlesticks in the room's colour on it. Run: blender -b --factory-startup -P models/fireplace.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    # The surround: two piers and a lintel in stone, coursed.
    for sx in (-1, 1):
        pier = m.box([sx * 0.56, 0.55, 0], [0.28, 1.1, 0.4], "stone", bevel=0.01, edges="vertical", omit=("bottom",))
        m.inset(m.split(m.side(pier, "front")[0], 4, "top"), 0.006, 0.004)
    lintel = m.box([0, 0.86, 0], [0.84, 0.48, 0.4], "stone", omit=("bottom", "left", "right"))
    m.inset(m.split(m.side(lintel, "front")[0], 2, "top"), 0.006, 0.004)
    m.box([0, 0.03, 0.1], [1.5, 0.06, 0.32], "stone", bevel=0.01, edges="upper", omit=("bottom",))
    # The firebox, its grate and the logs.
    m.box([0, 0.36, -0.05], [0.84, 0.64, 0.3], "dark", omit=("front", "bottom"))
    for x in (-0.2, 0.0, 0.2):
        m.box([x, 0.12, 0.08], [0.02, 0.06, 0.24], "metal", omit=("bottom",))
    m.box([0, 0.15, 0.08], [0.5, 0.02, 0.22], "metal", omit=("bottom",))
    for x, r in ((-0.12, 10), (0.12, -8), (0.0, 85)):
        m.cyl([x, 0.21, 0.08], 0.08, 0.32, "fibre", seg=7, r=[0, r, 90], tex="grain")
    # The flames: tongues licking up from the logs.
    for i, (x, h, lean) in enumerate(((-0.16, 0.26, -12), (-0.05, 0.36, 4), (0.06, 0.32, -6), (0.17, 0.24, 14))):
        m.lathe([x, 0.2, 0.08 + 0.02 * (i % 2)], [(0.06, 0.0), (0.05, h * 0.4), (0.0, h)], "fire", seg=6, r=[0, 0, lean], glow=True)
    # The mantel and the candlesticks on it.
    m.box([0, 1.12, 0.02], [1.5, 0.06, 0.46], "fibre", bevel=0.015, seg=2, edges="all", tex="grain")
    for x in (-0.5, 0.45):
        m.lathe([x, 1.15, 0], [(0.05, 0.0), (0.05, 0.015), (0.015, 0.03), (0.015, 0.12), (0.035, 0.14), (0.02, 0.15)], "accent", seg=8)
        m.cyl([x, 1.322, 0], 0.03, 0.05, "cream", seg=8)


build("fireplace", fp)
