# The crystal puller (#365), first person: a dark base, a turned steel crucible chamber, a glass
# viewing tube with a glowing silicon boule growing inside, a pull chamber and its cable on top,
# cooling lines, and a control cabinet in the room's colour with a glowing screen.
# Run: blender -b --factory-startup -P models/crystal_puller.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.lathe([0, 0.0, 0], [(0.6, 0.0), (0.6, 0.75), (0.5, 0.8), (0.46, 0.8)], "dark", seg=12, tex="tread")
    m.lathe([0, 0.8, 0], [(0.46, 0.0), (0.46, 0.45), (0.35, 0.6), (0.27, 0.62)], "steel", seg=12, tex="brushed")
    for a in range(0, 360, 60):
        r = math.radians(a + 30)
        m.cyl([0.25 * math.cos(r), 2.0, 0.25 * math.sin(r)], 0.035, 1.16, "metal", seg=4, caps=False, tex="brushed")
    for y in (1.4, 2.58):
        m.lathe([0, y, 0], [(0.29, 0.0), (0.29, 0.06)], "metal", seg=12, caps=False)
    m.lathe([0, 1.55, 0], [(0.0, 0.0), (0.06, 0.04), (0.09, 0.15), (0.09, 0.62), (0.03, 0.72), (0.015, 0.95)], "board", seg=8, glow=True)
    m.lathe([0, 2.64, 0], [(0.3, 0.0), (0.3, 0.55), (0.18, 0.68), (0.06, 0.72), (0.0, 0.72)], "metal", seg=12, tex="brushed")
    m.cyl([0, 3.6, 0], 0.08, 0.6, "metal", seg=6, caps=False)
    m.lathe([0, 3.86, 0], [(0.0, 0.0), (0.1, 0.0), (0.1, 0.04), (0.0, 0.04)], "dark", seg=8)
    m.sweep([(0.3, 2.9, 0.1), (0.5, 2.8, 0.2), (0.55, 1.5, 0.25), (0.55, 1.0, 0.25)], 0.05, "copper", seg=4, smooth=2, caps=False)
    m.sweep([(0.3, 2.95, -0.1), (0.5, 2.85, -0.2), (0.58, 1.5, -0.25), (0.58, 1.0, -0.25)], 0.05, "blueprint", seg=4, smooth=2, caps=False)
    cab = m.box([0.75, 1.0, 0], [0.3, 1.6, 0.6], "accent", omit=("bottom",), tex="grain")
    m.inset(m.side(cab, "right"), 0.04, 0.01)
    m.box([0.905, 1.3, 0], [0.012, 0.3, 0.4], "glow", glow=True)
    for k in range(3):
        m.box([0.905, 0.95 - 0.1 * k, -0.1], [0.012, 0.05, 0.08], "power" if k else "red")


build("crystal_puller", fp)
