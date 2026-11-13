# The parts rack (#365), first person: steel side frames and four shelves holding bins in hazard
# yellow, the room's colour and blue with label cut-outs, two turned gears, a copper coil, and a panel
# crate and a dark box on top. Run: blender -b --factory-startup -P models/parts_rack.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for x in (-0.55, 0.55):
        side = m.box([x, 1.0, 0], [0.04, 2.0, 0.55], "metal", omit=("bottom",), tex="brushed")
        m.inset(m.split(m.side(side, "left" if x < 0 else "right")[0], 4, "top"), 0.05, 0.01)
    for y in (0.1, 0.7, 1.3, 1.9):
        m.box([0, y, 0], [1.06, 0.035, 0.53], "metal", omit=("left", "right"), tex="perforated")
    for (x, y, c) in ((-0.35, 0.27, "hazard"), (0.0, 0.27, "accent"), (0.35, 0.27, "hazard"), (-0.3, 0.87, "accent"), (0.3, 0.87, "blueprint")):
        b = m.box([x, y, 0.02], [0.3, 0.3, 0.42], c, taper=[1.0, 1.06], omit=("bottom", "top"))
        m.inset(m.side(b, "front"), 0.06, 0.004)
        m.box([x, y + 0.08, 0.235], [0.12, 0.04, 0.004], "white", omit=("back",))
    for x in (-0.3, 0.05):
        m.lathe([x, 1.32, 0.05], [(0.03, 0.0), (0.15, 0.0), (0.15, 0.06), (0.03, 0.06)], "steel", seg=12, r=[90, 0, 0], tex="brushed")
        m.cyl([x, 1.47, 0.05], 0.05, 0.06, "dark", seg=6, r=[90, 0, 0])
    ring = [(0.35 + 0.1 * math.cos(t / 8 * math.tau), 1.33 + 0.012 * t, 0.1 * math.sin(t / 8 * math.tau)) for t in range(25)]
    m.sweep(ring, 0.03, "copper", seg=3, smooth=1, caps=False)
    crate = m.box([-0.2, 2.05, 0], [0.5, 0.26, 0.4], "panel", omit=("bottom",), tex="grain")
    m.inset(m.side(crate, "front"), 0.04, 0.01)
    m.box([0.3, 2.02, 0.05], [0.3, 0.2, 0.3], "dark", bevel=0.01, edges="upper", omit=("bottom",))


build("parts_rack", fp)
