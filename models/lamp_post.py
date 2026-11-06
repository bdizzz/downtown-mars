# The lamp post (#366), first person: a turned plinth with mouldings, a tapering post with collars, a
# scrolled arm out to a lantern: a dark hood over a glowing globe, with a finial on top.
# Run: blender -b --factory-startup -P models/lamp_post.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.lathe([0, 0, 0], [(0.2, 0.0), (0.2, 0.05), (0.16, 0.08), (0.13, 0.1), (0.13, 0.3), (0.09, 0.34), (0.0, 0.34)], "dark", seg=10)
    m.cyl([0, 1.5, 0], 0.09, 2.36, "dark", seg=8, d2=0.06)
    for y in (0.36, 1.2, 2.6):
        m.lathe([0, y, 0], [(0.06, 0.0), (0.075, 0.02), (0.075, 0.04), (0.055, 0.06)], "metal", seg=8, caps=False, tex="brushed")
    m.lathe([0, 2.68, 0], [(0.04, 0.0), (0.05, 0.05), (0.0, 0.14)], "dark", seg=8)
    # The arm, with a scroll under it.
    m.sweep([(0.0, 2.6, 0.0), (0.15, 2.7, 0.0), (0.32, 2.78, 0.0), (0.4, 2.76, 0.0)], 0.04, "dark", seg=6, smooth=3)
    m.sweep([(0.03, 2.4, 0.0), (0.12, 2.52, 0.0), (0.14, 2.62, 0.0), (0.09, 2.6, 0.0)], 0.022, "dark", seg=5, smooth=2)
    # The lantern.
    m.lathe([0.4, 2.47, 0], [(0.0, 0.0), (0.09, 0.03), (0.13, 0.1), (0.12, 0.2), (0.07, 0.24), (0.0, 0.25)], "lamp", seg=10, glow=True)
    m.lathe([0.4, 2.66, 0], [(0.17, 0.0), (0.17, 0.015), (0.12, 0.06), (0.04, 0.09), (0.02, 0.12), (0.0, 0.14)], "dark", seg=10, caps=False)
    m.lathe([0.4, 2.66, 0], [(0.16, 0.0), (0.04, 0.08)], "dark", seg=10, caps=False)


build("lamp_post", fp)
