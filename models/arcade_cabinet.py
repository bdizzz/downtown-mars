# The arcade cabinet (#366), first person: two side panels in the room colour edged in dark trim round
# a lower cabinet with a coin door and two lit slots, a sloped control panel with a ball-top joystick
# and six buttons, a recessed glowing screen behind a bezel, a speaker grille, and a glowing marquee.
# Run: blender -b --factory-startup -P models/arcade_cabinet.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for sx in (-1, 1):
        m.box([sx * 0.36, 1.02, -0.05], [0.03, 2.04, 0.7], "accent", omit=("bottom",))
        m.box([sx * 0.36, 1.02, 0.302], [0.034, 2.04, 0.012], "dark", omit=("back", "bottom"))
    m.box([0, 0.47, -0.05], [0.69, 0.94, 0.66], "accent", omit=("bottom", "top"))
    m.box([0, 0.04, 0.28], [0.69, 0.08, 0.01], "dark", omit=("back",))
    m.box([0, 1.3, -0.33], [0.69, 0.76, 0.04], "dark", omit=("back",))
    # The control panel, joystick and buttons.
    m.box([0, 0.98, 0.17], [0.69, 0.08, 0.3], "dark", r=[15, 0, 0])
    m.box([0, 0.995, 0.18], [0.64, 0.02, 0.24], "blueprint", r=[15, 0, 0], omit=("bottom",))
    m.lathe([-0.18, 1.0, 0.17], [(0.035, 0.0), (0.008, 0.01), (0.008, 0.09), (0.025, 0.1), (0.025, 0.12), (0.0, 0.135)], "red", seg=8)
    for k in range(6):
        x = 0.06 + 0.09 * (k % 3)
        z = 0.13 + 0.08 * (k // 3)
        m.lathe([x, 1.005 - 0.02 * (k // 3), z], [(0.026, 0.0), (0.026, 0.012), (0.02, 0.022), (0.0, 0.024)], ("red", "power", "accent")[k % 3], seg=8)
    # The screen, recessed behind its bezel.
    bezel = m.box([0, 1.3, -0.02], [0.66, 0.54, 0.06], "dark", r=[-15, 0, 0])
    m.inset(m.side(bezel, "front"), 0.05, 0.025, "glow", glow=True)
    for k, c in enumerate(("power", "white", "red")):
        m.box([-0.15 + 0.15 * k, 1.36 - 0.06 * k, 0.0 + 0.016 * k], [0.08, 0.05, 0.004], c, glow=True, r=[-15, 0, 0])
    # The speaker grille and the marquee.
    m.box([0, 1.6, -0.08], [0.69, 0.06, 0.5], "dark", omit=("bottom",))
    m.box([0, 1.632, -0.08], [0.5, 0.004, 0.3], "metal", omit=("bottom",), tex="perforated")
    m.box([0, 1.84, -0.1], [0.69, 0.4, 0.6], "accent")
    mq = m.box([0, 1.85, 0.205], [0.62, 0.24, 0.012], "dark", omit=("back",))
    m.inset(m.side(mq, "front"), 0.015, 0.0, "lamp", glow=True)
    # The coin door.
    m.box([0, 0.5, 0.285], [0.34, 0.36, 0.01], "dark", omit=("back",))
    for x in (-0.07, 0.07):
        m.box([x, 0.56, 0.292], [0.06, 0.09, 0.006], "power", glow=True, omit=("back",))
        m.box([x, 0.56, 0.296], [0.006, 0.05, 0.004], "dark", omit=("back",))
    m.box([0, 0.42, 0.293], [0.06, 0.05, 0.006], "metal", omit=("back",))


build("arcade_cabinet", fp)
