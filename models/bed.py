# The single bed (#363), first person: a low dark frame on tapered legs, a quilted white mattress,
# a duvet in the room's colour over the foot two-thirds with its top turned back and its side
# hanging down, a plump pillow, a padded headboard in a composite surround, and a cream throw
# folded across the foot. Run: blender -b --factory-startup -P models/bed.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    # Tapered legs and the frame: side and end rails round a slatted base.
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 0.96, 0.12, sz * 0.43], [0.06, 0.24, 0.06], "dark", taper=[1.25, 1.25], omit=("bottom",))
    for sz in (-1, 1):
        m.box([0, 0.29, sz * 0.475], [2.0, 0.1, 0.04], "dark", bevel=0.012, edges="top")
    m.box([0.995, 0.29, 0], [0.04, 0.1, 0.99], "dark", bevel=0.012, edges="top")
    m.box([0, 0.26, 0], [1.96, 0.03, 0.91], "dark", omit=("bottom",))
    # The mattress, quilted, its top edges rounded.
    m.box([0, 0.42, 0], [1.96, 0.18, 0.9], "white", bevel=0.05, seg=2, edges="top", omit=("bottom",), tex="quilt")
    # The duvet over the foot, soft on top, its turned-back top and its side hanging down the front.
    m.soft([0.28, 0.525, 0.01], [1.38, 0.05, 0.96], "accent", round=0.4, puff=0.6, cuts=2, omit=("bottom",), tex="fabric")
    m.soft([-0.36, 0.545, 0.01], [0.14, 0.05, 0.97], "accent", round=0.9, puff=0.2, cuts=1, omit=("bottom",), tex="fabric")
    m.box([0.28, 0.43, 0.488], [1.38, 0.17, 0.025], "accent", bevel=0.01, edges="top", omit=("back", "bottom"), tex="fabric")
    # A throw folded across the foot.
    m.soft([0.78, 0.56, 0.0], [0.3, 0.04, 0.98], "cream", round=0.8, puff=0.2, cuts=1, omit=("bottom",), tex="fabric")
    # The pillow, plump and a little turned.
    m.soft([-0.78, 0.565, -0.01], [0.36, 0.13, 0.64], "white", round=0.8, puff=0.35, cuts=2, r=[0, 5, -8], tex="fabric")
    # The headboard: a composite surround with a padded panel in it.
    m.box([-1.035, 0.55, 0], [0.06, 0.7, 1.04], "composite", bevel=0.025, seg=2, edges="upper", omit=("bottom",))
    m.soft([-0.995, 0.66, 0], [0.04, 0.4, 0.86], "accent", round=0.9, puff=0.0, cuts=2, tex="quilt")


build("bed", fp)
