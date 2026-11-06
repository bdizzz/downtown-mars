# The exercise mat (#366), first person: a soft mat in the room colour with a ribbed surface, its far
# end starting to roll up, a folded towel and a skipping rope coiled on it with its two handles (the
# footprint is 5 cm tall, so everything lies flat).
# Run: blender -b --factory-startup -P models/gym_mat.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.soft([0, 0.008, 0.06], [0.96, 0.016, 1.84], "accent", round=0.4, puff=0.1, cuts=2, omit=("bottom",), tex="tread")
    m.lathe([0, 0.022, -0.92], [(0.0, -0.48), (0.022, -0.48), (0.022, 0.48), (0.0, 0.48)], "accent", seg=10, r=[0, 0, 90], tex="tread")
    m.lathe([0, 0.022, -0.92], [(0.0, -0.49), (0.01, -0.49), (0.0, -0.488)], "cushion", seg=10, r=[0, 0, 90])
    m.box([0, 0.025, -0.82], [0.96, 0.004, 0.03], "dark", omit=("bottom",))
    # A folded towel.
    m.soft([0.2, 0.026, 0.6], [0.36, 0.02, 0.26], "white", round=0.5, puff=0.3, cuts=1, r=[0, 10, 0], tex="fabric")
    m.soft([0.2, 0.041, 0.55], [0.36, 0.008, 0.14], "white", round=0.5, puff=0.3, cuts=1, r=[0, 10, 0], tex="fabric")
    # A skipping rope, coiled, and its handles.
    coil = [(-0.22 + 0.12 * math.cos(math.radians(a)) * (1 - a / 1500), 0.022, 0.4 + 0.15 * math.sin(math.radians(a)) * (1 - a / 1500)) for a in range(0, 541, 45)]
    m.sweep(coil + [(-0.02, 0.022, 0.62), (0.0, 0.022, 0.8)], 0.01, "dark", seg=4, smooth=1, caps=False)
    m.sweep([coil[0], (-0.05, 0.022, 0.3), (0.05, 0.022, 0.22)], 0.01, "dark", seg=4, smooth=2, caps=False)
    for x, z, a in ((0.0, 0.86, 0), (0.1, 0.2, 60)):
        m.cyl([x, 0.03, z], 0.026, 0.12, "power", seg=6, r=[90, a, 0])


build("gym_mat", fp)
