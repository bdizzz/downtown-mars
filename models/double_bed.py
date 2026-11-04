# The double bed (#363), first person: a fibre-composite frame on tapered legs, a quilted white
# mattress, a duvet in the room's colour with its top turned back and its side hanging down, two
# plump pillows and a cushion, a cream runner across the foot, and a tall headboard with a padded,
# buttoned panel. Run: blender -b --factory-startup -P models/double_bed.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    # Tapered legs and the frame round the base.
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 0.96, 0.12, sz * 0.78], [0.07, 0.24, 0.07], "fibre", taper=[1.25, 1.25], omit=("bottom",))
    for sz in (-1, 1):
        m.box([0, 0.3, sz * 0.83], [2.04, 0.12, 0.05], "fibre", bevel=0.015, edges="top", tex="grain")
    m.box([1.0, 0.3, 0], [0.05, 0.12, 1.62], "fibre", bevel=0.015, edges="top", tex="grain")
    m.box([0, 0.26, 0], [1.96, 0.03, 1.62], "fibre", omit=("bottom",))
    # The mattress, quilted.
    m.box([0.02, 0.43, 0], [1.96, 0.2, 1.6], "white", bevel=0.06, seg=2, edges="top", omit=("bottom",), tex="quilt")
    # The duvet, soft on top, its turned-back top and its side hanging down the front.
    m.soft([0.3, 0.555, 0.01], [1.4, 0.06, 1.66], "accent", round=0.4, puff=0.6, cuts=2, omit=("bottom",), tex="fabric")
    m.soft([-0.35, 0.575, 0.01], [0.15, 0.06, 1.67], "accent", round=0.9, puff=0.2, cuts=1, omit=("bottom",), tex="fabric")
    m.box([0.3, 0.45, 0.838], [1.4, 0.19, 0.025], "accent", bevel=0.01, edges="top", omit=("back", "bottom"), tex="fabric")
    # A cream runner across the foot.
    m.soft([0.92, 0.595, 0], [0.3, 0.04, 1.69], "cream", round=0.8, puff=0.2, cuts=1, omit=("bottom",), tex="fabric")
    # Two pillows, and a small cushion propped against them.
    for z, turn in ((-0.4, 6), (0.4, -4)):
        m.soft([-0.74, 0.6, z], [0.38, 0.14, 0.64], "white", round=0.8, puff=0.35, cuts=2, r=[0, turn, -8], tex="fabric")
    m.soft([-0.56, 0.64, 0.12], [0.12, 0.3, 0.34], "cushion", round=0.9, puff=0.0, cuts=1, r=[0, 0, 18], tex="fabric")
    # The headboard: a tall fibre surround and a padded panel, buttoned in a row.
    m.box([-1.035, 0.72, 0], [0.06, 0.96, 1.74], "fibre", bevel=0.03, seg=2, edges="upper", omit=("bottom",), tex="grain")
    m.soft([-0.99, 0.84, 0], [0.04, 0.58, 1.52], "cushion", round=0.9, puff=0.0, cuts=2, tex="quilt")
    for z in (-0.5, 0, 0.5):
        m.cyl([-0.968, 0.92, z], 0.025, 0.012, "dark", seg=5, r=[0, 0, 90])


build("double_bed", fp)
