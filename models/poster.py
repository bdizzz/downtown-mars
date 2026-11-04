# The poster (#364), first person: a print held up by four pins, its bottom corner curling off the
# wall: a block in the room's colour, a big orange disc of a planet, and two lines of type.
# Run: blender -b --factory-startup -P models/poster.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.46, 0.0], [0.6, 0.76, 0.004], "white", omit=("back",))
    # The bottom edge curls off the wall a little.
    m.strip([(-0.3, 0.0), (0.0, 0.0), (0.2, 0.004), (0.3, 0.02)], 0.02, 0.08, 0.004, "white")
    m.box([0, 0.52, 0.003], [0.5, 0.5, 0.002], "accent", omit=("back",))
    m.lathe([0, 0.55, 0.004], [(0.13, 0.0), (0.1, 0.012), (0.0, 0.016)], "power", seg=14, r=[90, 0, 0])
    m.box([0, 0.2, 0.003], [0.44, 0.03, 0.002], "dark", omit=("back",))
    m.box([-0.06, 0.15, 0.003], [0.32, 0.02, 0.002], "dark", omit=("back",))
    for x in (-0.27, 0.27):
        for y in (0.11, 0.81):
            m.cyl([x, y, 0.006], 0.016, 0.008, "red", seg=6, r=[90, 0, 0])


build("poster", fp)
