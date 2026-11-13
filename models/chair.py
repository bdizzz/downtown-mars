# The chair (#363), first person: a bent steel-tube frame (each back leg runs on up into the back's
# upright), braced near the floor and capped with rubber feet, a padded seat and a curved, padded
# back in the room's colour. Run: blender -b --factory-startup -P models/chair.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build

TUBE = 0.028
LEG_X, LEG_Z = 0.2, 0.19


def fp(m):
    for sx in (-1, 1):
        x = sx * LEG_X
        # The back leg, on up into the back's upright, leaning back a little at the top.
        m.sweep([(x, 0.02, -LEG_Z), (x, 0.42, -LEG_Z + 0.005), (x, 0.6, -LEG_Z - 0.01), (x, 0.92, -LEG_Z - 0.05)], TUBE, "metal", seg=6, smooth=3)
        # The front leg, and the rail under the seat that joins it to the back leg.
        m.cyl([x, 0.22, LEG_Z], TUBE, 0.4, "metal", seg=6, caps=False)
        m.cyl([x, 0.41, 0], TUBE * 0.9, 2 * LEG_Z, "metal", seg=6, r=[90, 0, 0], caps=False)
        # Rubber feet.
        for z in (-LEG_Z, LEG_Z):
            m.cyl([x, 0.012, z], TUBE + 0.008, 0.024, "rubber", seg=6)
    # Braces across, near the floor at the front and back.
    for z in (-LEG_Z, LEG_Z):
        m.cyl([0, 0.12, z], TUBE * 0.7, 2 * LEG_X, "metal", seg=5, r=[0, 0, 90], caps=False)
    # The seat: a thin pan and a padded cushion on it.
    m.box([0, 0.43, 0.01], [0.46, 0.02, 0.44], "dark", bevel=0.008, edges="vertical")
    m.soft([0, 0.465, 0.015], [0.45, 0.06, 0.44], "accent", round=0.6, puff=0.25, cuts=2, omit=("bottom",), tex="fabric")
    # The back: a padded panel, curved round the sitter, between the uprights.
    m.strip([(-0.19, -0.2), (-0.1, -0.225), (0, -0.232), (0.1, -0.225), (0.19, -0.2)], 0.6, 0.9, 0.03, "accent", tex="fabric")
    m.cyl([0, 0.905, -0.232], 0.03, 0.38, "accent", seg=6, r=[0, 0, 90], tex="fabric")


build("chair", fp)
