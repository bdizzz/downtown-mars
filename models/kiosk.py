# The info kiosk (#366), first person: a turned dark base, a column in the room colour with rounded
# corners and a perforated speaker grille, a card reader with a glowing light, and a tilted head with
# a glowing map of the hole: rings of rooms, a shaft and a pin.
# Run: blender -b --factory-startup -P models/kiosk.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.lathe([0, 0, 0], [(0.35, 0.0), (0.35, 0.03), (0.3, 0.06), (0.22, 0.07), (0.0, 0.07)], "dark", seg=14)
    m.box([0, 0.7, 0], [0.4, 1.26, 0.3], "accent", bevel=0.04, seg=2, edges="vertical", omit=("bottom",))
    m.box([0, 0.95, 0.15], [0.24, 0.12, 0.01], "metal", omit=("back",), tex="perforated")
    m.box([0.1, 1.15, 0.155], [0.12, 0.08, 0.02], "dark", omit=("back",))
    m.box([0.1, 1.135, 0.166], [0.08, 0.006, 0.002], "power", glow=True, omit=("back",))
    # The tilted head and its map.
    head = m.box([0, 1.5, 0.05], [0.7, 0.5, 0.1], "dark", r=[-15, 0, 0])
    m.inset(m.side(head, "front"), 0.04, 0.008, "glow", glow=True)
    for d, c in ((0.36, "blueprint"), (0.26, "glow"), (0.16, "blueprint")):
        m.cyl([0, 1.5, 0.092], d, 0.004, c, seg=14, r=[75, 0, 0], glow=True)
    m.cyl([0, 1.5, 0.095], 0.07, 0.004, "dark", seg=10, r=[75, 0, 0])
    m.lathe([0.12, 1.52, 0.1], [(0.0, 0.0), (0.015, 0.03), (0.012, 0.045), (0.0, 0.05)], "red", seg=6, r=[75, 0, 0], glow=True)
    m.box([-0.22, 1.64, 0.124], [0.16, 0.025, 0.003], "white", glow=True, r=[-15, 0, 0])


build("kiosk", fp)
