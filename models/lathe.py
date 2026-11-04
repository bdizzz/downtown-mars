# The lathe (#357; first person since #360): a dark cabinet stand with a drip tray, twin bed ways, a headstock in the
# room's colour with a glowing readout, a three-jaw chuck turning a steel bar, a carriage with
# its handwheel and tool post, and the tailstock. Run: blender -b --factory-startup -P models/lathe.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build

AXIS = 1.12  # the spindle's height


def fp(m):
    m.box([0, 0.38, 0], [2.0, 0.76, 0.6], "dark", bevel=0.02, edges="vertical", omit=("bottom",))
    m.box([0, 0.03, 0], [1.9, 0.06, 0.5], "metal", omit=("bottom", "top"))  # the plinth
    m.box([0, 0.79, 0], [2.1, 0.05, 0.6], "steel", omit=("bottom",))  # the drip tray
    for z in (-0.12, 0.12):
        m.box([0, 0.87, z], [2.2, 0.12, 0.1], "metal", omit=("bottom",))
    m.box([-0.78, AXIS, 0], [0.52, 0.5, 0.46], "accent", bevel=0.03, edges="upper", omit=("bottom",))
    m.box([-0.78, 1.2, 0.235], [0.22, 0.14, 0.01], "glow", glow=True, omit=("back",))
    m.cyl([-0.47, AXIS, 0], 0.3, 0.1, "steel", seg=8, r=[0, 0, 90])  # the chuck
    for a in (0, 120, 240):
        m.box([-0.4, AXIS, 0], [0.05, 0.05, 0.36], "metal", r=[a, 0, 0], omit=("left", "right"))
    m.cyl([0.05, AXIS, 0], 0.1, 0.9, "steel", seg=8, r=[0, 0, 90], caps=False)  # the work
    m.box([0.15, 0.99, 0.02], [0.36, 0.12, 0.42], "metal", omit=("bottom",))  # the carriage
    m.box([0.15, 1.08, 0.12], [0.08, 0.08, 0.08], "dark", omit=("bottom",))  # the tool post
    m.cyl([0.15, 0.99, 0.27], 0.2, 0.03, "steel", seg=8, r=[90, 0, 0])  # the handwheel
    m.box([0.82, 1.06, 0], [0.32, 0.3, 0.34], "accent", bevel=0.025, edges="upper", omit=("bottom",))
    m.cyl([0.6, AXIS, 0], 0.06, 0.14, "steel", seg=8, r=[0, 0, 90], d2=0.02)  # its centre


build("lathe", fp)
