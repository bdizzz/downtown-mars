# The stove counter (#366), first person: a cabinet with a composite door and an oven whose window
# glows with the fire, four burners on a steel top with a stockpot and a frying pan on them, control
# knobs, a stone splashback and a tapered steel hood with a glowing light under it.
# Run: blender -b --factory-startup -P models/stove_counter.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    base = m.box([0, 0.46, 0], [2.0, 0.84, 0.68], "panel", omit=("bottom", "back", "top"), tex="grain")
    m.box([0, 0.04, 0.02], [1.96, 0.08, 0.62], "dark", omit=("bottom",))
    left, right = sorted(m.split(m.side(base, "front")[0], 2, "right"), key=lambda f: f.calc_center_median().x)
    m.inset([left], 0.03, 0.008, "composite", tex="grain")
    m.inset([right], 0.05, 0.012, "dark")
    m.box([0.5, 0.42, 0.33], [0.6, 0.3, 0.01], "fire", glow=True, omit=("back",))
    m.sweep([(0.2, 0.76, 0.34), (0.2, 0.76, 0.37), (0.8, 0.76, 0.37), (0.8, 0.76, 0.34)], 0.025, "steel", seg=6, smooth=1, caps=False, tex="brushed")
    m.sweep([(-0.75, 0.75, 0.34), (-0.75, 0.75, 0.36)], 0.02, "steel", seg=6, smooth=1, tex="brushed")
    for x in (-0.85, -0.65, -0.45, -0.25):
        m.cyl([x, 0.8, 0.355], 0.045, 0.03, "dark", seg=8, r=[90, 0, 0])
    # The steel top, four burners, a stockpot and a pan.
    m.box([0, 0.9, 0], [2.04, 0.04, 0.72], "steel", omit=("bottom",), tex="brushed")
    for x in (-0.75, -0.35):
        for z in (-0.15, 0.15):
            m.cyl([x, 0.927, z], 0.24, 0.014, "dark", seg=8)
            m.box([x, 0.938, z], [0.24, 0.012, 0.02], "metal", omit=("bottom",))
            m.box([x, 0.938, z], [0.02, 0.012, 0.24], "metal", omit=("bottom",))
    m.lathe([-0.75, 0.944, 0.15], [(0.12, 0.0), (0.135, 0.01), (0.135, 0.17), (0.14, 0.18), (0.125, 0.18), (0.125, 0.03)], "steel", seg=12, caps=False, tex="brushed")
    m.cyl([-0.75, 1.1, 0.15], 0.25, 0.01, "rust", seg=12)
    for sx in (-1, 1):
        m.sweep([(-0.75 + sx * 0.13, 1.08, 0.15), (-0.75 + sx * 0.17, 1.09, 0.15), (-0.75 + sx * 0.17, 1.05, 0.15)], 0.018, "dark", seg=4, smooth=2, caps=False)
    m.lathe([-0.35, 0.944, -0.15], [(0.11, 0.0), (0.135, 0.04), (0.125, 0.04), (0.1, 0.008), (0.0, 0.008)], "dark", seg=12, caps=False)
    m.box([-0.35, 0.972, 0.08], [0.035, 0.02, 0.24], "dark", r=[-8, 0, 0])
    # The splashback, the hood and its light.
    m.box([0, 1.4, -0.33], [2.0, 0.96, 0.02], "stone", omit=("back",))
    m.box([0, 2.07, -0.2], [2.0, 0.36, 0.34], "steel", taper=[0.94, 0.6], omit=("back",), tex="brushed")
    m.box([0, 1.88, -0.12], [1.8, 0.02, 0.12], "lamp", glow=True, omit=("top",))


build("stove_counter", fp)
