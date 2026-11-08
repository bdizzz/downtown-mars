# The memorial stone (#367), first person: an arched headstone on a stepped stone base, a copper plate
# of lines set into its face, two candles burning in copper dishes, and a posy of leaves and flowers
# laid at its foot.
# Run: blender -b --factory-startup -P models/memorial.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.06, 0], [0.9, 0.12, 0.6], "stone", bevel=0.015, edges="upper", omit=("bottom",))
    m.box([0, 0.16, -0.04], [0.76, 0.08, 0.36], "stone", bevel=0.012, edges="upper", omit=("bottom",))
    # The headstone: a slab with an arched top.
    slab = m.box([0, 0.47, -0.04], [0.66, 0.54, 0.22], "stone", omit=("bottom", "top"))
    m.cyl([0, 0.67, -0.04], 0.66, 0.22, "stone", seg=16, r=[90, 0, 0])
    m.box([0, 0.76, 0.071], [0.36, 0.26, 0.006], "copper", omit=("back",), tex="brushed")
    for k, w in enumerate((0.24, 0.18, 0.26, 0.2, 0.12)):
        m.box([0, 0.85 - 0.045 * k, 0.075], [w, 0.016 if k else 0.022, 0.003], "dark", omit=("back",))
    m.box([0, 0.5, 0.071], [0.5, 0.012, 0.004], "copper", omit=("back",))
    # The candles in their dishes.
    for x in (-0.3, 0.3):
        m.lathe([x, 0.12, 0.18], [(0.0, 0.0), (0.06, 0.0), (0.07, 0.015), (0.06, 0.02), (0.0, 0.01)], "copper", seg=10, tex="brushed")
        m.lathe([x, 0.13, 0.18], [(0.0, 0.0), (0.035, 0.0), (0.035, 0.15), (0.03, 0.165), (0.0, 0.16)], "white", seg=8)
        m.cyl([x + 0.03, 0.25, 0.18], 0.012, 0.05, "white", seg=4)
        m.cyl([x, 0.3, 0.18], 0.004, 0.02, "dark", seg=4, caps=False)
        m.lathe([x, 0.3, 0.18], [(0.0, 0.0), (0.016, 0.02), (0.012, 0.04), (0.0, 0.07)], "fire", glow=True, seg=6, caps=False)
    # The posy at its foot.
    for k in range(7):
        m.blade([0.08, 0.125, 0.05], -60 + 20 * k, 8, 0.2, 0.05, "leaf" if k % 2 else "plant", droop=0.03, seg=2)
    for k, (x, z, c) in enumerate(((0.2, 0.0, "flower"), (0.24, 0.08, "red"), (0.16, 0.12, "flower"), (0.27, -0.04, "power"))):
        m.lathe([x, 0.13, z], [(0.0, 0.0), (0.03, 0.015), (0.025, 0.03), (0.0, 0.035)], c, seg=6, caps=False)
    m.cyl([0.04, 0.135, 0.05], 0.04, 0.12, "fibre", seg=6, r=[90, 0, 70])


build("memorial", fp)
