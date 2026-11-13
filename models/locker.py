# The locker (#364), first person: a steel cabinet on a dark plinth under a dark cap, its door
# inset with three vent louvres at the top, a name-card slot, a lever handle and a padlock.
# Run: blender -b --factory-startup -P models/locker.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    body = m.box([0, 0.97, 0], [0.6, 1.82, 0.5], "metal", omit=("bottom", "back"), tex="brushed")
    m.box([0, 0.03, 0], [0.62, 0.06, 0.52], "dark", omit=("bottom",))
    m.box([0, 1.915, 0], [0.62, 0.05, 0.52], "dark", bevel=0.01, edges="upper", omit=("bottom",))
    # The door: a panel inset in the front, louvres near its top.
    door = m.inset(m.side(body, "front"), 0.025, 0.004)
    for k in range(3):
        m.box([0, 1.56 + k * 0.07, 0.252], [0.4, 0.025, 0.02], "dark", r=[-30, 0, 0], omit=("back",))
    # A name card in a slot, the handle and a padlock through it.
    m.box([0, 1.36, 0.252], [0.16, 0.06, 0.006], "dark", omit=("back",))
    m.box([0, 1.36, 0.256], [0.13, 0.04, 0.004], "cream", omit=("back",))
    m.box([0.18, 1.0, 0.258], [0.05, 0.18, 0.014], "dark", bevel=0.004, edges="vertical", omit=("back",))
    m.sweep([(0.18, 1.04, 0.265), (0.18, 1.04, 0.278), (0.18, 0.92, 0.278)], 0.022, "steel", seg=5, smooth=1, tex="brushed")
    m.box([0.22, 0.95, 0.265], [0.05, 0.05, 0.02], "copper", bevel=0.008, omit=("back",))
    m.sweep([(0.205, 0.975, 0.265), (0.205, 1.0, 0.265), (0.235, 1.0, 0.265), (0.235, 0.975, 0.265)], 0.008, "steel", seg=4, smooth=2, caps=False)


build("locker", fp)
