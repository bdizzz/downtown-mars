# The spiral stair (#367), first person: sixteen wedge treads of tread plate, alternating the room
# colour and composite, winding round a brushed column on a turned base, with a baluster at the rim of
# each of the first twelve and a handrail winding over them.
# Run: blender -b --factory-startup -P models/spiral_stair.py
import math
import os, sys
import bmesh
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build

STEPS, RISE, TURN = 16, 0.25, 22.5  # treads, metres up and degrees round each
R0, R1 = 0.12, 1.43  # the treads' inner and outer radius


def wedge(m, a0, a1, y0, y1, c, tex=None):
    """A tread: a wedge from R0 to R1 between angles a0 and a1 (radians from +z toward +x), y0 to y1."""
    before = set(m.bm.faces)
    ring = [(R0, a0), (R0, a1), (R1, a1), (R1, a0)]
    lo = [m.bm.verts.new((r * math.sin(a), y0, r * math.cos(a))) for r, a in ring]
    hi = [m.bm.verts.new((r * math.sin(a), y1, r * math.cos(a))) for r, a in ring]
    m.bm.faces.new(lo)
    m.bm.faces.new(hi)
    for k in range(4):
        m.bm.faces.new((lo[k], lo[(k + 1) % 4], hi[(k + 1) % 4], hi[k]))
    bmesh.ops.recalc_face_normals(m.bm, faces=[f for f in m.bm.faces if f not in before])
    return m._take(before, c, False, tex=tex)


def fp(m):
    m.lathe([0, 0, 0], [(0.0, 0.0), (0.3, 0.0), (0.3, 0.03), (0.2, 0.06), (0.13, 0.12), (0.0, 0.12)], "dark", seg=12)
    m.cyl([0, 2.0, 0], 0.24, 3.98, "metal", seg=12, caps=False, tex="brushed")
    m.cyl([0, 3.99, 0], 0.26, 0.02, "dark", seg=12)
    half = math.radians(TURN) / 2 + 0.01
    rail = []
    for k in range(STEPS):
        a = math.radians(TURN * k)
        y = 0.22 + RISE * k
        wedge(m, a - half, a + half, y - 0.03, y + 0.03, "accent" if k % 2 == 0 else "composite", tex="tread")
        if k < 12:
            r = 1.32
            x, z = r * math.sin(a), r * math.cos(a)
            m.cyl([x, y + 0.48, z], 0.04, 0.9, "steel", seg=5, caps=False)
            rail.append((x, y + 0.95, z))
    m.sweep(rail, 0.05, "accent", seg=5, smooth=1, tex="brushed")


build("spiral_stair", fp)
