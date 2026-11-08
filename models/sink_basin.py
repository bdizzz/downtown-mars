# The washbasins (#367), first person: a vanity with two cupboard pairs and a kick plate under a white
# top, two round bowls on it with gooseneck taps, a soap pump between them, a framed mirror over each
# bowl, a glowing light bar above, and a towel on a ring at the end.
# Run: blender -b --factory-startup -P models/sink_basin.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    cab = m.box([0, 0.43, -0.02], [1.76, 0.74, 0.46], "panel", omit=("bottom", "back"), tex="grain")
    doors = m.split(m.side(cab, "front")[0], 4, "right")
    m.inset(doors, 0.02, 0.006)
    for k, x in enumerate((-0.66, -0.22, 0.22, 0.66)):
        hx = x + (0.17 if k % 2 == 0 else -0.17)
        m.box([hx, 0.68, 0.215], [0.016, 0.12, 0.02], "steel", omit=("back",))
    m.box([0, 0.03, 0.18], [1.74, 0.06, 0.02], "dark", omit=("back",))
    m.box([0, 0.82, 0], [1.82, 0.04, 0.54], "white", bevel=0.01, edges="top", omit=("bottom",))
    for x in (-0.45, 0.45):
        # The bowl: turned back down inside to a drain.
        m.lathe([x, 0.84, 0.03], [(0.0, 0.0), (0.09, 0.0), (0.18, 0.1), (0.185, 0.12), (0.165, 0.12), (0.03, 0.03), (0.0, 0.03)], "white", seg=12)
        m.cyl([x, 0.871, 0.03], 0.05, 0.004, "steel", seg=8)
        m.sweep([(x, 0.84, -0.2), (x, 1.07, -0.2), (x, 1.1, -0.15), (x, 1.07, -0.08), (x, 1.03, -0.07)], 0.025, "steel", seg=5, smooth=1, tex="brushed")
        m.box([x + 0.06, 0.89, -0.2], [0.07, 0.016, 0.02], "steel")
        # The mirror in its frame.
        m.box([x, 1.48, -0.255], [0.66, 0.86, 0.025], "steel", omit=("back",), tex="brushed")
        m.box([x, 1.48, -0.24], [0.6, 0.8, 0.008], "mirror", omit=("back",))
    m.lathe([0, 0.84, -0.16], [(0.0, 0.0), (0.035, 0.0), (0.035, 0.12), (0.01, 0.14), (0.008, 0.18), (0.0, 0.18)], "accent", seg=6)
    m.box([0, 1.02, -0.135], [0.012, 0.012, 0.06], "white")
    m.box([0, 1.94, -0.21], [1.6, 0.08, 0.1], "dark", bevel=0.01, edges="vertical")
    m.box([0, 1.915, -0.155], [1.56, 0.03, 0.012], "lamp", glow=True, omit=("back",))
    # The towel ring.
    m.box([0.88, 1.2, -0.25], [0.04, 0.04, 0.03], "steel")
    m.sweep([(0.88, 1.2, -0.24), (0.88, 1.12, -0.24), (0.88, 1.04, -0.2), (0.88, 1.08, -0.15), (0.88, 1.18, -0.18)], 0.012, "steel", seg=4, smooth=2, caps=False)
    m.strip([(0.88, -0.25), (0.885, -0.2), (0.88, -0.15)], 0.72, 1.06, 0.03, "cream", tex="fabric")


build("sink_basin", fp)
