# The glass sheets on a rack (#365), first person: an A-frame of dark steel on a base with rubber
# pads, four sheets of glass leaning against it, their edges catching the light, held by a strap with
# a buckle. Run: blender -b --factory-startup -P models/glass_rack.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.06, 0], [1.6, 0.12, 0.7], "dark", omit=("bottom",), tex="tread")
    for x in (-0.7, 0.7):
        m.box([x, 0.75, -0.17], [0.06, 1.3, 0.06], "metal", r=[-12, 0, 0], tex="brushed")
        m.box([x, 0.6, 0.1], [0.05, 0.05, 0.6], "metal", tex="brushed")
    m.box([0, 1.32, -0.29], [1.6, 0.06, 0.06], "metal", r=[-12, 0, 0], tex="brushed")
    m.box([0, 0.13, 0.05], [1.5, 0.03, 0.5], "rubber", omit=("bottom",))
    for k, z in enumerate((-0.1, -0.03, 0.04, 0.11)):
        g = m.box([0.02 * (k % 2), 0.78, z], [1.4, 1.25, 0.02], "mirror", r=[-12, 0, 0])
        m.box([0.02 * (k % 2), 0.78 + 0.625 * math.cos(math.radians(12)), z - 0.625 * math.sin(math.radians(12))], [1.4, 0.008, 0.022], "white", r=[-12, 0, 0])
    m.sweep([(-0.72, 0.9, -0.08), (-0.6, 0.92, 0.2), (0.0, 0.92, 0.22), (0.6, 0.92, 0.2), (0.72, 0.9, -0.08)], 0.04, "hazard", seg=3, smooth=2, caps=False)
    m.box([0.0, 0.92, 0.23], [0.06, 0.06, 0.02], "steel")


build("glass_rack", fp)
