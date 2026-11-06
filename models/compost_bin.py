# The compost bin (#365), first person: a bin in the room's colour with vent slots down its front and
# sides, dark corner posts, a hinged lid propped a little open with a handle, a hatch at the foot
# showing the dark soil inside, and a fork leaning against it.
# Run: blender -b --factory-startup -P models/compost_bin.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    bin = m.box([0, 0.55, 0], [1.24, 1.1, 1.24], "accent", omit=("bottom",), tex="grain")
    for s in ("front", "left", "right"):
        slots = m.split(m.side(bin, s)[0], 5, "top")
        for k, f in enumerate(slots):
            if k > 0:
                m.inset([f], 0.05, 0.012)
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 0.63, 0.57, sz * 0.63], [0.08, 1.14, 0.08], "dark", omit=("bottom",))
    m.box([0, 1.17, -0.08], [1.32, 0.06, 1.12], "dark", r=[-10, 0, 0], tex="tread")
    m.sweep([(-0.2, 1.24, 0.43), (-0.18, 1.29, 0.45), (0.18, 1.29, 0.45), (0.2, 1.24, 0.43)], 0.03, "steel", seg=4, smooth=2, caps=False)
    hatch = m.box([0, 0.2, 0.635], [0.5, 0.3, 0.03], "dark", omit=("back",))
    m.inset(m.side(hatch, "front"), 0.03, 0.02, "soil")
    m.box([0, 0.37, 0.65], [0.12, 0.03, 0.03], "steel")
    m.sweep([(0.5, 0.22, 0.655), (0.56, 0.7, 0.655), (0.6, 1.2, 0.655)], 0.035, "fibre", seg=5, smooth=1, tex="grain")
    m.box([0.49, 0.2, 0.655], [0.16, 0.03, 0.02], "steel")
    for dx in (-0.06, 0.0, 0.06):
        m.cyl([0.49 + dx, 0.11, 0.655], 0.015, 0.18, "steel", seg=4, caps=False)


build("compost_bin", fp)
