# The decontamination arch (#367), first person: two white pillars with vented inner faces, rows of
# spray nozzles and panels of perforated steel, a lintel with a glowing strip and two amber warning
# lamps, a control box on one pillar, and a tread-plate grate in hazard yellow underfoot.
# Run: blender -b --factory-startup -P models/decon_arch.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for sx in (-1, 1):
        x = sx * 1.0
        m.box([x, 1.18, 0], [0.3, 2.36, 0.76], "white", bevel=0.02, edges="vertical", omit=("bottom", "top"))
        m.box([x - sx * 0.155, 1.3, 0], [0.01, 1.6, 0.5], "steel", tex="perforated")
        for k in range(4):
            m.cyl([x - sx * 0.165, 0.65 + 0.36 * k, 0.3], 0.04, 0.03, "steel", seg=5, d2=0.025, r=[0, 0, sx * 90])
            m.cyl([x - sx * 0.165, 0.83 + 0.36 * k, -0.3], 0.04, 0.03, "steel", seg=5, d2=0.025, r=[0, 0, sx * 90])
        m.box([x, 0.04, 0], [0.3, 0.08, 0.8], "dark", omit=("bottom",))
    # The lintel, its glow strip and lamps.
    m.box([0, 2.475, 0], [2.3, 0.25, 0.8], "white", bevel=0.02, edges="all")
    m.box([0, 2.4, 0.405], [1.6, 0.06, 0.01], "glow", glow=True, omit=("back",))
    m.box([0, 2.345, 0], [1.66, 0.01, 0.5], "glow", glow=True, omit=("top",))
    for x in (-0.95, 0.95):
        m.cyl([x, 2.605, 0.2], 0.12, 0.01, "dark", seg=10)
        m.lathe([x, 2.6, 0.2], [(0.05, 0.0), (0.05, 0.02), (0.035, 0.04), (0.0, 0.05)], "hazard", glow=True, seg=10, caps=False)
    # The control box.
    m.box([-1.0, 1.4, 0.4], [0.2, 0.3, 0.04], "panel", bevel=0.01)
    m.box([-1.0, 1.45, 0.422], [0.14, 0.08, 0.006], "glow", glow=True, omit=("back",))
    m.cyl([-1.04, 1.33, 0.423], 0.04, 0.012, "red", seg=8, r=[90, 0, 0])
    m.cyl([-0.96, 1.33, 0.423], 0.04, 0.012, "plant", seg=8, r=[90, 0, 0])
    # The grate.
    g = m.box([0, 0.025, 0], [1.7, 0.05, 0.8], "hazard", omit=("bottom",), tex="tread")
    slots = m.split(m.side(g, "top")[0], 5, "right")
    m.inset(slots, 0.04, 0.02, c="dark")


build("decon_arch", fp)
