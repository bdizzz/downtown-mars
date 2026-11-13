# The sofa (#357), first person (#360), remodelled with the richer kit (#361): an upholstered
# frame in the room's colour, its arms rolled and its back softly padded, two plump seat cushions
# and two back cushions (soft), a cream throw pillow, piping along the arm fronts (sweep), and
# tapered dark feet. Fabric throughout. Run: blender -b --factory-startup -P models/sofa.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    # The frame: a base, a padded back and two rolled arms, all upholstered.
    m.box([0, 0.22, 0.02], [1.9, 0.3, 0.84], "accent", bevel=0.05, seg=2, edges="upper", omit=("bottom",), tex="fabric")
    m.soft([0, 0.66, -0.33], [1.72, 0.62, 0.18], "accent", round=0.7, puff=0.05, cuts=1, r=[-6, 0, 0], omit=("bottom",), tex="fabric")
    for sx in (-1, 1):
        m.soft([sx * 0.9, 0.48, 0.02], [0.2, 0.42, 0.86], "accent", round=0.9, puff=0.08, cuts=2, omit=("bottom",), tex="fabric")
        # Piping round the arm's front, where the fabric is sewn.
        m.sweep([(sx * 0.9 + sx * 0.08, 0.3, 0.44), (sx * 0.9 + sx * 0.09, 0.56, 0.44), (sx * 0.9, 0.69, 0.44), (sx * 0.9 - sx * 0.09, 0.56, 0.44)], 0.022, "accent", seg=4, smooth=2, tex="fabric")
    # Two seat cushions and two back cushions, plump in the middle.
    for x in (-0.41, 0.41):
        m.soft([x, 0.44, 0.08], [0.8, 0.16, 0.72], "cushion", round=0.5, puff=0.25, cuts=2, omit=("bottom",), tex="fabric")
        m.soft([x, 0.72, -0.2], [0.78, 0.44, 0.16], "cushion", round=0.6, puff=0.0, cuts=1, r=[-10, 0, 0], tex="fabric")
    # A throw pillow, tipped into the corner.
    m.soft([-0.6, 0.67, -0.04], [0.36, 0.34, 0.12], "cream", round=0.9, puff=0.0, cuts=1, r=[-18, 12, 6], tex="fabric")
    # Tapered feet.
    for sx in (-1, 1):
        for z in (-0.36, 0.36):
            m.box([sx * 0.86, 0.04, z], [0.06, 0.08, 0.06], "dark", taper=[1.4, 1.4], omit=("bottom",))


build("sofa", fp)
