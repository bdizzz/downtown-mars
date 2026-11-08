# The kit container (#367), first person: a corrugated shipping container in the room colour with dark
# corner castings, its double doors on the front ribbed and held by four locking bars with handles and
# cam keepers, a hazard placard and stencilled codes, and a dark roof.
# Run: blender -b --factory-startup -P models/kit_container.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build

W, H, D = 3.2, 2.5, 2.4
Z0 = 0.0  # its centre, front to back


def fp(m):
    body = m.box([0, 1.27, Z0], [W - 0.12, 2.42, D - 0.12], "accent", omit=("bottom",))
    for s in ("left", "right", "back"):
        strips = m.split(m.side(body, s)[0], 7 if s != "back" else 6, "front" if s != "back" else "right")
        m.inset(strips, 0.03, 0.035)
    m.box([0, 2.495, Z0], [W - 0.16, 0.01, D - 0.16], "dark", omit=("bottom",))
    # Corner posts and castings.
    for kx in (-1, 1):
        for kz in (-1, 1):
            x, z = kx * (W / 2 - 0.08), Z0 + kz * (D / 2 - 0.08)
            m.box([x, 1.25, z], [0.16, 2.26, 0.16], "accent", omit=("bottom", "top"))
            for y in (0.06, 2.44):
                m.box([x, y, z], [0.16, 0.12, 0.16], "dark", omit=("bottom",) if y < 1 else ())
    for y in (0.06, 2.44):
        m.box([0, y, Z0 + D / 2 - 0.08], [W - 0.32, 0.12, 0.12], "dark", omit=("bottom",) if y < 1 else ())
    # The doors: ribs, the seam, locking bars and handles.
    zf = Z0 + D / 2 - 0.06
    for k in range(-4, 5):
        if k == 0:
            continue
        m.box([(1 if k > 0 else -1) * (0.15 + 0.3 * (abs(k) - 1)), 1.25, zf + 0.015], [0.08, 2.2, 0.03], "accent", omit=("back",))
    m.box([0, 1.25, zf + 0.012], [0.02, 2.24, 0.025], "dark", omit=("back",))
    for x in (-0.95, -0.35, 0.35, 0.95):
        m.cyl([x, 1.25, zf + 0.06], 0.04, 2.24, "steel", seg=6, tex="brushed")
        for y in (0.17, 2.33):
            m.box([x, y, zf + 0.045], [0.1, 0.08, 0.06], "dark")
        m.box([x + (0.08 if x < 0 else -0.08), 0.95, zf + 0.085], [0.18, 0.04, 0.03], "steel")
        m.box([x + (0.16 if x < 0 else -0.16), 0.95, zf + 0.05], [0.04, 0.12, 0.04], "dark")
    # The placard and codes.
    m.box([0.62, 1.95, zf + 0.04], [0.5, 0.32, 0.01], "hazard", omit=("back",))
    m.box([0.62, 1.95, zf + 0.047], [0.3, 0.1, 0.006], "dark", omit=("back",))
    for k in range(4):
        m.box([-0.78 + k * 0.1, 1.95, zf + 0.04], [0.07, 0.12, 0.008], "white", omit=("back",))


build("kit_container", fp)
