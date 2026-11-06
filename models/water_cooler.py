# The water cooler (#366), first person: a white cabinet with rounded corners, a dark recess with a cold
# and a hot paddle over a perforated drip tray, a ribbed bottle upside down on top, and a clear tube of
# stacked paper cups on its side.
# Run: blender -b --factory-startup -P models/water_cooler.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([-0.05, 0.5, 0], [0.4, 1.0, 0.4], "white", bevel=0.03, seg=2, edges="vertical", omit=("bottom",))
    m.box([-0.05, 0.78, 0.195], [0.24, 0.16, 0.012], "dark", omit=("back",))
    for x, c in ((-0.1, "water"), (0.0, "red")):
        m.box([x, 0.82, 0.21], [0.04, 0.05, 0.025], c, bevel=0.008, seg=1, edges="vertical", omit=("back",))
    m.box([-0.05, 0.71, 0.21], [0.2, 0.012, 0.05], "steel", omit=("back",), tex="perforated")
    m.box([-0.05, 0.3, 0.205], [0.3, 0.3, 0.008], "white", omit=("back",))
    m.box([-0.05, 0.25, 0.21], [0.2, 0.012, 0.004], "metal", omit=("back",), tex="perforated")
    # The bottle.
    m.cyl([-0.05, 1.02, 0], 0.24, 0.04, "dark", seg=12)
    m.lathe([-0.05, 1.04, 0], [(0.03, 0.0), (0.05, 0.03), (0.14, 0.09), (0.16, 0.13), (0.16, 0.22), (0.152, 0.23), (0.16, 0.24), (0.16, 0.36), (0.13, 0.43), (0.0, 0.45)], "water", seg=12)
    # The cup tube on the side.
    m.box([0.2, 0.92, 0], [0.1, 0.04, 0.06], "dark")
    m.cyl([0.28, 0.9, 0], 0.09, 0.26, "mirror", seg=10, caps=False)
    m.lathe([0.28, 0.76, 0], [(0.03, 0.0), (0.04, 0.04), (0.035, 0.3), (0.0, 0.3)], "white", seg=8)
    m.cyl([0.28, 0.77, 0], 0.1, 0.02, "dark", seg=10)


build("water_cooler", fp)
