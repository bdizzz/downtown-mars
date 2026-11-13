# The pipe run (#365), first person: a main pipe in brushed metal with bolted flanges and a valve
# whose hazard handwheel sits on top, a smaller pipe in the room's colour below it, three saddle
# stands with U-bolts, a little pressure gauge, and arrows showing the flow.
# Run: blender -b --factory-startup -P models/pipe_run.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.cyl([0, 0.6, 0], 0.24, 3.0, "metal", seg=10, caps=False, r=[0, 0, 90], tex="brushed")
    m.cyl([0, 0.3, 0.06], 0.16, 3.0, "accent", seg=8, caps=False, r=[0, 0, 90])
    for x in (-1.2, 0.0, 1.2):
        m.box([x, 0.02, 0], [0.12, 0.04, 0.34], "dark", omit=("bottom",))
        m.box([x, 0.24, -0.04], [0.08, 0.4, 0.08], "dark", omit=("bottom", "top"))
        m.box([x, 0.46, -0.03], [0.1, 0.04, 0.3], "dark", omit=("bottom",))
        m.sweep([(x, 0.47, 0.13), (x, 0.6, 0.15), (x, 0.73, 0.0), (x, 0.6, -0.15), (x, 0.47, -0.13)], 0.016, "steel", seg=4, smooth=2, caps=False)
        m.sweep([(x, 0.27, 0.15), (x, 0.38, 0.08), (x, 0.3, -0.03)], 0.014, "steel", seg=4, smooth=2, caps=False)
    for x in (-0.6, 0.6):
        m.cyl([x, 0.6, 0], 0.32, 0.06, "steel", seg=8, r=[0, 0, 90], tex="brushed")
        for a in range(30, 360, 120):
            r = math.radians(a)
            m.cyl([x, 0.6 + 0.13 * math.sin(r), 0.13 * math.cos(r)], 0.022, 0.09, "dark", seg=4, caps=False, r=[0, 0, 90])
    # The valve: a body, a stem and a handwheel.
    m.lathe([0.6, 0.72, 0], [(0.07, 0), (0.06, 0.06), (0.025, 0.08), (0.02, 0.12)], "dark", seg=8)
    ring = [(0.6 + 0.08 * math.cos(a / 10 * math.tau), 0.85, 0.08 * math.sin(a / 10 * math.tau)) for a in range(11)]
    m.sweep(ring, 0.02, "hazard", seg=3, smooth=1, caps=False)
    for a in (0, 120, 240):
        m.box([0.6, 0.85, 0], [0.16, 0.012, 0.012], "hazard", r=[0, a, 0])
    # A pressure gauge on a stub, and flow arrows.
    m.cyl([-0.9, 0.72, 0], 0.03, 0.08, "steel", seg=6)
    m.cyl([-0.9, 0.8, 0.0], 0.11, 0.04, "steel", seg=10, r=[90, 0, 0], tex="brushed")
    m.box([-0.9, 0.8, 0.022], [0.07, 0.07, 0.004], "white", r=[0, 0, 45], omit=("back",))
    m.box([-0.89, 0.81, 0.026], [0.04, 0.006, 0.004], "fire", r=[0, 0, 35], omit=("back",))
    for x in (-0.3, 0.9):
        m.box([x, 0.6, 0.121], [0.2, 0.04, 0.004], "hazard", omit=("back",))
        m.box([x + 0.11, 0.6, 0.121], [0.05, 0.05, 0.004], "hazard", r=[0, 0, 45], omit=("back",))


build("pipe_run", fp)
