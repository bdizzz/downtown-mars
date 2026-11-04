# The kit the furniture models are built with (#357), run inside Blender without its window:
#
#   blender -b --factory-startup -P models/sofa.py
#
# (or `node scripts/models.mjs --export`, which runs every model script and then converts).
#
# Each script describes an item twice, near and far, in the game's own frame: metres, x across
# the item, y up from the floor, z out from its back (-z) to its front (+z), as the parts in
# scripts/furniture.mjs. The kit turns that into Blender's frame (z up) at the end, so glTF's
# y-up export lands back in the game's frame.
#
# Every face carries a material named for a colour in data/furniture.json ("accent" for the
# room's category colour). A glowing material is that colour with a "glow" custom property,
# exported as glTF extras. Corners are shaded by a little ambient occlusion baked into a
# colour attribute ("shade", exported as COLOR_0), so detail costs no triangles.
#
# Near and far are two objects, `<item>` and `<item>.far`, in one models/<item>.glb.

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))

# How the baked shade is made: rays per corner, how far they look (metres), and how dark a fully hidden corner gets.
AO = {"rays": 48, "reach": 0.35, "strength": 0.55}
# Edges sharper than this (degrees) stay hard; softer ones are smoothed.
SMOOTH_ANGLE = 35

# The game frame to Blender's: game (x, y, z) is Blender (x, -z, y).
TO_BLENDER = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))

SIDES = {
    "bottom": Vector((0, -1, 0)),
    "top": Vector((0, 1, 0)),
    "back": Vector((0, 0, -1)),
    "front": Vector((0, 0, 1)),
    "left": Vector((-1, 0, 0)),
    "right": Vector((1, 0, 0)),
}


def turn(r):
    """A rotation from degrees [x, y, z], applied X then Y then Z as three.js's "XYZ" Euler."""
    if not r:
        return Matrix.Identity(4)
    rx, ry, rz = (math.radians(a) for a in r)
    return Matrix.Rotation(rx, 4, "X") @ Matrix.Rotation(ry, 4, "Y") @ Matrix.Rotation(rz, 4, "Z")


class Lod:
    """One level of detail being built: a bmesh in the game frame, a face material per colour."""

    def __init__(self):
        self.bm = bmesh.new()
        self.mats = []  # (colour, glow)

    def mat(self, c, glow=False):
        key = (c, glow)
        if key not in self.mats:
            self.mats.append(key)
        return self.mats.index(key)

    def _take(self, before, c, glow, omit=()):
        """Give the faces made since `before` their material, and drop those facing an omitted side."""
        new = [f for f in self.bm.faces if f not in before]
        m = self.mat(c, glow)
        drop = []
        for f in new:
            f.material_index = m
            f.normal_update()
            if any(f.normal.dot(SIDES[s]) > 0.99 for s in omit):
                drop.append(f)
        if drop:
            bmesh.ops.delete(self.bm, geom=drop, context="FACES")
        return [f for f in new if f.is_valid]

    def box(self, p, size, c, bevel=0.0, seg=1, edges="all", omit=(), r=None, glow=False):
        """A box centred on p, of size [x, y, z]. `bevel` rounds its edges ("all", "top" or "vertical")."""
        before = set(self.bm.faces)
        geom = bmesh.ops.create_cube(self.bm, size=1.0)
        verts = geom["verts"]
        bmesh.ops.scale(self.bm, vec=Vector(size), verts=verts)
        if bevel > 0:
            es = {e for v in verts for e in v.link_edges}
            if edges == "top":
                es = {e for e in es if all(v.co.y > 0 for v in e.verts)}
            elif edges == "vertical":
                es = {e for e in es if abs(e.verts[0].co.y - e.verts[1].co.y) > 1e-6}
            elif edges == "upper":  # the top loop and the four upright edges
                es = {e for e in es if any(v.co.y > 0 for v in e.verts)}
            bmesh.ops.bevel(self.bm, geom=list(es), offset=bevel, segments=seg, affect="EDGES", profile=0.5, clamp_overlap=True)
        moved = [v for v in self.bm.verts if any(f not in before for f in v.link_faces)]
        bmesh.ops.transform(self.bm, matrix=Matrix.Translation(Vector(p)) @ turn(r), verts=moved)
        return self._take(before, c, glow, omit)

    def cyl(self, p, d, h, c, seg=8, r=None, caps=True, glow=False, d2=None):
        """A cylinder centred on p, d across and h tall along y (turned by r); d2 makes it a cone."""
        before = set(self.bm.faces)
        geom = bmesh.ops.create_cone(self.bm, cap_ends=caps, cap_tris=False, segments=seg, radius1=d / 2, radius2=(d2 if d2 is not None else d) / 2, depth=h)
        verts = geom["verts"]
        bmesh.ops.transform(self.bm, matrix=Matrix.Translation(Vector(p)) @ turn(r) @ Matrix.Rotation(-math.pi / 2, 4, "X"), verts=verts)
        return self._take(before, c, glow)

    def strip(self, points, y0, y1, depth, c, glow=False):
        """A thin upright sheet along a path of (x, z) points from y0 to y1, `depth` thick (a curtain in folds)."""
        before = set(self.bm.faces)
        n = len(points)
        normals = []
        for i in range(n):
            a = Vector(points[max(i - 1, 0)])
            b = Vector(points[min(i + 1, n - 1)])
            t = (b - a).normalized()
            normals.append(Vector((t.y, -t.x)) * (depth / 2))
        rings = []
        for side in (1, -1):
            rows = []
            for (x, z), off in zip(points, normals):
                rows.append((self.bm.verts.new((x + off.x * side, y0, z - off.y * side)), self.bm.verts.new((x + off.x * side, y1, z - off.y * side))))
            rings.append(rows)
        front, back = rings
        for i in range(n - 1):
            self.bm.faces.new((front[i][0], front[i + 1][0], front[i + 1][1], front[i][1]))
            self.bm.faces.new((back[i][0], back[i][1], back[i + 1][1], back[i + 1][0]))
        for i in (0, n - 1):  # the ends
            f = self.bm.faces.new((front[i][0], front[i][1], back[i][1], back[i][0]))
            if i == n - 1:
                f.normal_flip()
        top = self.bm.faces.new([front[i][1] for i in range(n)] + [back[i][1] for i in reversed(range(n))])
        bot = self.bm.faces.new([front[i][0] for i in reversed(range(n))] + [back[i][0] for i in range(n)])
        bmesh.ops.recalc_face_normals(self.bm, faces=[f for f in self.bm.faces if f not in before])
        return self._take(before, c, glow)


def _material(c, glow):
    name = f"{c}+glow" if glow else c
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    if glow:
        m["glow"] = 1
    return m


def _object(name, lod):
    bm = lod.bm
    bmesh.ops.transform(bm, matrix=TO_BLENDER, verts=bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.triangulate(bm, faces=bm.faces, quad_method="BEAUTY", ngon_method="BEAUTY")
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for c, glow in lod.mats:
        mesh.materials.append(_material(c, glow))
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.set_sharp_from_angle(angle=math.radians(SMOOTH_ANGLE))
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _bake_shade(obj):
    """Ambient occlusion per face corner: rays round its normal; what they hit nearby (or the floor) darkens it."""
    mesh = obj.data
    tree = BVHTree.FromPolygons([v.co.copy() for v in mesh.vertices], [tuple(p.vertices) for p in mesh.polygons])
    attr = mesh.color_attributes.new("shade", "FLOAT_COLOR", "CORNER")
    rays = AO["rays"]
    golden = math.pi * (3 - math.sqrt(5))
    dirs = []
    for i in range(rays):  # a Fibonacci spiral over the hemisphere round +z, cosine-weighted
        u = (i + 0.5) / rays
        r = math.sqrt(u)
        a = i * golden
        dirs.append(Vector((r * math.cos(a), r * math.sin(a), math.sqrt(1 - u))))
    normals = mesh.corner_normals
    for loop in mesh.loops:
        n = normals[loop.index].vector.normalized()
        co = mesh.vertices[loop.vertex_index].co
        start = co + n * 0.002
        basis = n.to_track_quat("Z", "Y").to_matrix()
        hidden = 0
        for d in dirs:
            w = basis @ d
            hit = tree.ray_cast(start, w, AO["reach"])[0] is not None
            if not hit and w.z < 0 and start.z > 0:  # the floor
                hit = start.z / -w.z < AO["reach"]
            hidden += hit
        s = 1 - AO["strength"] * hidden / rays
        attr.data[loop.index].color = (s, s, s, 1)
    mesh.color_attributes.active_color = attr


def build(item, near, far):
    """Build an item's near and far copies (functions filling a Lod) and export models/<item>.glb."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    counts = {}
    for name, make in ((item, near), (f"{item}.far", far)):
        lod = Lod()
        make(lod)
        obj = _object(name, lod)
        _bake_shade(obj)
        counts[name] = len(obj.data.polygons)
    path = os.path.join(HERE, f"{item}.glb")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_normals=True,
        export_materials="EXPORT",
        export_vertex_color="ACTIVE",
        export_extras=True,
        export_texcoords=False,
    )
    print(f"MODEL {item}: " + ", ".join(f"{k} {v} triangles" for k, v in counts.items()) + f" -> {os.path.relpath(path, os.path.dirname(HERE))}")
