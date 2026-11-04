# The upright piano (#364), first person: a dark case with a fibre-composite lid, a fall board and
# music rest, white keys with raised black keys in twos and threes, turned legs under the keybed,
# two pedals, and a padded bench in front. Run: blender -b --factory-startup -P models/piano.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    case = m.box([0, 0.66, -0.1], [1.5, 1.28, 0.4], "dark", bevel=0.015, edges="vertical", omit=("bottom",))
    m.inset(m.split(m.side(case, "front")[0], 2, "top")[1:], 0.08, 0.01)
    m.box([0, 1.32, -0.1], [1.54, 0.04, 0.44], "fibre", bevel=0.012, omit=("bottom",), tex="grain")
    # The keybed, the keys and the music rest.
    m.box([0, 0.72, 0.16], [1.42, 0.08, 0.3], "dark", bevel=0.01, edges="upper", omit=("bottom",))
    keys = m.box([0, 0.768, 0.2], [1.26, 0.02, 0.17], "white", omit=("bottom", "back"))
    m.split(m.side(keys, "top")[0], 24, "right")
    for k in range(24):
        if k % 7 in (2, 6):
            continue
        x = -0.63 + (k + 1) * 1.26 / 24
        if x > 0.6:
            break
        m.box([x, 0.786, 0.16], [0.028, 0.018, 0.1], "dark", bevel=0.003, edges="top", omit=("bottom", "back"))
    m.box([0, 0.98, 0.04], [0.6, 0.22, 0.02], "dark", r=[-12, 0, 0], omit=("back",))
    # Turned legs, toe blocks, and two pedals.
    for sx in (-1, 1):
        m.lathe([sx * 0.66, 0.0, 0.2], [(0.035, 0.0), (0.03, 0.4), (0.04, 0.55), (0.035, 0.68)], "dark", seg=6, caps=False)
        m.box([sx * 0.66, 0.03, 0.12], [0.07, 0.06, 0.24], "dark", omit=("bottom",))
    for x in (-0.06, 0.06):
        m.box([x, 0.06, 0.12], [0.04, 0.012, 0.1], "copper", bevel=0.004, r=[8, 0, 0], omit=("bottom",))
    # The bench: a padded top on four legs.
    m.soft([0, 0.47, 0.55], [0.9, 0.06, 0.34], "cushion", round=0.6, puff=0.2, cuts=1, tex="quilt")
    m.box([0, 0.425, 0.55], [0.92, 0.04, 0.36], "dark", bevel=0.008, edges="vertical")
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 0.4, 0.2, 0.55 + sz * 0.13], [0.045, 0.41, 0.045], "dark", taper=[0.8, 0.8], omit=("bottom",))


build("piano", fp)
