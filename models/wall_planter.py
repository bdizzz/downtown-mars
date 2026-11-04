# The wall planter (#364), first person: a trough in the room's colour with a rolled rim on two dark
# brackets, soil, a row of herbs standing up out of it and a trailing plant spilling over its front
# down the wall. Run: blender -b --factory-startup -P models/wall_planter.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.45, 0.12], [0.78, 0.2, 0.22], "accent", bevel=0.02, seg=2, edges="vertical", omit=("top",), tex="grain")
    m.box([0, 0.555, 0.12], [0.8, 0.02, 0.24], "accent", bevel=0.008, omit=("bottom",))
    m.box([0, 0.545, 0.12], [0.74, 0.01, 0.2], "soil", omit=("bottom",))
    for x in (-0.3, 0.3):
        m.box([x, 0.38, 0.06], [0.03, 0.18, 0.12], "dark", taper=[1.0, 1.6], omit=("back",))
    # Herbs standing up from the soil.
    for i, x in enumerate((-0.28, -0.12, 0.05, 0.22)):
        for k in range(5):
            m.blade([x, 0.55, 0.12], k * 72 + i * 15, 60, 0.18, 0.05, "plant" if (k + i) % 2 else "leaf", droop=0.03, seg=2)
    # A trailing plant spilling over the front, hanging down the wall.
    for i, x in enumerate((-0.2, 0.0, 0.18)):
        m.sweep([(x, 0.55, 0.2), (x + 0.02, 0.56, 0.25), (x + 0.03, 0.4, 0.27), (x + 0.01, 0.12, 0.25)], 0.01, "plant", seg=4, smooth=2)
        for j, y in enumerate((0.45, 0.32, 0.2)):
            m.blade([x + 0.025, y, 0.26], 90 + (50 if j % 2 else -50), -20, 0.07, 0.05, "leaf", seg=2)


build("wall_planter", fp)
