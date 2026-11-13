# The tool pegboard (#365), first person: a perforated composite board with its tools hung on pegs: a
# wrench, two screwdrivers, pliers, a hammer, a handsaw, a tape measure, a coil of wire and a spool.
# Run: blender -b --factory-startup -P models/tool_board.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.45, 0.0], [1.2, 0.9, 0.025], "composite", omit=("back",), tex="perforated")
    for x, y in ((-0.4, 0.84), (-0.2, 0.8), (-0.05, 0.75), (0.05, 0.75), (0.28, 0.72), (0.3, 0.32), (-0.35, 0.3), (0.0, 0.3)):
        m.cyl([x, y, 0.03], 0.012, 0.05, "steel", seg=4, r=[90, 0, 0])
    # A wrench, two screwdrivers, pliers.
    m.box([-0.4, 0.6, 0.025], [0.04, 0.42, 0.012], "steel", omit=("back",), tex="brushed")
    m.sweep([(-0.43, 0.82, 0.025), (-0.45, 0.86, 0.025), (-0.4, 0.88, 0.025), (-0.35, 0.86, 0.025), (-0.37, 0.82, 0.025)], 0.02, "steel", seg=4, smooth=2, caps=False)
    m.lathe([-0.4, 0.38, 0.025], [(0.0, 0.0), (0.035, 0.02), (0.03, 0.05), (0.0, 0.06)], "steel", seg=6, r=[90, 0, 0])
    for x, c in ((-0.22, "fire"), (-0.15, "blueprint")):
        m.lathe([x, 0.5, 0.03], [(0.0, 0.0), (0.018, 0.02), (0.02, 0.1), (0.012, 0.13)], c, seg=6)
        m.cyl([x, 0.42, 0.03], 0.008, 0.16, "steel", seg=4)
    for s in (-1, 1):
        m.sweep([(0.0, 0.73, 0.03), (0.01 * s, 0.6, 0.03), (0.04 * s, 0.45, 0.03)], 0.025, "fire", seg=4, smooth=2)
        m.box([0.006 * s, 0.79, 0.03], [0.02, 0.1, 0.012], "steel", r=[0, 0, -6 * s], omit=("back",))
    # A hammer, a handsaw.
    m.cyl([0.28, 0.6, 0.035], 0.035, 0.32, "fibre", seg=6, tex="grain")
    m.box([0.28, 0.77, 0.035], [0.2, 0.05, 0.05], "metal", bevel=0.008, edges="all", tex="brushed")
    m.box([0.45, 0.6, 0.025], [0.16, 0.36, 0.006], "steel", taper=[0.5, 1], omit=("back",), tex="brushed")
    m.soft([0.45, 0.8, 0.03], [0.14, 0.1, 0.035], "red", round=0.6, puff=0.0, cuts=1)
    # A tape measure, a coil of wire, a spool.
    m.cyl([0.3, 0.22, 0.04], 0.13, 0.05, "hazard", seg=10, r=[90, 0, 0])
    m.cyl([0.3, 0.22, 0.066], 0.05, 0.004, "dark", seg=8, r=[90, 0, 0])
    ring = [(-0.35 + 0.11 * math.cos(a / 10 * math.tau), 0.2 + 0.11 * math.sin(a / 10 * math.tau), 0.04 + 0.01 * (a % 2)) for a in range(11)]
    m.sweep(ring, 0.025, "copper", seg=5, smooth=1, caps=False)
    m.lathe([0.0, 0.18, 0.04], [(0.07, 0), (0.07, 0.015), (0.05, 0.02), (0.05, 0.1), (0.07, 0.105), (0.07, 0.12)], "blueprint", seg=10, r=[0, 0, 90])


build("tool_board", fp)
