# The lathe (#357), first person (#360), remodelled with the richer kit (#361): a dark cabinet
# stand with two inset doors and handles and a vent grille in its end, a tread-plate plinth, a
# brushed drip tray and twin bed ways, a headstock in the room's colour with an inset control
# panel and a glowing readout, a turned chuck (lathe) with three jaws gripping a steel bar, a
# carriage with a handwheel and tool post, a rubber coolant hose curving down to the tool (sweep),
# and a tapered tailstock with a turned centre. Run: blender -b --factory-startup -P models/lathe.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build

AXIS = 1.12  # the spindle's height


def fp(m):
    # The cabinet stand: two doors inset in its front, each with a handle; a vent grille in its end.
    cab = m.box([0, 0.41, 0], [2.0, 0.7, 0.54], "dark", omit=("bottom",), tex="grain")
    for door in m.split(m.side(cab, "front")[0], 2, "right"):
        m.inset([door], 0.04, 0.008)
    for x in (-0.08, 0.08):
        m.sweep([(x, 0.5, 0.27), (x, 0.5, 0.29), (x, 0.32, 0.29), (x, 0.32, 0.27)], 0.016, "steel", seg=4, smooth=1, caps=False, tex="brushed")
    grille = m.split(m.side(cab, "right")[0], 5, "top")
    m.inset(grille, 0.025, 0.006, "rubber")
    m.box([0, 0.03, 0], [2.04, 0.06, 0.58], "metal", omit=("bottom",), tex="tread")  # the plinth
    m.box([0, 0.79, 0], [2.1, 0.05, 0.58], "steel", omit=("bottom",), tex="brushed")  # the drip tray
    for z in (-0.12, 0.12):
        m.box([0, 0.87, z], [2.2, 0.12, 0.1], "metal", bevel=0.01, edges="top", omit=("bottom", "left", "right"), tex="brushed")
    # The headstock: a control panel inset in its front, a glowing readout and two buttons.
    head = m.box([-0.78, AXIS, 0], [0.52, 0.5, 0.46], "accent", bevel=0.03, edges="upper", omit=("bottom",), tex="grain")
    m.inset(m.side(head, "front"), 0.05, 0.01, "dark")
    m.box([-0.84, 1.2, 0.232], [0.2, 0.12, 0.01], "glow", glow=True, omit=("back",))
    for x in (-0.66, -0.6):
        m.cyl([x, 1.04, 0.232], 0.035, 0.02, "hazard" if x < -0.63 else "metal", seg=8, r=[90, 0, 0])
    # The chuck, turned: a stepped body, its face, three jaws; the bar it holds.
    m.lathe([-0.53, AXIS, 0], [(0.06, 0), (0.15, 0.02), (0.16, 0.08), (0.14, 0.12), (0.05, 0.13)], "steel", seg=10, r=[0, 0, -90], tex="brushed")
    for a in (0, 120, 240):
        m.box([-0.39, AXIS, 0], [0.04, 0.05, 0.3], "metal", r=[a, 0, 0], omit=("left", "right"))
    m.cyl([0.05, AXIS, 0], 0.08, 0.9, "steel", seg=10, r=[0, 0, 90], caps=False, tex="brushed")  # the work
    # The carriage, its tool post, and a handwheel.
    m.box([0.15, 0.99, 0.02], [0.36, 0.12, 0.42], "metal", bevel=0.01, edges="upper", omit=("bottom",), tex="brushed")
    m.box([0.15, 1.08, 0.08], [0.09, 0.08, 0.09], "dark", omit=("bottom",))
    m.box([0.15, 1.1, 0.0], [0.03, 0.02, 0.14], "steel", omit=("front",))  # the tool
    ring = [(0.15 + 0.1 * math.cos(a / 8 * math.tau), 0.98 + 0.1 * math.sin(a / 8 * math.tau), 0.25) for a in range(9)]
    m.sweep(ring, 0.02, "steel", seg=4, smooth=1, caps=False, tex="brushed")
    m.cyl([0.15, 0.98, 0.23], 0.04, 0.05, "steel", seg=6, r=[90, 0, 0])
    m.cyl([0.24, 0.98, 0.27], 0.025, 0.04, "dark", seg=6, r=[90, 0, 0])  # the handle
    # The coolant hose, from the headstock's top round and down to the tool.
    m.sweep([(-0.62, 1.35, -0.12), (-0.3, 1.38, -0.1), (0.05, 1.35, -0.02), (0.14, 1.22, 0.02), (0.15, 1.15, 0.0)], 0.025, "rubber", seg=5, smooth=2)
    # The tailstock, tapered, and its turned centre.
    m.box([0.82, 1.06, 0], [0.32, 0.3, 0.34], "accent", taper=[0.75, 0.8], omit=("bottom",), tex="grain")
    m.lathe([0.5, AXIS, 0], [(0, 0), (0.03, 0.05), (0.035, 0.12), (0.045, 0.14), (0.045, 0.16)], "steel", seg=10, r=[0, 0, -90], tex="brushed")
    m.cyl([1.0, 1.1, 0], 0.12, 0.03, "steel", seg=8, r=[0, 0, 90])  # its wheel


build("lathe", fp)
