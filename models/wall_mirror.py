# The wall mirror (#364), first person: a mirror with rounded corners in a moulded fibre-composite
# frame. Run: blender -b --factory-startup -P models/wall_mirror.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    frame = m.box([0, 0.52, 0], [0.6, 0.96, 0.03], "fibre", bevel=0.06, seg=3, edges="vertical", omit=("back",), tex="grain")
    m.box([0, 0.52, 0.012], [0.52, 0.88, 0.012], "mirror", bevel=0.04, seg=3, edges="vertical", omit=("back",))


build("wall_mirror", fp)
