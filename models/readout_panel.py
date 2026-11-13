# The readout panel (#365), first person: a dark housing with a recessed bezel, a glowing screen
# showing a trace and a level meter of four bars, a row of buttons in the room's colour, status lights
# and a vent grille in its side. Run: blender -b --factory-startup -P models/readout_panel.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    body = m.box([0, 0.35, 0.0], [1.2, 0.7, 0.08], "dark", omit=("back",), tex="brushed")
    m.inset(m.side(body, "front"), 0.04, 0.012, "rubber")
    m.inset(m.split(m.side(body, "right")[0], 5, "top"), 0.006, 0.004, "metal")
    m.box([-0.2, 0.41, 0.03], [0.66, 0.46, 0.006], "glow", glow=True, omit=("back",))
    pts = [(-0.5, 0.36), (-0.4, 0.44), (-0.32, 0.38), (-0.22, 0.52), (-0.12, 0.4), (-0.02, 0.47), (0.08, 0.43)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        m.box([(x0 + x1) / 2, (y0 + y1) / 2, 0.034], [L + 0.008, 0.01, 0.003], "white", glow=True, r=[0, 0, math.degrees(math.atan2(y1 - y0, x1 - x0))], omit=("back",))
    m.box([-0.2, 0.25, 0.034], [0.6, 0.006, 0.002], "blueprint", omit=("back",))
    for k, h in enumerate((0.18, 0.3, 0.4, 0.24)):
        m.box([0.24 + 0.075 * k, 0.17 + h / 2, 0.032], [0.05, h, 0.006], "power", glow=True, omit=("back",))
    for k in range(4):
        m.box([-0.44 + 0.13 * k, 0.1, 0.035], [0.09, 0.05, 0.02], "accent", bevel=0.008, edges="upper", omit=("back",))
    for k, c in enumerate(("plant", "power", "red")):
        m.cyl([0.3 + 0.08 * k, 0.1, 0.033], 0.025, 0.012, c, seg=6, r=[90, 0, 0], glow=True)


build("readout_panel", fp)
