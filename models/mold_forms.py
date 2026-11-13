# The mould forms (#365), first person: two grained composite forms held by steel corner clamps, one
# filled level with fresh concrete and a trowel resting on it, the other with a mesh of rust-red rebar
# tied in, waiting for its pour. Run: blender -b --factory-startup -P models/mold_forms.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    for x in (-0.53, 0.53):
        form = m.box([x, 0.3, 0], [0.9, 0.6, 1.1], "composite", omit=("bottom",), tex="grain")
        m.inset(m.side(form, "top"), 0.06, 0.04 if x < 0 else 0.4, "stone" if x < 0 else "soil")
        for sx in (-1, 1):
            for sz in (-1, 1):
                m.box([x + sx * 0.42, 0.3, sz * 0.52], [0.08, 0.5, 0.08], "steel", tex="brushed")
        for z in (-0.3, 0.3):
            m.box([x, 0.06, z], [0.94, 0.04, 0.05], "dark", omit=("bottom",))
    m.box([-0.5, 0.565, 0.1], [0.28, 0.01, 0.12], "steel", r=[0, 25, 0], tex="brushed")
    m.cyl([-0.62, 0.585, 0.16], 0.025, 0.12, "fibre", seg=6, r=[0, 25, 90])
    for k in range(4):
        m.cyl([0.55, 0.38, -0.36 + 0.24 * k], 0.022, 0.78, "rust", seg=4, caps=False, r=[0, 0, 90])
    for k in range(3):
        m.cyl([0.3 + 0.25 * k, 0.4, 0.0], 0.022, 1.02, "rust", seg=4, caps=False, r=[90, 0, 0])


build("mold_forms", fp)
