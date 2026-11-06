# The water dispenser (#366), first person: a white cabinet with rounded corners, a dark recess with
# a cold and a hot tap over a perforated drip tray, a glowing light, a collar and a ribbed bottle of
# water upside down on top.
# Run: blender -b --factory-startup -P models/water_dispenser.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.5, 0], [0.38, 1.0, 0.36], "white", bevel=0.03, seg=2, edges="vertical", omit=("bottom",))
    m.box([0, 0.73, 0.175], [0.22, 0.18, 0.012], "dark", omit=("back",))
    for x, c in ((-0.05, "water"), (0.05, "red")):
        m.box([x, 0.79, 0.19], [0.04, 0.04, 0.03], c, omit=("back",))
        m.cyl([x, 0.76, 0.2], 0.018, 0.04, "steel", seg=6)
    m.box([0, 0.65, 0.19], [0.2, 0.012, 0.05], "steel", omit=("back",), tex="perforated")
    m.cyl([0.13, 0.88, 0.186], 0.025, 0.008, "glow", seg=8, r=[90, 0, 0], glow=True)
    m.box([0, 0.04, 0.17], [0.3, 0.06, 0.02], "dark", omit=("back", "bottom"))
    # The collar and the bottle, ribbed.
    m.cyl([0, 1.02, 0], 0.22, 0.04, "dark", seg=12)
    m.lathe([0, 1.04, 0], [(0.03, 0.0), (0.05, 0.03), (0.13, 0.08), (0.15, 0.12), (0.15, 0.2), (0.142, 0.21), (0.15, 0.22), (0.15, 0.3), (0.142, 0.31), (0.15, 0.32), (0.15, 0.36), (0.12, 0.4), (0.0, 0.41)], "water", seg=12)


build("water_dispenser", fp)
