# The memorial niches (#367), first person: a stone wall of fifteen niches in five columns, each a deep
# dark recess with a copper name plate at its foot, on a plinth with a cornice in the room colour and
# a copper inscription band; a few niches hold a small vase of flowers or a candle.
# Run: blender -b --factory-startup -P models/niche_wall.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build

Z = 0.12  # the wall's front


def fp(m):
    # The plinth, the side piers and the band over the niches.
    m.box([0, 0.15, -0.05], [3.06, 0.3, 0.4], "stone", bevel=0.02, edges="top", omit=("bottom", "back"))
    for x in (-1.44, 1.44):
        m.box([x, 1.25, -0.06], [0.18, 1.9, 0.36], "stone", omit=("back", "bottom", "top"))
    m.box([0, 2.3, -0.06], [3.06, 0.4, 0.36], "stone", omit=("back", "bottom"))
    m.box([0, 2.3, Z + 0.003], [1.6, 0.08, 0.006], "copper", omit=("back",), tex="brushed")
    for k in range(5):
        m.box([-0.6 + 0.3 * k, 2.3, Z + 0.008], [0.2, 0.025, 0.004], "dark", omit=("back",))
    m.box([0, 2.55, -0.05], [3.1, 0.1, 0.4], "accent", bevel=0.015, edges="all")
    # Five columns, each cut into three niches.
    for c in range(5):
        x = -1.1 + 0.55 * c
        col = m.box([x, 1.2, -0.06], [0.55, 1.8, 0.36], "stone", omit=("back", "bottom", "top"))
        niches = m.split(m.side(col, "front")[0], 3, "top")
        m.inset(niches, 0.05, 0.16, c="dark")
        for r in range(3):
            y = 0.35 + 0.6 * r
            m.box([x, y + 0.06, Z - 0.05], [0.18, 0.05, 0.008], "copper", omit=("back",), tex="brushed")
    # Offerings in a few niches: vases with flowers, a candle.
    for x, y in ((-1.1, 0.95), (0.55, 0.35)):
        m.lathe([x - 0.12, y + 0.0, Z - 0.12], [(0.0, 0.0), (0.03, 0.0), (0.04, 0.05), (0.02, 0.1), (0.025, 0.12), (0.0, 0.12)], "white", seg=6)
        for k in range(3):
            m.blade([x - 0.12, y + 0.11, Z - 0.12], 60 + 120 * k, 65, 0.12, 0.03, "leaf", droop=0.03, seg=1)
            m.lathe([x - 0.12 + 0.03 * (k - 1), y + 0.2 + 0.02 * (k % 2), Z - 0.12], [(0.0, 0.0), (0.025, 0.01), (0.0, 0.025)], "flower" if k != 1 else "red", seg=5, caps=False)
    for x, y in ((-0.55, 0.95), (1.1, 1.55)):
        m.lathe([x + 0.12, y, Z - 0.12], [(0.0, 0.0), (0.03, 0.0), (0.03, 0.01), (0.022, 0.01), (0.022, 0.09), (0.0, 0.09)], "cream", seg=6)
        m.lathe([x + 0.12, y + 0.09, Z - 0.12], [(0.0, 0.0), (0.012, 0.015), (0.0, 0.045)], "fire", glow=True, seg=5, caps=False)


build("niche_wall", fp)
