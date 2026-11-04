# The bookshelf (#364), first person: a composite case with a back and five shelves, books on
# them in the room's colour, rust, green and cream: rows of spines of different heights, one
# leaning, a short stack lying flat, a bookend. Run: blender -b --factory-startup -P models/bookshelf.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build

COLOURS = ("accent", "rust", "leaf", "cream")


def fp(m):
    m.box([0, 1.0, -0.185], [1.36, 2.0, 0.03], "composite", omit=("back",), tex="grain")
    for sx in (-1, 1):
        m.box([sx * 0.68, 1.0, 0], [0.04, 2.0, 0.4], "composite", bevel=0.006, edges="vertical", omit=("bottom",), tex="grain")
    for y in (0.05, 0.55, 1.05, 1.55, 1.98):
        m.box([0, y, 0], [1.32, 0.03, 0.38], "composite", omit=("back", "left", "right"), tex="grain")
    # Books: four shelves, each a run of spines in groups, varied in height and width.
    for row, y in enumerate((0.065, 0.565, 1.065, 1.565)):
        x = -0.64
        k = row
        while x < 0.6:
            w = 0.035 + 0.01 * ((k * 7) % 3)
            h = 0.2 + 0.03 * ((k * 5) % 4)
            if (k + row) % 9 == 4 and x < 0.4:
                # A short stack lying flat.
                for j in range(3):
                    m.box([x + 0.11, y + 0.02 + j * 0.04, 0.0], [0.22 - j * 0.02, 0.04, 0.24], COLOURS[(k + j) % 4], omit=("bottom", "back"))
                x += 0.24
            elif (k + row) % 11 == 7:
                m.box([x + 0.06, y + h / 2 - 0.01, 0.0], [w, h, 0.24], COLOURS[k % 4], r=[0, 0, -18], omit=("back",))
                x += 0.1
            else:
                m.box([x + w / 2, y + h / 2, 0.0], [w, h, 0.24], COLOURS[k % 4], omit=("bottom", "back"))
                x += w + 0.004
            k += 1


build("bookshelf", fp)
