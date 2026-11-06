# The grow light (#365), first person: two wall brackets with bent arms holding a long fixture, heat-
# sink fins along its top, a recessed panel of glowing grow LEDs underneath, end caps and a cable
# looping back to the wall. Run: blender -b --factory-startup -P models/grow_light.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for x in (-0.6, 0.6):
        m.box([x, 0.08, 0.012], [0.08, 0.12, 0.024], "dark", bevel=0.008, edges="vertical", omit=("back",))
        m.sweep([(x, 0.08, 0.02), (x, 0.09, 0.12), (x, 0.11, 0.2), (x, 0.11, 0.24)], 0.025, "metal", seg=5, smooth=2, tex="brushed")
    body = m.box([0, 0.065, 0.3], [1.44, 0.07, 0.14], "dark", tex="brushed")
    m.inset(m.side(body, "bottom"), 0.015, 0.008, "grow", glow=True)
    m.inset(m.split(m.side(body, "top")[0], 12, "right"), 0.006, -0.012)
    for x in (-0.73, 0.73):
        m.box([x, 0.065, 0.3], [0.03, 0.09, 0.15], "metal", bevel=0.006, edges="all")
    m.sweep([(0.73, 0.08, 0.32), (0.75, 0.1, 0.3), (0.74, 0.12, 0.15), (0.7, 0.1, 0.03), (0.66, 0.05, 0.01)], 0.015, "rubber", seg=4, smooth=2, caps=False)


build("grow_light", fp)
