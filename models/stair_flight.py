# The stair flight (#367), first person: sixteen tread-plate steps with hazard nosings and dark risers
# between two brushed steel stringers, and a handrail each side on round posts, its ends turned down.
# Run: blender -b --factory-startup -P models/stair_flight.py
import math
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build

STEPS = 16
RISE, RUN = 0.25, 0.4


def fp(m):
    for k in range(STEPS):
        y, z = 0.22 + RISE * k, 3.0 - RUN * k
        m.box([0, y, z], [2.6, 0.06, 0.42], "composite" if k % 2 else "accent", tex="tread")
        m.box([0, y + 0.031, z + 0.18], [2.6, 0.004, 0.05], "hazard", omit=("bottom", "back"))
        m.box([0, y - 0.125, z + 0.19], [2.6, 0.19, 0.02], "dark", omit=("back", "left", "right"))
    # The stringers.
    a = math.degrees(math.atan2(RISE, RUN))
    for x in (-1.33, 1.33):
        m.box([x, 2.0, 0], [0.06, 0.3, 6.647], "metal", r=[a, 0, 0], tex="brushed")
    # The handrails, 0.9 m over the nosings from the first step to the twelfth, their ends turned down, on posts.
    for x in (-1.33, 1.33):
        m.sweep([(x, 0.75, 3.12), (x, 1.07, 3.12), (x, 1.125, 3.0), (x, 3.875, -1.4), (x, 3.9, -1.52)], 0.05, "steel", seg=6, smooth=1, tex="brushed")
        for k in (0, 4, 8, 11):
            y, z = 0.25 + RISE * k, 3.0 - RUN * k
            m.cyl([x, y + 0.4375, z], 0.04, 0.875, "steel", seg=6, caps=False, tex="brushed")

build("stair_flight", fp)
