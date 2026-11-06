# The tray rack (#366), first person: a trolley of four round steel posts on castors with a
# perforated base shelf, six trays slid onto rails, alternating grained panel and the room colour,
# their tops rounded, and a perforated top shelf.
# Run: blender -b --factory-startup -P models/tray_rack.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.cyl([sx * 0.25, 0.83, sz * 0.21], 0.035, 1.5, "metal", seg=8, tex="brushed")
            m.cyl([sx * 0.25, 1.585, sz * 0.21], 0.04, 0.012, "dark", seg=8)
            m.box([sx * 0.25, 0.065, sz * 0.21], [0.04, 0.03, 0.05], "dark", omit=("bottom",))
            m.cyl([sx * 0.25, 0.03, sz * 0.21], 0.06, 0.025, "rubber", seg=8, r=[90, 0, 0])
    m.box([0, 0.11, 0], [0.54, 0.03, 0.44], "metal", tex="perforated")
    for k in range(5):
        y = 0.35 + 0.24 * k
        for sx in (-1, 1):
            m.box([sx * 0.25, y - 0.02, 0], [0.025, 0.012, 0.42], "steel", omit=("top",), tex="brushed")
        m.box([0, y, 0.01], [0.48, 0.02, 0.44], "panel" if k % 2 == 0 else "accent", bevel=0.008, edges="top", omit=("bottom",), tex="grain" if k % 2 == 0 else None)
        m.box([0, y + 0.016, 0.234], [0.12, 0.012, 0.012], "dark", omit=("bottom",))
    m.box([0, 1.56, 0], [0.54, 0.012, 0.44], "metal", tex="perforated")


build("tray_rack", fp)
