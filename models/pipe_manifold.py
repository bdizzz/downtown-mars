# The pipe manifold (#365), first person: three pipes, metal, copper and steel, held off the wall in
# clamped brackets, each with a valve and an orange handwheel, a pressure gauge, and elbows turning
# into the wall at both ends. Run: blender -b --factory-startup -P models/pipe_manifold.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for y, c in ((0.12, "metal"), (0.34, "copper"), (0.56, "steel")):
        m.sweep([(-0.75, y, 0.0), (-0.75, y, 0.05), (-0.7, y, 0.1), (0.7, y, 0.1), (0.75, y, 0.05), (0.75, y, 0.0)], 0.09, c, seg=6, smooth=1, caps=False, tex="brushed")
    for x in (-0.6, 0.6):
        m.box([x, 0.34, 0.012], [0.07, 0.68, 0.024], "dark", omit=("back",))
        for y in (0.12, 0.34, 0.56):
            m.box([x, y, 0.155], [0.035, 0.12, 0.02], "dark", bevel=0.008, edges="vertical", omit=("back",))
    for x, y in ((-0.3, 0.12), (0.25, 0.34), (-0.05, 0.56)):
        m.cyl([x, y, 0.1], 0.13, 0.12, "dark", seg=8, r=[0, 0, 90])
        m.cyl([x, y, 0.19], 0.025, 0.1, "steel", seg=6, r=[90, 0, 0])
        ring = [(x + 0.075 * math.cos(a / 8 * math.tau), y + 0.075 * math.sin(a / 8 * math.tau), 0.24) for a in range(9)]
        m.sweep(ring, 0.018, "fire", seg=3, smooth=1, caps=False)
        for a in (0, 90):
            m.box([x, y, 0.24], [0.15, 0.012, 0.012], "fire", r=[0, 0, a])
    m.cyl([0.48, 0.45, 0.13], 0.03, 0.06, "steel", seg=6)
    m.cyl([0.48, 0.47, 0.16], 0.14, 0.04, "steel", seg=10, r=[90, 0, 0], tex="brushed")
    m.box([0.48, 0.47, 0.181], [0.09, 0.09, 0.004], "white", r=[0, 0, 45], omit=("back",))
    m.box([0.49, 0.48, 0.185], [0.05, 0.007, 0.004], "fire", r=[0, 0, 30], omit=("back",))


build("pipe_manifold", fp)
