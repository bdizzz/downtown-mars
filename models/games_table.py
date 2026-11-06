# The games table (#366), first person: a pool table: a grained body with an inset apron on four turned
# legs, a felt bed inside cushioned rails with white sights, six leather-lined pockets, a racked
# triangle of balls in cream and red, the white ball, a tapered cue lying across, and a cube of chalk.
# Run: blender -b --factory-startup -P models/games_table.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def ball(m, x, z, c):
    m.lathe([x, 0.8, z], [(0.0, 0.0), (0.026, 0.015), (0.026, 0.045), (0.0, 0.06)], c, seg=5)


def fp(m):
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.lathe([sx * 1.02, 0, sz * 0.52], [(0.07, 0.0), (0.05, 0.06), (0.06, 0.25), (0.045, 0.5), (0.065, 0.66)], "fibre", seg=6, caps=False, tex="grain")
    body = m.box([0, 0.72, 0], [2.36, 0.12, 1.36], "fibre", omit=("top",), tex="grain")
    for s in ("front", "back"):
        m.inset(m.side(body, s), 0.03, 0.01)
    m.box([0, 0.785, 0], [2.2, 0.01, 1.2], "felt", omit=("bottom",), tex="fabric")
    # The rails, sights and pockets.
    for sz in (-1, 1):
        m.box([0, 0.815, sz * 0.65], [2.4, 0.07, 0.1], "composite", bevel=0.015, edges="top", omit=("bottom",), tex="grain")
        m.box([0, 0.8, sz * 0.59], [2.04, 0.04, 0.03], "felt", omit=("bottom",))
        m.box([0, 0.851, sz * 0.66], [0.02, 0.002, 0.02], "white", omit=("bottom",))
    for sx in (-1, 1):
        m.box([sx * 1.15, 0.815, 0], [0.1, 0.07, 1.2], "composite", bevel=0.015, edges="top", omit=("bottom",), tex="grain")
        m.box([sx * 1.09, 0.8, 0], [0.03, 0.04, 1.06], "felt", omit=("bottom",))
    for x in (-1.08, 0.0, 1.08):
        for sz in (-1, 1):
            m.lathe([x, 0.79, sz * 0.58], [(0.05, 0.0), (0.065, 0.062), (0.052, 0.062), (0.0, 0.02)], "rubber", seg=6, caps=False)
    # The balls, the cue and the chalk.
    for row in range(4):
        for k in range(row + 1):
            ball(m, 0.5 + 0.052 * row, (k - row / 2) * 0.054, "red" if (row + k) % 2 else "cream")
    ball(m, -0.6, 0.1, "white")
    m.cyl([-0.2, 0.86, -0.25], 0.03, 1.4, "composite", seg=6, d2=0.014, r=[0, 12, 89], tex="grain")
    m.box([-0.6, 0.865, 0.64], [0.025, 0.025, 0.025], "blueprint", omit=("bottom",))


build("games_table", fp)
