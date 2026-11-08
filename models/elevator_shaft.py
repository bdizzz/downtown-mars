# The elevator shaft (#367), first person, with no car waiting: brushed corner posts, a dark back wall
# with two guide rails on brackets, frosted side panes in frames, accent sills at the landing, a hazard
# tread floor, the hoist cables hanging down and a counterweight on its own rails at the back.
# Run: blender -b --factory-startup -P models/elevator_shaft.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build
from _shaft import shaft


def fp(m):
    shaft(m)
    m.box([0, 2.6, -0.95], [0.6, 1.2, 0.16], "metal", bevel=0.02, edges="vertical", tex="brushed")
    for y in (2.1, 2.4, 2.7, 3.0):
        m.box([0, y, -0.865], [0.56, 0.02, 0.01], "dark", omit=("back",))
    for x in (-0.12, 0.0, 0.12):
        m.cyl([x, 3.6, -0.95], 0.02, 0.8, "dark", seg=4, caps=False)
    m.box([0, 0.08, 0.0], [0.5, 0.1, 0.5], "rubber", omit=("bottom",))
    m.box([0, 0.08, -0.9], [0.4, 0.1, 0.3], "rubber", omit=("bottom",))


build("elevator_shaft", fp)
