# The vending machine (#366), first person: a cabinet in the room colour with a glowing header, a deep
# window of four shelves of cans and packets with price strips, a control column with a glowing
# screen, a keypad and a coin slot, a pickup flap at the bottom, and feet.
# Run: blender -b --factory-startup -P models/vending_machine.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    show = m.box([-0.15, 1.04, 0], [0.7, 1.92, 0.8], "accent", omit=("bottom", "right"))
    col = m.box([0.35, 1.04, 0], [0.3, 1.92, 0.8], "accent", omit=("bottom", "left"))
    for x in (-0.45, 0.45):
        m.box([x, 0.04, 0], [0.08, 0.08, 0.7], "dark", omit=("bottom",))
    window = m.inset(m.side(show, "front"), 0.06, 0.22, "dark")
    m.box([-0.15, 1.86, 0.405], [0.6, 0.14, 0.01], "lamp", glow=True, omit=("back",))
    # Four shelves of cans and packets.
    for row in range(4):
        y = 0.62 + 0.3 * row
        m.box([-0.15, y, 0.24], [0.56, 0.015, 0.2], "steel", omit=("bottom",), tex="brushed")
        for k, c in enumerate(("rust", "leaf", "hazard", "power")):
            x = -0.36 + 0.14 * k
            if (row + k) % 2:
                m.lathe([x, y + 0.008, 0.26], [(0.03, 0.0), (0.032, 0.01), (0.032, 0.11), (0.025, 0.12), (0.0, 0.12)], c, seg=6)
            else:
                m.box([x, y + 0.08, 0.26], [0.1, 0.15, 0.03], c, omit=("bottom", "back"))
        m.box([-0.15, y - 0.03, 0.35], [0.56, 0.03, 0.004], "white", omit=("back",))
    # The control column.
    scr = m.box([0.35, 1.45, 0.405], [0.18, 0.14, 0.01], "dark", omit=("back",))
    m.inset(m.side(scr, "front"), 0.012, 0.0, "glow", glow=True)
    for r in range(3):
        for c in range(3):
            m.box([0.3 + 0.05 * c, 1.25 - 0.05 * r, 0.405], [0.035, 0.035, 0.012], "white" if r < 2 else "red", omit=("back",))
    m.box([0.35, 1.05, 0.405], [0.06, 0.1, 0.01], "dark", omit=("back",))
    m.box([0.35, 1.07, 0.411], [0.008, 0.05, 0.004], "power", glow=True, omit=("back",))
    flap = m.box([-0.15, 0.3, 0.405], [0.56, 0.2, 0.01], "dark", omit=("back",))
    m.inset(m.side(flap, "front"), 0.02, 0.0, "metal")


build("vending_machine", fp)
