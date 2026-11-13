# The battery rack (#365), first person: a dark steel rack with uprights and shelves, five tiers of
# battery modules with glowing charge bars and status lights, red and black terminals joined by copper
# links, a hazard-striped top and a cable run down its side.
# Run: blender -b --factory-startup -P models/battery_rack.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box([sx * 0.67, 1.1, sz * 0.38], [0.06, 2.2, 0.06], "dark", omit=("bottom",), tex="brushed")
    for y in (0.08, 0.48, 0.88, 1.28, 1.68, 2.08):
        m.box([0, y, 0], [1.3, 0.035, 0.78], "metal", omit=("left", "right"), tex="perforated")
    for k, y in enumerate((0.1, 0.5, 0.9, 1.3, 1.7)):
        for x in (-0.42, 0.0, 0.42):
            mod = m.box([x, y + 0.165, 0], [0.38, 0.3, 0.7], "composite", omit=("bottom", "back", "left", "right"), tex="grain")
            m.inset(m.side(mod, "front"), 0.03, 0.006, "dark")
            m.box([x - 0.03, y + 0.18, 0.352], [0.22, 0.05, 0.006], "power", glow=True, omit=("back",))
            m.box([x + 0.12, y + 0.18, 0.352], [0.025, 0.025, 0.008], "plant" if (k + int(x * 10)) % 4 else "red", omit=("back",), glow=True)
        m.sweep([(-0.55, y + 0.33, 0.25), (-0.42, y + 0.36, 0.25), (0.42, y + 0.36, 0.25), (0.55, y + 0.33, 0.25)], 0.03, "copper", seg=4, smooth=1, caps=False)
    m.box([0, 2.25, 0], [1.3, 0.1, 0.2], "hazard", omit=("bottom",), tex="tread")
    m.sweep([(0.6, 2.2, -0.37), (0.62, 1.2, -0.37), (0.6, 0.1, -0.37)], 0.05, "rubber", seg=5, smooth=2, caps=False)


build("battery_rack", fp)
