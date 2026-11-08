# The drying rack (#367), first person: two bent steel-tube side frames on rubber feet with three rails
# between them, towels folded over the rails, a shirt on a hanger and a pair of socks pegged up.
# Run: blender -b --factory-startup -P models/drying_rack.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def towel(m, x0, x1, y, drop, c):
    """A towel folded over a rail at height y, hanging `drop` down in front and a little less behind, in gentle folds."""
    xs = [x0 + (x1 - x0) * t for t in (0.0, 0.33, 0.66, 1.0)]
    for side, share in ((1, 1.0), (-1, 0.8)):
        m.strip([(x, side * 0.02 + 0.008 * (-1) ** k) for k, x in enumerate(xs)], y - drop * share, y, 0.008, c, tex="fabric")
    m.cyl([(x0 + x1) / 2, y + 0.004, 0], 0.05, x1 - x0, c, seg=6, r=[0, 0, 90], tex="fabric")


def fp(m):
    for x in (-0.49, 0.49):
        m.sweep([(x, 0.02, -0.22), (x, 1.5, -0.2), (x, 1.58, -0.12), (x, 1.58, 0.12), (x, 1.5, 0.2), (x, 0.02, 0.22)], 0.03, "steel", seg=6, smooth=1, caps=False, tex="brushed")
        for z in (-0.22, 0.22):
            m.cyl([x, 0.015, z], 0.045, 0.03, "rubber", seg=6)
        m.cyl([x, 0.3, 0], 0.02, 0.42, "steel", seg=5, r=[90, 0, 0])
    for y in (0.7, 1.1, 1.5):
        m.cyl([0, y, 0], 0.025, 0.98, "steel", seg=6, r=[0, 0, 90], tex="brushed")
    towel(m, -0.42, -0.12, 1.1, 0.42, "cushion")
    towel(m, 0.16, 0.42, 1.5, 0.36, "white")
    towel(m, 0.1, 0.42, 0.7, 0.34, "cream")
    # A shirt on a hanger from the middle rail.
    m.sweep([(-0.05, 1.1, 0.0), (-0.03, 1.135, 0.0), (0.0, 1.115, 0.0), (0.0, 1.06, 0.0)], 0.008, "steel", seg=4, smooth=2, caps=False)
    m.sweep([(-0.17, 0.99, 0.0), (0.0, 1.05, 0.0), (0.17, 0.99, 0.0)], 0.014, "fibre", seg=4, smooth=2)
    m.strip([(-0.15, 0.0), (-0.05, 0.015), (0.05, -0.01), (0.15, 0.0)], 0.62, 1.0, 0.012, "accent", tex="fabric")
    for sx in (-1, 1):
        m.box([sx * 0.19, 0.89, 0.0], [0.07, 0.2, 0.012], "accent", r=[0, 0, sx * 18], tex="fabric")
    # Socks pegged on the low rail.
    for x in (-0.33, -0.22):
        m.box([x, 0.71, 0.018], [0.025, 0.04, 0.012], "hazard")
        m.box([x, 0.6, 0.0], [0.07, 0.18, 0.025], "dark", omit=("top",), tex="fabric")
        m.box([x + 0.02, 0.5, 0.0], [0.11, 0.05, 0.025], "dark", tex="fabric")


build("drying_rack", fp)
