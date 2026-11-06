# The chart board (#365), first person: a whiteboard in a steel frame with a line chart drawn on it, a
# bar chart in the room's colour, a sheet under a clip, a printed plan pinned up, and a marker tray
# with two pens. Run: blender -b --factory-startup -P models/chart_board.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    frame = m.box([0, 0.45, 0.0], [1.4, 0.9, 0.04], "steel", omit=("back",), tex="brushed")
    m.inset(m.side(frame, "front"), 0.035, 0.008, "white")
    # Axes and a line chart.
    m.box([-0.55, 0.42, 0.016], [0.008, 0.5, 0.003], "dark", omit=("back",))
    m.box([-0.2, 0.17, 0.016], [0.7, 0.008, 0.003], "dark", omit=("back",))
    pts = [(-0.52, 0.28), (-0.4, 0.35), (-0.3, 0.31), (-0.16, 0.45), (-0.04, 0.42), (0.1, 0.58), (0.14, 0.6)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        m.box([(x0 + x1) / 2, (y0 + y1) / 2, 0.017], [L + 0.01, 0.014, 0.003], "blueprint", r=[0, 0, math.degrees(math.atan2(y1 - y0, x1 - x0))], omit=("back",))
    for k, h in enumerate((0.1, 0.16, 0.22, 0.13)):
        m.box([-0.48 + 0.1 * k, 0.18 + h / 2, 0.018], [0.06, h, 0.004], "accent", omit=("back",))
    # A sheet under a clip, and a pinned plan.
    m.box([0.45, 0.25, 0.017], [0.3, 0.22, 0.003], "power", r=[0, 0, -3], omit=("back",))
    m.box([0.45, 0.36, 0.022], [0.08, 0.02, 0.01], "dark", omit=("back",))
    m.box([0.42, 0.62, 0.017], [0.34, 0.26, 0.003], "blueprint", r=[0, 0, 2], omit=("back",))
    for x, y in ((0.27, 0.74), (0.57, 0.75)):
        m.cyl([x, y, 0.02], 0.02, 0.01, "red", seg=6, r=[90, 0, 0])
    # The marker tray and two markers.
    m.box([0, 0.025, 0.04], [1.2, 0.025, 0.07], "steel", omit=("back",), tex="brushed")
    m.box([0, 0.045, 0.072], [1.2, 0.02, 0.006], "steel", omit=("back",))
    m.cyl([-0.25, 0.05, 0.045], 0.022, 0.13, "blueprint", seg=6, r=[0, 0, 90])
    m.cyl([-0.08, 0.05, 0.045], 0.022, 0.13, "fire", seg=6, r=[0, 10, 90])


build("chart_board", fp)
