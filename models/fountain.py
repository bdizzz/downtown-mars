# The fountain (#366), first person: a round stone basin with a rolled lip and a rim in the room
# colour, lily pads on its water, a turned pedestal with mouldings holding an upper bowl, six streams
# of water arcing from the bowl's lip, and a jet rising from its middle.
# Run: blender -b --factory-startup -P models/fountain.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.lathe([0, 0, 0], [(1.15, 0.0), (1.2, 0.44), (1.24, 0.47), (1.22, 0.52), (1.1, 0.52), (1.08, 0.46)], "stone", seg=14, caps=False)
    m.lathe([0, 0.5, 0], [(1.25, 0.0), (1.25, 0.03), (1.18, 0.04), (1.18, 0.0)], "accent", seg=14, caps=False)
    m.cyl([0, 0.44, 0], 2.16, 0.02, "water", seg=14)
    for i, (r, a) in enumerate(((0.7, 30), (0.85, 150), (0.6, 250))):
        x, z = r * math.cos(math.radians(a)), r * math.sin(math.radians(a))
        m.cyl([x, 0.455, z], 0.18, 0.008, "leaf", seg=7)
        if i == 1:
            m.lathe([x + 0.03, 0.46, z], [(0.0, 0.0), (0.035, 0.015), (0.0, 0.035)], "flower", seg=5)
    # The pedestal and the upper bowl.
    m.lathe([0, 0.45, 0], [(0.24, 0.0), (0.22, 0.05), (0.16, 0.08), (0.12, 0.12), (0.11, 0.55), (0.14, 0.6), (0.14, 0.64), (0.0, 0.64)], "stone", seg=8)
    m.lathe([0, 1.08, 0], [(0.0, 0.0), (0.12, 0.0), (0.3, 0.08), (0.37, 0.15), (0.36, 0.17), (0.3, 0.12)], "stone", seg=12, caps=False)
    m.cyl([0, 1.19, 0], 0.62, 0.02, "water", seg=12)
    # Streams arcing from the bowl's lip down to the basin, and the jet.
    for k in range(6):
        a = 30 + 60 * k
        x, z = 0.36 * math.cos(math.radians(a)), 0.36 * math.sin(math.radians(a))
        m.blade([x, 1.23, z], a, 15, 0.42, 0.07, "water", droop=0.78, seg=2)
    m.lathe([0, 1.2, 0], [(0.05, 0.0), (0.02, 0.35), (0.06, 0.48), (0.0, 0.55)], "water", seg=8)


build("fountain", fp)
