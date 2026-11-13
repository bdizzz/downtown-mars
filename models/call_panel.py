# The call panel (#367), first person: a brushed post on a turned foot, and on it a dark panel with
# rounded edges: a glowing floor display, round up and down buttons in lit rings with arrows, a
# perforated speaker grille and a raised strip of braille dots.
# Run: blender -b --factory-startup -P models/call_panel.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.lathe([0, 0, 0], [(0.0, 0.0), (0.1, 0.0), (0.1, 0.015), (0.07, 0.035), (0.05, 0.06), (0.0, 0.06)], "metal", seg=12, tex="brushed")
    m.box([0, 0.65, -0.02], [0.08, 1.2, 0.08], "metal", bevel=0.015, seg=2, edges="vertical", omit=("bottom", "top"), tex="brushed")
    m.box([0, 1.35, -0.01], [0.34, 0.5, 0.1], "dark", bevel=0.02, seg=2, edges="all")
    zf = 0.04
    m.box([0, 1.53, zf], [0.2, 0.08, 0.004], "panel", omit=("back",))
    m.box([0, 1.53, zf + 0.003], [0.16, 0.055, 0.003], "glow", glow=True, omit=("back",))
    for k in range(2):
        m.box([-0.025 + 0.05 * k, 1.53, zf + 0.005], [0.03, 0.04, 0.002], "board", omit=("back",))
    for y, c, up in ((1.42, "glow", True), (1.3, "fire", False)):
        m.lathe([0, y, zf - 0.002], [(0.05, 0.0), (0.05, 0.006), (0.04, 0.008), (0.0, 0.008)], "steel", seg=12, r=[90, 0, 0], caps=False, tex="brushed")
        m.lathe([0, y, zf + 0.006], [(0.04, 0.0), (0.038, 0.006), (0.0, 0.008)], c, glow=True, seg=12, r=[90, 0, 0], caps=False)
        tip = 0.018 if up else -0.018
        m.box([0, y + tip * 0.2, zf + 0.015], [0.006, 0.03, 0.003], "white", glow=True, omit=("back",))
        for sx in (-1, 1):
            m.box([sx * 0.008, y + tip * 0.55, zf + 0.015], [0.006, 0.02, 0.003], "white", glow=True, omit=("back",), r=[0, 0, -sx * 40 if up else sx * 40])
    m.box([0, 1.18, zf], [0.18, 0.06, 0.004], "metal", omit=("back",), tex="perforated")
    for k in range(6):
        m.cyl([0.13, 1.44 - 0.03 * k, zf + 0.002], 0.008, 0.004, "steel", seg=4, r=[90, 0, 0])


build("call_panel", fp)
