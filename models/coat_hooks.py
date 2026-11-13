# The coat hooks (#364), first person: a fibre-composite rail with four curled steel hooks, a coat
# in the room's colour hanging by its loop, a bag with a strap and a flap, and a hazard-yellow
# hi-vis vest. Run: blender -b --factory-startup -P models/coat_hooks.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.95, 0.0], [1.2, 0.08, 0.03], "fibre", bevel=0.008, seg=2, edges="all", omit=("back",), tex="grain")
    for x in (-0.45, -0.15, 0.15, 0.45):
        m.sweep([(x, 0.95, 0.01), (x, 0.92, 0.06), (x, 0.88, 0.08), (x, 0.9, 0.11)], 0.016, "steel", seg=4, smooth=2, tex="brushed")
    # The coat: shoulders hung on a hook, its body and a sleeve.
    m.soft([-0.45, 0.78, 0.09], [0.36, 0.2, 0.1], "accent", round=0.6, puff=0.1, cuts=1, tex="fabric")
    m.soft([-0.45, 0.48, 0.1], [0.38, 0.46, 0.11], "accent", round=0.5, puff=0.1, cuts=2, tex="fabric")
    m.soft([-0.3, 0.55, 0.13], [0.08, 0.42, 0.07], "accent", round=0.9, puff=0.0, cuts=1, r=[0, 0, -6], tex="fabric")
    # The bag: its strap over a hook, its body and flap.
    m.sweep([(0.15, 0.89, 0.09), (0.05, 0.72, 0.1), (0.15, 0.62, 0.1), (0.25, 0.72, 0.1), (0.15, 0.89, 0.09)], 0.02, "dark", seg=3, smooth=2, caps=False)
    m.soft([0.15, 0.58, 0.1], [0.3, 0.26, 0.12], "composite", round=0.5, puff=0.1, cuts=1, tex="fabric")
    m.soft([0.15, 0.64, 0.16], [0.3, 0.13, 0.02], "composite", round=0.5, puff=0.0, cuts=1, r=[-8, 0, 0], tex="fabric")
    m.box([0.15, 0.6, 0.17], [0.04, 0.03, 0.01], "steel", omit=("back",))
    # The hi-vis vest, flat against the wall, with a silver band.
    m.soft([0.45, 0.6, 0.06], [0.24, 0.56, 0.03], "hazard", round=0.7, puff=0.0, cuts=1, tex="fabric")
    m.box([0.45, 0.5, 0.077], [0.24, 0.04, 0.004], "white", omit=("back",))


build("coat_hooks", fp)
