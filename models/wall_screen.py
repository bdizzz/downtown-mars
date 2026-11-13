# The wall screen (#367), first person: a big display in a thin dark bezel on a wall bracket, showing
# a dashboard: a title bar, a bar chart, a line chart and a column of figures; under it a console shelf
# with a perforated speaker bar and a little camera on top of the bezel.
# Run: blender -b --factory-startup -P models/wall_screen.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build

Y, Z = 1.8, 0.0


def fp(m):
    m.box([0, Y, -0.08], [1.2, 0.6, 0.04], "dark", omit=("back",))
    m.box([0, Y, -0.04], [2.2, 1.3, 0.05], "dark", bevel=0.012, edges="vertical", tex="brushed")
    m.box([0, Y, -0.012], [2.08, 1.18, 0.004], "board", glow=True, omit=("back",))
    zf = -0.008
    # The title bar.
    m.box([0, Y + 0.52, zf], [2.0, 0.08, 0.004], "blueprint", glow=True, omit=("back",))
    for k, w in enumerate((0.3, 0.16, 0.22)):
        m.box([-0.86 + 0.36 * k + w / 2, Y + 0.52, zf + 0.002], [w, 0.03, 0.003], "white", glow=True, omit=("back",))
    # The bar chart, left.
    base = Y - 0.45
    for k, h in enumerate((0.3, 0.45, 0.38, 0.6, 0.52, 0.72)):
        m.box([-0.9 + 0.11 * k, base + h / 2, zf], [0.07, h, 0.004], "power" if k < 5 else "fire", glow=True, omit=("back",))
    m.box([-0.62, base - 0.005, zf + 0.002], [0.66, 0.008, 0.003], "white", glow=True, omit=("back",))
    # The line chart, middle.
    pts = [(-0.15 + 0.08 * k, Y - 0.35 + h, zf + 0.002) for k, h in enumerate((0.1, 0.18, 0.15, 0.3, 0.26, 0.42, 0.38, 0.55))]
    m.sweep(pts, 0.012, "plant", seg=3, smooth=1, glow=True, caps=False)
    m.box([0.13, Y - 0.36, zf + 0.002], [0.62, 0.008, 0.003], "white", glow=True, omit=("back",))
    m.box([-0.17, Y - 0.08, zf + 0.002], [0.008, 0.56, 0.003], "white", glow=True, omit=("back",))
    # Figures, right.
    for k in range(6):
        m.box([0.72, Y + 0.3 - 0.12 * k, zf], [0.3, 0.05, 0.004], "white" if k % 2 == 0 else "glow", glow=True, omit=("back",))
        m.box([0.92, Y + 0.3 - 0.12 * k, zf], [0.06, 0.05, 0.004], "plant" if k != 3 else "red", glow=True, omit=("back",))
    # The camera on top and the console below.
    m.box([0, Y + 0.63, 0.0], [0.12, 0.04, 0.04], "dark", bevel=0.01)
    m.cyl([0, Y + 0.63, 0.021], 0.02, 0.004, "mirror", seg=8, r=[90, 0, 0])
    m.box([0, 1.1, -0.05], [0.8, 0.04, 0.1], "dark", bevel=0.008, edges="top")
    m.box([0, 1.15, -0.04], [0.6, 0.06, 0.08], "dark", bevel=0.015, edges="vertical")
    m.box([0, 1.15, 0.0005], [0.56, 0.04, 0.002], "metal", omit=("back",), tex="perforated")
    m.cyl([0.25, 1.15, 0.002], 0.01, 0.004, "plant", seg=6, glow=True, r=[90, 0, 0])


build("wall_screen", fp)
