# The Earth photo (#364), first person: a dark moulded frame round a black print of Earth from
# space: a domed blue globe, green and composite-grey land on it, a streak of white cloud, and the
# Moon small in a corner. Run: blender -b --factory-startup -P models/earth_photo.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    frame = m.box([0, 0.35, 0], [0.7, 0.7, 0.04], "dark", omit=("back",))
    m.inset(m.side(frame, "front"), 0.04, 0.012, "rubber")
    # The globe, gently domed, and its land and cloud.
    m.lathe([0.03, 0.38, 0.008], [(0.21, 0.0), (0.19, 0.01), (0.12, 0.022), (0.0, 0.026)], "blueprint", seg=16, r=[90, 0, 0])
    m.soft([-0.02, 0.44, 0.03], [0.16, 0.12, 0.006], "plant", round=0.9, puff=0.0, cuts=1, r=[0, 0, 20])
    m.soft([0.08, 0.3, 0.03], [0.1, 0.14, 0.006], "composite", round=0.9, puff=0.0, cuts=1, r=[0, 0, -10])
    m.soft([0.02, 0.52, 0.031], [0.24, 0.03, 0.006], "white", round=0.9, puff=0.0, cuts=1, r=[0, 0, -12])
    m.cyl([-0.2, 0.14, 0.01], 0.07, 0.006, "stone", seg=8, r=[90, 0, 0])


build("earth_photo", fp)
