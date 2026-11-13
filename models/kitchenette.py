# The kitchenette (#364), first person: a run of base cabinets with four composite doors and bar
# handles under a stone worktop, a steel sink sunk into it with a gooseneck tap, a two-ring hob,
# wall cabinets above with a glowing strip under them, and a kettle in the room's colour.
# Run: blender -b --factory-startup -P models/kitchenette.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def doors(m, body, y, h):
    """Four doors across a cabinet's front, each inset with a bar handle near its top or bottom."""
    front = m.side(body, "front")
    if not front:
        return
    for d in m.split(front[0], 4, "right"):
        m.inset([d], 0.025, 0.006, "composite", tex="grain")
    z = front[0].calc_center_median().z + 0.012
    for x in (-0.9, -0.3, 0.3, 0.9):
        hy = y + (h / 2 - 0.08 if y < 1 else -h / 2 + 0.08)
        m.box([x + (0.2 if x < 0 else -0.2), hy, z], [0.12, 0.016, 0.02], "steel", omit=("back",), tex="brushed")


def fp(m):
    base = m.box([0, 0.46, 0], [2.4, 0.84, 0.62], "fibre", omit=("bottom", "back", "top"), tex="grain")
    m.box([0, 0.04, 0.02], [2.36, 0.08, 0.56], "dark", omit=("bottom",))
    doors(m, base, 0.46, 0.84)
    # The worktop, a sink sunk into it, the tap, and the hob.
    top = m.box([0, 0.9, 0], [2.44, 0.04, 0.66], "stone", bevel=0.01, edges="upper", omit=("bottom",))
    m.box([-0.6, 0.922, 0.02], [0.52, 0.006, 0.42], "steel", omit=("bottom",), tex="brushed")
    sink = m.box([-0.6, 0.925, 0.02], [0.46, 0.002, 0.36], "steel", omit=("bottom",), tex="brushed")
    m.inset(m.side(sink, "top"), 0.01, 0.14, "steel", tex="brushed")
    m.sweep([(-0.6, 0.92, -0.24), (-0.6, 1.14, -0.24), (-0.6, 1.2, -0.17), (-0.6, 1.14, -0.1), (-0.6, 1.1, -0.1)], 0.025, "steel", seg=6, smooth=2, tex="brushed")
    m.box([-0.5, 0.95, -0.24], [0.05, 0.05, 0.04], "steel", omit=("bottom",))
    m.box([0.62, 0.925, 0.02], [0.66, 0.01, 0.42], "dark", bevel=0.004, omit=("bottom",))
    for x in (0.45, 0.8):
        m.lathe([x, 0.93, 0.02], [(0.11, 0.0), (0.11, 0.004), (0.08, 0.006), (0.0, 0.006)], "metal", seg=10, caps=False)
    # The kettle: a turned body, a spout and a handle.
    m.lathe([0.15, 0.92, -0.15], [(0.07, 0.0), (0.085, 0.04), (0.08, 0.12), (0.05, 0.15), (0.02, 0.16), (0.0, 0.17)], "accent", seg=10)
    m.sweep([(0.22, 0.98, -0.15), (0.27, 1.02, -0.15), (0.29, 1.07, -0.15)], 0.025, "accent", seg=5, smooth=1)
    m.sweep([(0.11, 1.07, -0.15), (0.12, 1.13, -0.15), (0.2, 1.13, -0.15), (0.21, 1.06, -0.15)], 0.02, "dark", seg=4, smooth=2, caps=False)
    # The wall cabinets and the glowing strip under them.
    wall = m.box([0, 1.85, -0.14], [2.4, 0.7, 0.34], "fibre", omit=("back",), tex="grain")
    doors(m, wall, 1.85, 0.7)
    m.box([0, 1.49, -0.05], [2.2, 0.02, 0.06], "lamp", glow=True, omit=("top",))


build("kitchenette", fp)
