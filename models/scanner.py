# The body scanner (#366), first person: a white ring gantry with rounded edges round a dark bore, a
# band in the room colour round it and a glowing panel on its face, and a padded couch on a white base
# that slides into the bore, with a pillow and a strap.
# Run: blender -b --factory-startup -P models/scanner.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.lathe([0, 1.0, -0.6], [(0.5, -0.3), (0.9, -0.33), (0.95, -0.28), (0.95, 0.28), (0.9, 0.33), (0.5, 0.3), (0.5, -0.3)], "white", seg=18, r=[90, 0, 0], caps=False)
    m.lathe([0, 1.0, -0.6], [(0.49, -0.29), (0.49, 0.29), (0.498, 0.29), (0.498, -0.29), (0.49, -0.29)], "dark", seg=18, r=[90, 0, 0], caps=False)
    m.lathe([0, 1.0, -0.6], [(0.96, -0.04), (0.97, -0.03), (0.97, 0.03), (0.96, 0.04)], "accent", seg=18, r=[90, 0, 0], caps=False)
    m.box([0, 0.03, -0.6], [1.2, 0.06, 0.7], "dark", omit=("bottom",))
    pan = m.box([0.62, 1.42, -0.26], [0.26, 0.18, 0.02], "dark", r=[0, 0, -30], omit=("back",))
    m.inset(m.side(pan, "front"), 0.02, 0.0, "glow", glow=True)
    # The couch on its base.
    m.box([0, 0.33, 0.5], [0.66, 0.66, 1.1], "white", bevel=0.04, seg=2, edges="vertical", omit=("bottom",))
    m.box([0, 0.04, 0.5], [0.6, 0.08, 1.04], "dark", omit=("bottom",))
    m.box([0, 0.69, 0.2], [0.56, 0.06, 1.8], "panel", tex="grain")
    m.soft([0, 0.75, 0.25], [0.52, 0.07, 1.7], "cream", round=0.5, puff=0.2, cuts=2, omit=("bottom",), tex="fabric")
    m.soft([0, 0.8, 0.95], [0.36, 0.08, 0.24], "white", round=0.9, puff=0.4, cuts=1, tex="fabric")
    m.box([0, 0.79, 0.1], [0.58, 0.012, 0.08], "accent", omit=("bottom",))


build("scanner", fp)
