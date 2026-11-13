# The side table (#364), first person: a turned steel pedestal on a weighted base, a round
# composite top with a lip, and a little lamp on it: a turned base, a stem and a glowing globe
# in a cream shade. Run: blender -b --factory-startup -P models/side_table.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.lathe([0, 0, 0], [(0.18, 0.0), (0.18, 0.015), (0.16, 0.035), (0.05, 0.05), (0.03, 0.07), (0.03, 0.54), (0.06, 0.56), (0.0, 0.57)], "metal", seg=12, tex="brushed")
    m.lathe([0, 0, 0], [(0.0, 0.565), (0.25, 0.565), (0.25, 0.6), (0.24, 0.607), (0.0, 0.607)], "composite", seg=16, tex="grain")
    # The lamp: a base, a stem, a globe and a shade.
    m.lathe([0.08, 0.607, 0.05], [(0.05, 0.0), (0.05, 0.015), (0.02, 0.03), (0.012, 0.04), (0.012, 0.17), (0.0, 0.18)], "metal", seg=8, tex="brushed")
    m.lathe([0.08, 0.607, 0.05], [(0.0, 0.15), (0.045, 0.17), (0.05, 0.22), (0.03, 0.26), (0.0, 0.265)], "lamp", seg=8, glow=True)
    m.lathe([0.08, 0.607, 0.05], [(0.09, 0.16), (0.06, 0.32)], "cream", seg=10, caps=False, tex="fabric")


build("side_table", fp)
