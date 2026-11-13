# The banner (#366), first person: a cloth banner in the room colour hanging in soft folds from a rod
# on two wall brackets with turned finials, an emblem of a white disc and an amber ring, a hazard band
# at its foot, and a tassel at each corner.
# Run: blender -b --factory-startup -P models/banner.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.cyl([0, 1.56, 0.05], 0.025, 0.8, "metal", seg=8, r=[0, 0, 90], tex="brushed")
    for sx in (-1, 1):
        m.lathe([sx * 0.405, 1.56, 0.05], [(0.0, 0.0), (0.02, 0.0), (0.025, 0.015), (0.0, 0.04)], "copper", seg=8, r=[0, 0, -90 * sx])
        m.box([sx * 0.36, 1.56, 0.02], [0.03, 0.06, 0.06], "dark", omit=("back",))
    # The cloth in folds, hanging from the rod.
    folds = [(-0.4 + 0.8 * k / 10, 0.05 + 0.012 * math.sin(k * math.pi / 2.5)) for k in range(11)]
    m.strip(folds, 0.36, 1.55, 0.006, "accent", tex="fabric")
    m.strip(folds, 0.24, 0.36, 0.006, "hazard", tex="fabric")
    for sx in (-1, 1):
        m.lathe([sx * 0.39, 0.12, 0.05], [(0.0, 0.0), (0.02, 0.02), (0.012, 0.1), (0.0, 0.12)], "power", seg=5)
    # The emblem, held just proud of the cloth.
    m.cyl([0, 1.02, 0.068], 0.36, 0.004, "white", seg=16, r=[90, 0, 0])
    m.lathe([0, 1.02, 0.072], [(0.11, 0.0), (0.14, 0.0), (0.14, 0.003), (0.11, 0.003)], "power", seg=16, r=[90, 0, 0], caps=False)
    m.box([0, 1.02, 0.073], [0.035, 0.18, 0.003], "accent", omit=("back",))


build("banner", fp)
