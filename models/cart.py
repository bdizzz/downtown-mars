# The cargo cart (#367), first person: a tread-plate deck in the room colour on four rubber wheels with
# steel hubs (the front two on swivel forks), a bent push handle with a rubber grip, and on the deck
# a crate held by a strap and a coil of cable.
# Run: blender -b --factory-startup -P models/cart.py
import math
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.3, 0], [1.36, 0.08, 0.8], "accent", bevel=0.015, edges="upper", omit=("bottom",), tex="tread")
    m.box([0, 0.245, 0], [1.3, 0.03, 0.7], "dark", omit=("top",))
    for x in (-0.55, 0.55):
        for z in (-0.32, 0.32):
            m.cyl([x, 0.12, z], 0.24, 0.08, "rubber", seg=12, r=[90, 0, 0])
            m.cyl([x, 0.12, z], 0.12, 0.1, "steel", seg=8, r=[90, 0, 0], tex="brushed")
            if x > 0:
                m.box([x, 0.215, z], [0.06, 0.04, 0.14], "dark", omit=("bottom",))
                m.cyl([x, 0.235, z], 0.08, 0.02, "steel", seg=8)
            else:
                m.box([x, 0.2, z], [0.08, 0.1, 0.03], "dark", omit=("bottom",))
    # The handle.
    m.sweep([(-0.64, 0.32, -0.32), (-0.68, 1.22, -0.32), (-0.68, 1.29, -0.26), (-0.68, 1.29, 0.26), (-0.68, 1.22, 0.32), (-0.64, 0.32, 0.32)], 0.035, "metal", seg=6, smooth=1, caps=False, tex="brushed")
    m.cyl([-0.68, 1.29, 0], 0.048, 0.4, "rubber", seg=8, r=[90, 0, 0])
    m.cyl([-0.66, 0.75, 0], 0.025, 0.64, "metal", seg=6, r=[90, 0, 0])
    # The crate and its strap.
    crate = m.box([0.2, 0.62, 0], [0.8, 0.56, 0.6], "composite", omit=("bottom",), tex="grain")
    m.inset(m.side(crate, "front") + m.side(crate, "top") + m.side(crate, "right"), 0.05, 0.02)
    m.box([0.2, 0.62, 0.305], [0.24, 0.12, 0.01], "hazard", omit=("back",))
    m.box([0.2, 0.905, 0], [0.05, 0.01, 0.64], "dark", omit=("bottom",))
    for z in (-0.32, 0.32):
        m.box([0.2, 0.62, z], [0.05, 0.56, 0.01], "dark")
    # A coil of cable.
    pts = [(-0.38 + 0.13 * math.cos(a * 0.9), 0.36 + 0.018 * a, 0.13 * math.sin(a * 0.9)) for a in range(14)]
    m.sweep(pts, 0.03, "rubber", seg=5, smooth=1)


build("cart", fp)
