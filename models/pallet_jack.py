# The pallet jack (#365), first person: two hazard-yellow forks with load rollers at their tips, a
# hydraulic body with its pump and pedal, steering wheels, and a long handle on a bent tube with a
# dark loop grip and a release lever. Run: blender -b --factory-startup -P models/pallet_jack.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for z in (-0.25, 0.25):
        fork = m.box([0.2, 0.07, z], [1.2, 0.07, 0.16], "hazard", omit=("bottom",), tex="tread")
        m.box([0.79, 0.04, z], [0.02, 0.06, 0.14], "hazard", r=[0, 0, 30])
        m.cyl([0.72, 0.035, z], 0.07, 0.12, "rubber", seg=8, r=[90, 0, 0])
    m.box([-0.48, 0.25, 0], [0.26, 0.38, 0.62], "hazard", bevel=0.03, edges="upper", omit=("bottom",))
    m.lathe([-0.5, 0.42, 0], [(0.08, 0.0), (0.08, 0.2), (0.05, 0.22), (0.0, 0.23)], "steel", seg=8, tex="brushed")
    m.box([-0.62, 0.12, 0.2], [0.14, 0.03, 0.08], "rubber")
    for z in (-0.12, 0.12):
        m.cyl([-0.52, 0.09, z], 0.18, 0.06, "rubber", seg=10, r=[90, 0, 0])
        m.cyl([-0.52, 0.09, z], 0.1, 0.065, "metal", seg=8, r=[90, 0, 0])
    m.sweep([(-0.5, 0.62, 0), (-0.58, 0.95, 0), (-0.66, 1.2, 0)], 0.05, "metal", seg=6, smooth=2, tex="brushed")
    m.sweep([(-0.66, 1.2, -0.17), (-0.7, 1.32, -0.12), (-0.72, 1.33, 0.0), (-0.7, 1.32, 0.12), (-0.66, 1.2, 0.17), (-0.66, 1.2, -0.17)], 0.035, "dark", seg=5, smooth=2, caps=False)
    m.box([-0.64, 1.24, 0.0], [0.08, 0.02, 0.14], "red", r=[0, 0, 15])


build("pallet_jack", fp)
