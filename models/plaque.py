# The plaque (#367), first person: a brushed copper plate with a rounded edge, a recessed stone
# panel of raised lettering (a title line and four lines of names), and a domed screw at each corner.
# Run: blender -b --factory-startup -P models/plaque.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.175, -0.012], [0.5, 0.35, 0.026], "copper", bevel=0.006, seg=2, omit=("back",), tex="brushed")
    panel = m.box([0, 0.175, 0.004], [0.42, 0.26, 0.008], "stone", omit=("back", "bottom"))
    m.inset(m.side(panel, "front"), 0.012, 0.003)
    # The title, then names: words of different lengths, raised from the recess.
    rows = [(0.26, 0.018, [0.22]), (0.215, 0.012, [0.09, 0.12]), (0.18, 0.012, [0.13, 0.07]), (0.145, 0.012, [0.06, 0.08, 0.06]), (0.11, 0.012, [0.11, 0.09])]
    for y, h, words in rows:
        gap = 0.02
        total = sum(words) + gap * (len(words) - 1)
        x = -total / 2
        for w in words:
            m.box([x + w / 2, y, 0.0045], [w, h, 0.003], "copper" if h > 0.015 else "dark", omit=("back",))
            x += w + gap
    m.box([0, 0.075, 0.0045], [0.16, 0.004, 0.003], "copper", omit=("back",))
    for sx in (-1, 1):
        for y in (0.03, 0.32):
            m.lathe([sx * 0.22, y, 0.001], [(0.011, 0.0), (0.01, 0.004), (0.006, 0.007), (0.0, 0.008)], "steel", seg=6, r=[90, 0, 0], caps=False)


build("plaque", fp)
