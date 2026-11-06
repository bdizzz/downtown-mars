# The gauges (#365), first person: a brushed steel plate, three round gauges in turned bezels with
# white faces, tick marks and fire-orange needles, copper lines feeding them from below, and a hazard
# label strip. Run: blender -b --factory-startup -P models/gauge_panel.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.3, 0.0], [0.9, 0.6, 0.04], "metal", bevel=0.01, edges="vertical", omit=("back",), tex="brushed")
    for k, x in enumerate((-0.27, 0.03, 0.3)):
        m.lathe([x, 0.37, 0.02], [(0.1, 0), (0.095, 0.03), (0.08, 0.03)], "steel", seg=12, caps=False, r=[90, 0, 0], tex="brushed")
        m.lathe([x, 0.37, 0.045], [(0.081, 0), (0.0, 0.0)], "white", seg=12, r=[90, 0, 0])
        for t in range(3):
            a = math.radians(-120 + 120 * t)
            m.box([x + 0.06 * math.sin(a), 0.37 + 0.06 * math.cos(a), 0.047], [0.006, 0.02, 0.003], "dark", r=[0, 0, -math.degrees(a)], omit=("back",))
        a = (-60, 15, 80)[k]
        m.box([x + 0.025 * math.sin(math.radians(a)), 0.37 + 0.025 * math.cos(math.radians(a)), 0.05], [0.008, 0.07, 0.004], "fire", r=[0, 0, -a], omit=("back",))
        m.cyl([x, 0.37, 0.052], 0.016, 0.008, "dark", seg=6, r=[90, 0, 0])
        m.sweep([(x, 0.0, 0.035), (x, 0.2, 0.035), (x, 0.27, 0.02)], 0.018, "copper", seg=5, smooth=1, caps=False)
        m.cyl([x, 0.245, 0.032], 0.03, 0.02, "dark", seg=6)
    m.box([0, 0.08, 0.021], [0.7, 0.05, 0.004], "hazard", omit=("back",))
    for x in (-0.42, 0.42):
        for y in (0.04, 0.56):
            m.cyl([x, y, 0.022], 0.018, 0.006, "dark", seg=6, r=[90, 0, 0])


build("gauge_panel", fp)
