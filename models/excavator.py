# The excavator (#365), first person: rubber tracks with their rollers and sprockets, a dark
# undercarriage and turntable, a hazard-yellow body with a grilled engine cover and counterweight, a
# cab with glass windows in a dark frame and a seat inside, a boom and stick worked by steel rams, and
# a toothed bucket resting on the floor. Run: blender -b --factory-startup -P models/excavator.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for x in (-0.75, 0.75):
        m.box([x, 0.21, -0.2], [0.42, 0.42, 2.4], "rubber", bevel=0.18, seg=3, edges="vertical", r=[0, 0, 90], tex="tread")
        m.box([x * 0.7, 0.27, -0.2], [0.04, 0.22, 1.8], "dark", omit=("bottom",))
        for z in (-0.9, -0.45, 0.0, 0.45):
            m.cyl([x * 1.287, 0.16, z], 0.16, 0.02, "metal", seg=8, r=[0, 0, 90])
        m.cyl([x * 1.287, 0.21, -1.22], 0.34, 0.02, "dark", seg=8, r=[0, 0, 90])
    m.box([0, 0.5, -0.2], [1.1, 0.2, 1.4], "dark", omit=("bottom",))
    m.lathe([0, 0.6, -0.3], [(0.6, 0.0), (0.6, 0.08)], "dark", seg=12)
    body = m.box([0, 1.0, -0.45], [1.8, 0.7, 1.7], "hazard", omit=("bottom",))
    m.inset(m.split(m.side(body, "top")[0], 5, "front"), 0.03, 0.02, "dark")
    m.box([0, 1.0, -1.3], [1.7, 0.6, 0.12], "dark", bevel=0.03, edges="all")
    cab = m.box([-0.45, 1.75, -0.1], [0.8, 0.85, 0.9], "dark", omit=("bottom",))
    m.inset(m.side(cab, "front"), 0.05, 0.02, "mirror")
    m.inset(m.side(cab, "left"), 0.05, 0.02, "mirror")
    m.box([-0.45, 2.2, -0.1], [0.86, 0.04, 0.96], "hazard", omit=("bottom",))
    m.soft([-0.45, 1.5, -0.2], [0.4, 0.1, 0.4], "cushion", round=0.6, cuts=1, tex="fabric")
    m.box([0.35, 1.45, 0.1], [0.24, 0.24, 1.5], "hazard", r=[-40, 0, 0])
    m.box([0.35, 1.95, 1.0], [0.2, 0.2, 1.2], "hazard", r=[35, 0, 0])
    m.cyl([0.35, 1.25, 0.2], 0.1, 1.1, "steel", seg=6, r=[-48, 0, 0], tex="brushed")
    m.cyl([0.35, 2.05, 0.75], 0.08, 0.8, "steel", seg=6, r=[60, 0, 0], tex="brushed")
    bucket = m.box([0.35, 0.55, 1.45], [0.7, 0.5, 0.45], "metal", r=[-25, 0, 0], tex="tread")
    for x in (0.15, 0.35, 0.55):
        m.box([x, 0.28, 1.62], [0.06, 0.12, 0.12], "steel", taper=[0.6, 0.4], r=[180, 0, 0])


build("excavator", fp)
