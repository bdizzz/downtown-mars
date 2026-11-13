# The cubbies (#366), first person: a grained composite unit of six open cubbies on a plinth, with a
# name card on each, and in them backpacks and a lunch box in bright colours, one bag's strap hanging.
# Run: blender -b --factory-startup -P models/cubbies.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build


def fp(m):
    m.box([0, 0.6, -0.21], [1.6, 1.2, 0.03], "composite", omit=("back",), tex="grain")
    for y in (0.06, 0.62, 1.18):
        m.box([0, y, 0.0], [1.6, 0.04 if y < 1 else 0.04, 0.45], "composite", bevel=0.006, seg=1, edges="all", tex="grain")
    for x in (-0.78, -0.27, 0.27, 0.78):
        m.box([x, 0.62, 0.0], [0.04, 1.12, 0.45], "composite", tex="grain")
    m.box([0, 0.02, 0.0], [1.56, 0.04, 0.4], "dark", omit=("bottom",))
    # Name cards and what's in each cubby.
    contents = (("accent", 0), ("leaf", 1), ("rust", 0), ("hazard", 2), ("water", 1), ("cream", 0))
    for i, (c, kind) in enumerate(contents):
        x = (-0.53, 0.0, 0.53)[i % 3]
        y = 0.08 if i < 3 else 0.64
        m.box([x, y + 0.05, 0.224], [0.14, 0.04, 0.004], "white", omit=("back",))
        if kind == 2:
            m.box([x, y + 0.09, 0.02], [0.24, 0.16, 0.16], c, bevel=0.02, seg=1, edges="all")
            m.sweep([(x - 0.06, y + 0.17, 0.02), (x, y + 0.22, 0.02), (x + 0.06, y + 0.17, 0.02)], 0.015, "dark", seg=4, smooth=2)
        else:
            m.soft([x, y + 0.2, 0.0], [0.32, 0.38, 0.2], c, round=0.7, puff=0.2, cuts=1, tex="fabric")
            m.box([x, y + 0.13, 0.11], [0.22, 0.16, 0.05], c, bevel=0.015, seg=1, edges="vertical", omit=("back",), tex="fabric")
            if kind == 1:
                m.sweep([(x + 0.12, y + 0.36, 0.1), (x + 0.14, y + 0.2, 0.2), (x + 0.12, y + 0.04, 0.2)], 0.03, "dark", seg=4, smooth=2)


build("cubbies", fp)
