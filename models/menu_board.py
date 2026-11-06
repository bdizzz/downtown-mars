# The menu board (#366), first person: a fibre-composite frame round a dark board, a glowing heading,
# rows of dishes in white with dotted leaders and their prices in amber, a cup and a leaf drawn in
# chalk, and a slim lamp on two arms lighting it from above.
# Run: blender -b --factory-startup -P models/menu_board.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    frame = m.box([0, 0.29, 0], [1.3, 0.58, 0.05], "fibre", omit=("back",), tex="grain")
    m.inset(m.side(frame, "front"), 0.04, 0.012, "board")
    m.box([0, 0.48, 0.016], [0.5, 0.05, 0.004], "power", glow=True, omit=("back",))
    for k in range(5):
        y = 0.39 - 0.065 * k
        m.box([-0.28 + 0.05 * (k % 2), y, 0.015], [0.5 - 0.1 * (k % 2), 0.022, 0.003], "white", omit=("back",))
        m.box([0.18, y - 0.006, 0.015], [0.18, 0.004, 0.002], "cream", omit=("back",))
        m.box([0.4, y, 0.015], [0.1, 0.022, 0.003], "hazard", omit=("back",))
    m.lathe([0.53, 0.4, 0.014], [(0.03, 0.0), (0.038, 0.06), (0.0, 0.06)], "white", seg=6, r=[90, 0, 0])
    m.sweep([(0.565, 0.445, 0.016), (0.59, 0.425, 0.016), (0.565, 0.405, 0.016)], 0.006, "white", seg=3, smooth=2)
    m.blade([0.48, 0.13, 0.016], 0, 50, 0.12, 0.05, "leaf", seg=1, roll=90, thick=0.003)
    # The lamp: two arms out from the top and a glowing bar.
    for x in (-0.4, 0.4):
        m.sweep([(x, 0.56, 0.0), (x, 0.585, 0.03), (x, 0.585, 0.06)], 0.012, "dark", seg=4, smooth=2)
    m.box([0, 0.585, 0.06], [1.0, 0.025, 0.02], "dark")
    m.box([0, 0.571, 0.06], [0.96, 0.004, 0.012], "lamp", glow=True, omit=("top",))


build("menu_board", fp)
