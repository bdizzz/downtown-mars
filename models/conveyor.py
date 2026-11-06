# The conveyor (#365), first person: steel legs with cross braces, a dark frame with hazard side
# guards, a rubber belt over turned rollers at each end, a drive motor, an emergency stop, and crates
# and a rock riding the belt. Run: blender -b --factory-startup -P models/conveyor.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def _rock(m, x, y, z, s, c, k):
    """A lump of rock: a five-sided lathe, squat and turned by a fixed hash."""
    h = math.sin(k * 12.9898) * 43758.5453
    j = (h - math.floor(h)) * 2 - 1
    m.lathe([x, y, z], [(0.0, 0.0), (s * 0.5, s * 0.08), (s * 0.42, s * 0.42), (0.0, s * (0.55 + 0.12 * j))], c, seg=5, r=[12 * j, 70 * j, 9 * j])


def fp(m):
    for x in (-1.2, 0.0, 1.2):
        for z in (-0.33, 0.33):
            m.box([x, 0.4, z], [0.06, 0.8, 0.06], "metal", omit=("bottom",), tex="brushed")
        m.box([x, 0.2, 0], [0.04, 0.04, 0.66], "metal", omit=("left", "right"))
    m.box([0, 0.8, 0], [2.8, 0.1, 0.72], "dark", omit=("bottom",))
    m.box([0, 0.86, 0], [2.8, 0.025, 0.6], "rubber", omit=("bottom",), tex="tread")
    for x in (-1.36, 1.36):
        m.cyl([x, 0.82, 0], 0.14, 0.62, "steel", seg=10, r=[90, 0, 0], tex="brushed")
    for z in (-0.38, 0.38):
        m.box([0, 0.92, z], [2.9, 0.12, 0.04], "hazard", omit=("bottom",))
    m.lathe([1.0, 0.55, -0.32], [(0.0, 0.0), (0.12, 0.0), (0.13, 0.04), (0.13, 0.32), (0.09, 0.36), (0.0, 0.36)], "accent", seg=10, r=[90, 0, 0])
    m.sweep([(1.0, 0.55, 0.06), (1.0, 0.68, 0.12), (1.3, 0.78, 0.15)], 0.05, "rubber", seg=4, smooth=2, caps=False)
    m.box([-1.35, 1.0, 0.37], [0.1, 0.08, 0.05], "hazard")
    m.cyl([-1.35, 1.06, 0.37], 0.07, 0.04, "red", seg=8)
    crate = m.box([-0.7, 1.02, 0], [0.48, 0.3, 0.42], "composite", omit=("bottom",), tex="grain")
    m.inset(m.side(crate, "front"), 0.04, 0.012)
    crate = m.box([0.35, 1.0, 0.02], [0.42, 0.26, 0.38], "composite", r=[0, 8, 0], omit=("bottom",), tex="grain")
    m.inset(m.side(crate, "top"), 0.04, 0.012)
    _rock(m, 0.95, 0.87, -0.05, 0.3, "rust", 3)


build("conveyor", fp)
