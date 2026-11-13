# The washer (#367), first person: a white cabinet with rounded corners on rubber feet, a porthole door
# (a steel rim round a domed window) with a hinge and a handle, a control strip with a dial, buttons
# and a glowing display, a detergent drawer, and a folded towel and a tub of pods on top.
# Run: blender -b --factory-startup -P models/laundry_machine.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.cyl([sx * 0.28, 0.02, sz * 0.24], 0.06, 0.04, "rubber", seg=6)
    m.box([0, 0.44, -0.02], [0.66, 0.8, 0.62], "white", bevel=0.04, seg=2, edges="vertical", omit=("bottom",))
    m.box([0, 0.07, 0.293], [0.6, 0.05, 0.01], "panel", omit=("back",))
    # The door.
    m.lathe([0, 0.45, 0.29], [(0.0, 0.0), (0.235, 0.0), (0.235, 0.02), (0.205, 0.04), (0.17, 0.035), (0.0, 0.035)], "steel", seg=14, r=[90, 0, 0], tex="brushed")
    m.lathe([0, 0.45, 0.322], [(0.165, 0.0), (0.16, 0.012), (0.1, 0.022), (0.0, 0.026)], "mirror", seg=14, r=[90, 0, 0], caps=False)
    m.box([-0.24, 0.45, 0.3], [0.04, 0.12, 0.03], "panel", bevel=0.008)
    m.box([0.215, 0.45, 0.325], [0.03, 0.09, 0.02], "dark", bevel=0.006)
    # The control strip.
    m.box([0, 0.78, 0.293], [0.62, 0.11, 0.008], "panel", omit=("back",))
    m.box([-0.2, 0.78, 0.299], [0.16, 0.07, 0.006], "white", omit=("back",))
    m.box([-0.2, 0.79, 0.303], [0.13, 0.008, 0.004], "dark", omit=("back",))
    m.lathe([0.04, 0.78, 0.297], [(0.035, 0.0), (0.033, 0.02), (0.0, 0.022)], "steel", seg=10, r=[90, 0, 0], caps=False)
    m.box([0.04, 0.795, 0.32], [0.006, 0.02, 0.004], "dark")
    m.box([0.2, 0.795, 0.3], [0.08, 0.04, 0.006], "glow", glow=True, omit=("back",))
    for k in range(3):
        m.box([0.15 + 0.05 * k, 0.755, 0.3], [0.03, 0.016, 0.008], "dark" if k else "plant", bevel=0.003, omit=("back",))
    # The detergent drawer, top left.
    m.box([-0.2, 0.86, 0.288], [0.2, 0.06, 0.02], "white", bevel=0.006, omit=("back",))
    m.box([-0.2, 0.86, 0.3], [0.08, 0.012, 0.006], "dark", omit=("back",))
    # On top: a folded towel and a tub of pods.
    m.soft([0.1, 0.865, -0.06], [0.32, 0.05, 0.24], "accent", round=0.5, puff=0.1, cuts=1, tex="fabric")
    m.lathe([-0.2, 0.84, -0.12], [(0.0, 0.0), (0.05, 0.0), (0.055, 0.045), (0.06, 0.05), (0.06, 0.058), (0.0, 0.058)], "water", seg=8)


build("laundry_machine", fp)
