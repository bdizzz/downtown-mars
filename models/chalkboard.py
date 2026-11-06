# The board (#366), first person: a dark board in a grained composite frame, a chalk tray with chalk
# and an eraser, sums and lines of writing in chalk, a ringed planet drawn in the corner, and a
# cream sheet pinned at the side.
# Run: blender -b --factory-startup -P models/chalkboard.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    frame = m.box([0, 1.55, 0], [3.0, 1.4, 0.06], "composite", omit=("back",), tex="grain")
    m.inset(m.side(frame, "front"), 0.05, 0.012, "board")
    m.box([0, 0.86, 0.06], [3.0, 0.025, 0.12], "metal", tex="brushed")
    m.box([0, 0.88, 0.115], [3.0, 0.04, 0.01], "metal", omit=("back",), tex="brushed")
    for x, c in ((-0.8, "white"), (-0.72, "power"), (-0.65, "white")):
        m.cyl([x, 0.886, 0.07], 0.012, 0.08, c, seg=5, r=[0, 0, 90])
    m.box([0.6, 0.9, 0.06], [0.14, 0.05, 0.06], "composite", bevel=0.008, edges="top", omit=("bottom",), tex="grain")
    m.box([0.6, 0.877, 0.06], [0.14, 0.012, 0.05], "felt", omit=("bottom",))
    # Writing and sums in chalk.
    for k, w in enumerate((1.0, 0.7, 1.2, 0.5, 0.9)):
        m.box([-0.95 + w / 2, 2.0 - 0.14 * k, 0.019], [w, 0.025, 0.003], "white", omit=("back",))
    for k in range(3):
        m.box([0.25 + 0.12 * k, 1.5, 0.019], [0.08, 0.025, 0.003], "white", omit=("back",))
    m.box([0.55, 1.5, 0.019], [0.025, 0.08, 0.003], "white", omit=("back",))
    m.box([0.4, 1.42, 0.019], [0.5, 0.012, 0.003], "white", omit=("back",))
    # A planet with a ring.
    m.lathe([0.95, 1.85, 0.018], [(0.12, 0.0), (0.135, 0.0), (0.135, 0.004), (0.12, 0.004)], "cream", seg=14, r=[90, 0, 0], caps=False)
    m.lathe([0.95, 1.85, 0.019], [(0.19, 0.0), (0.2, 0.0), (0.2, 0.004), (0.19, 0.004)], "power", seg=14, r=[90, 0, -12], caps=False)
    # A pinned sheet.
    m.box([1.25, 1.6, 0.018], [0.24, 0.32, 0.003], "cream", r=[0, 0, 3], omit=("back",))
    m.cyl([1.25, 1.74, 0.022], 0.02, 0.008, "red", seg=6, r=[90, 0, 0])


build("chalkboard", fp)
