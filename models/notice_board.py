# The notice board (#365), first person: a cork board in a fibre-composite frame with notices pinned
# up: a schedule in a grid, a coloured flyer, a photograph, a curling cream sheet, and round pins.
# Run: blender -b --factory-startup -P models/notice_board.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    frame = m.box([0, 0.4, 0], [1.2, 0.8, 0.04], "fibre", omit=("back",), tex="grain")
    m.inset(m.side(frame, "front"), 0.05, 0.01, "composite", tex="fabric")
    sheet = m.box([-0.33, 0.52, 0.012], [0.3, 0.32, 0.003], "white", omit=("back",))
    m.inset(m.split(m.side(sheet, "front")[0], 4, "top"), 0.012, 0.0, "cream")
    m.box([0.0, 0.5, 0.012], [0.24, 0.26, 0.003], "power", r=[0, 0, -3], omit=("back",))
    m.box([0.0, 0.56, 0.015], [0.18, 0.06, 0.002], "accent", r=[0, 0, -3], omit=("back",))
    m.box([0.32, 0.56, 0.012], [0.22, 0.17, 0.003], "white", r=[0, 0, 5], omit=("back",))
    m.box([0.32, 0.565, 0.014], [0.19, 0.12, 0.002], "blueprint", r=[0, 0, 5], omit=("back",))
    m.strip([(-0.42, 0.012), (-0.25, 0.012), (-0.2, 0.03)], 0.1, 0.32, 0.003, "cream")
    m.box([0.2, 0.22, 0.012], [0.3, 0.2, 0.003], "grow", r=[0, 0, 1], omit=("back",))
    for (x, y, c) in ((-0.33, 0.67, "red"), (0.0, 0.62, "blueprint"), (0.32, 0.64, "plant"), (-0.32, 0.31, "power"), (0.2, 0.31, "red")):
        m.lathe([x, y, 0.014], [(0.0, 0.0), (0.016, 0.004), (0.016, 0.012), (0.0, 0.016)], c, seg=6, r=[90, 0, 0])


build("notice_board", fp)
