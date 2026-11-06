# The whiteboard (#365), first person: a white board in a brushed steel frame with sketches and notes
# on it, sticky notes in yellow and green, a marker tray with two markers and an eraser.
# Run: blender -b --factory-startup -P models/whiteboard.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    frame = m.box([0, 0.5, 0], [1.6, 1.0, 0.03], "steel", omit=("back",), tex="brushed")
    m.inset(m.side(frame, "front"), 0.03, 0.006, "white")
    for (x, y, w, r, c) in ((-0.45, 0.8, 0.5, 0, "blueprint"), (-0.5, 0.72, 0.4, 0, "blueprint"), (-0.42, 0.64, 0.55, 0, "fire"),
            (0.35, 0.3, 0.6, 0, "blueprint"), (0.05, 0.5, 0.3, -30, "dark"), (-0.4, 0.35, 0.3, 15, "blueprint"), (-0.25, 0.3, 0.2, -20, "blueprint")):
        m.box([x, y, 0.011], [w, 0.012, 0.003], c, r=[0, 0, r], omit=("back",))
    ring = [(0.3 + 0.12 * math.cos(a / 10 * math.tau), 0.62 + 0.09 * math.sin(a / 10 * math.tau), 0.012) for a in range(11)]
    m.sweep(ring, 0.01, "fire", seg=3, smooth=1, caps=False)
    for (x, y, c, r) in ((0.6, 0.82, "power", 4), (0.48, 0.8, "leaf", -6), (0.6, 0.68, "power", -3)):
        m.box([x, y, 0.012], [0.09, 0.09, 0.003], c, r=[0, 0, r], omit=("back",))
    m.box([0, 0.02, 0.04], [1.4, 0.03, 0.08], "steel", omit=("back",), tex="brushed")
    m.box([0, 0.04, 0.078], [1.4, 0.02, 0.006], "steel", omit=("back",))
    for x, c in ((-0.3, "blueprint"), (-0.18, "fire")):
        m.cyl([x, 0.05, 0.05], 0.022, 0.13, c, seg=6, r=[0, 0, 90])
    m.box([0.3, 0.06, 0.05], [0.14, 0.04, 0.05], "dark", bevel=0.008, edges="upper")
    m.box([0.3, 0.035, 0.05], [0.14, 0.012, 0.05], "felt")


build("whiteboard", fp)
