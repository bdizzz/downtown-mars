# The pump (#365), first person: a skid of dark steel, a finned motor in the room's colour with a fan
# cowl and a conduit box, a hazard-yellow coupling guard, the pump's turned volute with its suction
# flange, a discharge pipe rising with a flange and gauge, and bolts holding it all down.
# Run: blender -b --factory-startup -P models/pump.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    skid = m.box([0, 0.08, 0], [1.3, 0.16, 0.76], "dark", omit=("bottom",), tex="tread")
    for x in (-0.5, 0.5):
        m.box([x, 0.18, 0.3], [0.1, 0.04, 0.1], "dark")
    # The motor: a finned body, a cowl, feet and its conduit box.
    m.lathe([-0.25, 0.55, 0], [(0.0, -0.38), (0.27, -0.38), (0.3, -0.35), (0.3, -0.26), (0.32, -0.24), (0.3, -0.22), (0.3, -0.06), (0.32, -0.04), (0.3, -0.02), (0.3, 0.14), (0.32, 0.16), (0.3, 0.18), (0.3, 0.34), (0.2, 0.37), (0.06, 0.38)], "accent", seg=10, r=[0, 0, -90])
    m.lathe([-0.65, 0.55, 0], [(0.0, 0.0), (0.22, 0.01), (0.28, 0.08), (0.28, 0.1)], "dark", seg=10, r=[0, 0, -90], tex="perforated")
    for x in (-0.45, -0.05):
        m.box([x, 0.26, 0], [0.12, 0.2, 0.5], "accent", taper=[1, 0.7], omit=("bottom",))
    m.box([-0.2, 0.9, 0], [0.18, 0.1, 0.16], "dark", bevel=0.01, edges="upper", omit=("bottom",))
    m.sweep([(-0.2, 0.92, 0.08), (-0.2, 0.92, 0.25), (-0.25, 0.7, 0.36), (-0.28, 0.2, 0.37)], 0.04, "rubber", seg=5, smooth=2, caps=False)
    # The coupling guard, the volute, the suction and the discharge.
    m.box([0.24, 0.55, 0], [0.16, 0.26, 0.3], "hazard", bevel=0.02, edges="all", tex="perforated")
    m.lathe([0.4, 0.55, 0], [(0.0, 0.0), (0.24, 0.0), (0.27, 0.06), (0.25, 0.16), (0.14, 0.2), (0.0, 0.2)], "metal", seg=10, r=[0, 0, -90], tex="brushed")
    m.box([0.5, 0.3, 0], [0.24, 0.28, 0.34], "metal", taper=[0.8, 0.7], omit=("bottom",))
    m.cyl([0.61, 0.55, 0], 0.18, 0.06, "steel", seg=8, r=[0, 0, 90])
    m.cyl([0.48, 0.92, 0], 0.15, 0.36, "metal", seg=8, caps=False, tex="brushed")
    m.cyl([0.48, 1.07, 0], 0.24, 0.05, "steel", seg=8)
    m.cyl([0.48, 0.92, 0.1], 0.03, 0.08, "steel", seg=5, r=[90, 0, 0])
    m.cyl([0.48, 0.92, 0.16], 0.1, 0.03, "white", seg=8, r=[90, 0, 0])
    for x in (-0.58, 0.58):
        for z in (-0.3, 0.3):
            m.cyl([x, 0.17, z], 0.04, 0.03, "steel", seg=4, caps=False)


build("pump", fp)
