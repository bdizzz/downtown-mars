# The desk (#364), first person: a panel top on tapered steel legs, a pedestal of two drawers with
# bar handles, a monitor on a stand with a glowing screen, a keyboard with key rows, and a pot in
# the room's colour holding pens. Run: blender -b --factory-startup -P models/desk.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.73, 0], [1.6, 0.04, 0.8], "panel", bevel=0.012, seg=2, edges="all", tex="grain")
    for x in (-0.725,):
        for sz in (-1, 1):
            m.box([x, 0.355, sz * 0.325], [0.05, 0.71, 0.05], "metal", taper=[0.75, 0.75], tex="brushed")
    # The pedestal: two drawers, each a panel with a bar handle.
    m.box([0.5, 0.36, 0], [0.5, 0.7, 0.7], "panel", omit=("bottom",), tex="grain")
    for y in (0.2, 0.53):
        m.box([0.5, y, 0.355], [0.46, 0.3, 0.012], "panel", bevel=0.006, omit=("back",), tex="grain")
        m.sweep([(0.42, y + 0.1, 0.36), (0.42, y + 0.1, 0.38), (0.58, y + 0.1, 0.38), (0.58, y + 0.1, 0.36)], 0.014, "steel", seg=4, smooth=1, caps=False, tex="brushed")
    # The monitor: a foot, a neck, a frame and its screen.
    m.box([-0.2, 0.757, -0.22], [0.22, 0.014, 0.16], "dark", bevel=0.005, omit=("bottom",))
    m.box([-0.2, 0.88, -0.25], [0.05, 0.24, 0.03], "dark", bevel=0.006, edges="vertical")
    m.box([-0.2, 1.12, -0.2], [0.56, 0.34, 0.03], "dark", bevel=0.01, seg=2, edges="vertical")
    m.box([-0.2, 1.125, -0.184], [0.5, 0.29, 0.004], "glow", glow=True, omit=("back",))
    # The keyboard, its keys in rows.
    kb = m.box([-0.2, 0.762, 0.15], [0.45, 0.024, 0.15], "dark", bevel=0.005, omit=("bottom",))
    m.inset(m.split(m.side(kb, "top")[0], 4, "front"), 0.012, 0.004, "metal")
    # A pen pot.
    m.lathe([0.4, 0.75, -0.2], [(0.035, 0.0), (0.04, 0.12), (0.035, 0.12), (0.0, 0.02)], "accent", seg=8, caps=False)
    for dx, dz, lean in ((0.0, 0.0, 6), (0.012, 0.01, -8), (-0.01, 0.012, 12)):
        m.cyl([0.4 + dx, 0.88, -0.2 + dz], 0.008, 0.14, "dark" if lean > 0 else "copper", seg=4, r=[lean, 0, lean / 2])


build("desk", fp)
