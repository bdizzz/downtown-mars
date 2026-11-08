# The scaffolding (#367), first person: four hazard-yellow tube standards on base plates and screw
# jacks, ledgers and transoms at two lifts, a diagonal brace each side, grained boards on both decks
# with toe boards, a guard rail on the top, and a tool box up there.
# Run: blender -b --factory-startup -P models/scaffold.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build

X, Z = 1.18, 0.48  # the standards' positions


def fp(m):
    for x in (-X, X):
        for z in (-Z, Z):
            m.cyl([x, 1.53, z], 0.05, 2.94, "hazard", seg=6, caps=False)
            m.cyl([x, 2.995, z], 0.056, 0.01, "dark", seg=6)
            m.box([x, 0.005, z], [0.14, 0.01, 0.14], "dark", omit=("bottom",))
            m.cyl([x, 0.04, z], 0.03, 0.08, "steel", seg=5, caps=False, tex="brushed")
            m.cyl([x, 0.07, z], 0.09, 0.02, "dark", seg=6)
    for y in (0.97, 1.97):
        for z in (-Z, Z):
            m.cyl([0, y, z], 0.045, 2.42, "hazard", seg=6, caps=False, r=[0, 0, 90])
        for x in (-X, X):
            m.cyl([x, y, 0], 0.045, 1.0, "hazard", seg=6, caps=False, r=[90, 0, 0])
        # The boards and toe boards.
        for k in range(4):
            m.box([0, y + 0.045, -0.36 + 0.24 * k], [2.42, 0.04, 0.22], "composite", bevel=0.006, edges="top", omit=("bottom",) if y < 1.5 else (), tex="grain")
        m.box([0, y + 0.13, Z - 0.02], [2.36, 0.15, 0.025], "composite", tex="grain")
    # The guard rail on top.
    for z in (-Z, Z):
        m.cyl([0, 2.95, z], 0.045, 2.42, "hazard", seg=6, caps=False, r=[0, 0, 90])
    for x in (-X, X):
        m.cyl([x, 2.95, 0], 0.045, 1.0, "hazard", seg=6, caps=False, r=[90, 0, 0])
    # The diagonal braces on the front and back.
    for z in (-Z - 0.03, Z + 0.03):
        m.sweep([(-X, 0.12, z), (X, 1.9, z)], 0.04, "metal", seg=5, smooth=1)
        for x, y in ((-X + 0.05, 0.16), (X - 0.05, 1.86)):
            m.box([x, y, z], [0.07, 0.07, 0.05], "dark")
    # The tool box on the top deck.
    m.box([0.4, 2.15, 0.0], [0.42, 0.2, 0.22], "accent", bevel=0.01, edges="vertical")
    m.box([0.4, 2.26, 0.0], [0.44, 0.03, 0.24], "accent", bevel=0.01, edges="top")
    m.sweep([(0.28, 2.27, 0), (0.3, 2.33, 0), (0.5, 2.33, 0), (0.52, 2.27, 0)], 0.018, "dark", seg=4, smooth=1, caps=False)


build("scaffold", fp)
