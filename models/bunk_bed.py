# The bunk bed (#357): a steel frame, two soft mattresses in the room's colour with cream
# blankets turned down over the front, pillows, a top rail, a ladder at the foot and a curtain
# half drawn on the lower bunk. Run: blender -b --factory-startup -P models/bunk_bed.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build

BUNKS = (0.34, 1.24)  # the frames' heights


def near(m):
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 0.96, 0.95, sz * 0.43], [0.06, 1.9, 0.06], "metal", omit=("bottom", "top"))
    for y in BUNKS:
        m.box([0, y, 0], [1.98, 0.06, 0.92], "dark", omit=("bottom",) if y < 1 else ())
        m.box([0, y + 0.1, 0], [1.88, 0.14, 0.84], "accent", bevel=0.04, seg=2, edges="top", omit=("bottom",))
        # The blanket over the foot two-thirds, and where it hangs down the front.
        m.box([0.25, y + 0.18, 0.01], [1.3, 0.025, 0.86], "cream", omit=("bottom",))
        m.box([0.25, y + 0.1, 0.44], [1.3, 0.16, 0.025], "cream", omit=("back", "bottom"))
        m.box([-0.74, y + 0.22, 0], [0.34, 0.1, 0.58], "white", bevel=0.035, seg=2, edges="top", omit=("bottom",))
    m.box([0.1, 1.62, 0.43], [1.4, 0.05, 0.04], "metal", omit=("left", "right"))
    for x in (0.72, 0.9):
        m.box([x, 0.95, 0.48], [0.04, 1.8, 0.04], "metal", omit=("bottom", "top"))
    for y in (0.62, 0.95, 1.28):
        m.box([0.81, y, 0.48], [0.14, 0.03, 0.03], "metal", omit=("left", "right"))
    # The curtain: a sheet in soft folds, hung from the top bunk.
    folds = [(-0.92 + i * 0.12, 0.47 + (0.025 if i % 2 else -0.015)) for i in range(7)]
    m.strip(folds, 0.42, 1.2, 0.015, "accent")


def far(m):
    for sx in (-1, 1):
        m.box([sx * 0.96, 0.95, 0], [0.06, 1.9, 0.92], "metal", omit=("bottom",))
    for y in BUNKS:
        m.box([0, y + 0.06, 0], [1.88, 0.18, 0.84], "accent", omit=("bottom",))
        m.box([0.25, y + 0.17, 0.03], [1.3, 0.04, 0.84], "cream", omit=("bottom",))


build("bunk_bed", near, far)
