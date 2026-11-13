# The armchair (#363), first person: the sofa's single sister. An upholstered frame in the room's
# colour, rolled arms with piping down their fronts, a padded back, a plump seat cushion and a back
# cushion, a cream pillow tipped into the corner, and tapered dark feet. Fabric throughout.
# Run: blender -b --factory-startup -P models/armchair.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    # The frame: a base, a padded back and two rolled arms.
    m.box([0, 0.24, 0.02], [0.86, 0.32, 0.84], "accent", bevel=0.05, seg=2, edges="upper", omit=("bottom",), tex="fabric")
    m.soft([0, 0.7, -0.35], [0.82, 0.62, 0.17], "accent", round=0.7, puff=0.05, cuts=2, r=[-6, 0, 0], omit=("bottom",), tex="fabric")
    for sx in (-1, 1):
        m.soft([sx * 0.37, 0.52, 0.02], [0.15, 0.4, 0.84], "accent", round=0.9, puff=0.08, cuts=2, omit=("bottom",), tex="fabric")
        m.sweep([(sx * 0.37 + sx * 0.06, 0.33, 0.43), (sx * 0.37 + sx * 0.07, 0.58, 0.43), (sx * 0.37, 0.715, 0.43), (sx * 0.37 - sx * 0.07, 0.58, 0.43)], 0.02, "accent", seg=4, smooth=2, tex="fabric")
    # The seat cushion, plump, and the back cushion.
    m.soft([0, 0.48, 0.07], [0.6, 0.16, 0.7], "cushion", round=0.5, puff=0.25, cuts=2, omit=("bottom",), tex="fabric")
    m.soft([0, 0.75, -0.22], [0.6, 0.44, 0.15], "cushion", round=0.6, puff=0.0, cuts=2, r=[-10, 0, 0], tex="fabric")
    # A pillow tipped into the corner.
    m.soft([0.17, 0.72, -0.1], [0.3, 0.28, 0.1], "cream", round=0.9, puff=0.0, cuts=1, r=[-16, -10, -6], tex="fabric")
    # Tapered feet.
    for sx in (-1, 1):
        for z in (-0.36, 0.36):
            m.box([sx * 0.37, 0.04, z], [0.06, 0.08, 0.06], "dark", taper=[1.4, 1.4], omit=("bottom",))


build("armchair", fp)
