# The kit the furniture models are built with (#357), run inside Blender without its window:
#
#   blender -b --factory-startup -P models/sofa.py
#
# (or `node scripts/models.mjs --export`, which runs every model script and then converts).
#
# Each script describes an item's first-person copy (#360) in the game's own frame: metres, x across
# the item, y up from the floor, z out from its back (-z) to its front (+z), as the parts in
# scripts/furniture.mjs. The kit turns that into Blender's frame (z up) at the end, so glTF's
# y-up export lands back in the game's frame.
#
# Every face carries a material named for a colour in data/furniture.json ("accent" for the
# room's category colour), with "+glow" for a glowing one and "@<texture>" for one with a fine
# texture from scripts/textures.mjs (fabric, brushed metal...: grey detail that the colour still
# tints), as "cushion@fabric" or "glow+glow". Faces get texture coordinates by box projection,
# TEX_SCALE metres to a tile. Corners are shaded by a little ambient occlusion baked into a
# colour attribute ("shade", exported as COLOR_0), so detail costs no triangles.
#
# The tools (#361): box (rounded edges, tapered), cyl (and cones), lathe (a profile turned round
# an axis), sweep (a tube along a curve), soft (a cushion: a subdivided box rounded and puffed),
# strip (a sheet in folds), and side / split / inset to cut panels, vents and grilles into a face;
# blade (#364), a thin pointed leaf, for plants.
#
# The copy is one object, `<item>`, in models/<item>.glb. It's drawn only in first person, up close
# (about 800 triangles); every other view draws the item's code-built parts (data/furniture.json).

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
# Edges sharper than this (degrees) stay hard; softer ones are smoothed. Round things (cyl, lathe,
# sweep, soft) are smooth round their sides whatever their facets, up to ROUND_ANGLE.
SMOOTH_ANGLE = 35
ROUND_ANGLE = 70
# How many metres a texture's tile covers, by texture (box projection); others take "default".
TEX_SCALE = {"default": 0.3, "fabric": 0.12, "quilt": 0.4, "brushed": 0.5, "perforated": 0.15, "tread": 0.25, "grain": 0.5}

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


def _catmull(points, smooth):
    """Points along a Catmull-Rom curve through `points`, `smooth` steps a span (the ends held)."""
    pts = [Vector(p) for p in points]
    if smooth <= 1 or len(pts) < 3:
        return pts
    ext = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    out = []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for k in range(smooth):
            t = k / smooth
            out.append(0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t))
    out.append(pts[-1])
    return out


class Lod:
    """One level of detail being built: a bmesh in the game frame, a face material per colour."""

    def __init__(self):
        self.bm = bmesh.new()
        self.mats = []  # (colour, glow, texture)
        self.soft_layer = self.bm.edges.layers.int.new("round")

    def _round(self, faces):
        """Mark the edges between these faces that turn less than ROUND_ANGLE as smooth (a round thing's sides)."""
        fs = set(faces)
        for f in faces:
            f.normal_update()
        for e in {e for f in faces for e in f.edges}:
            lf = [f for f in e.link_faces if f in fs]
            if len(lf) == 2 and lf[0].normal.angle(lf[1].normal, 0) < math.radians(ROUND_ANGLE):
                e[self.soft_layer] = 1
        return faces

    def mat(self, c, glow=False, tex=None):
        key = (c, glow, tex)
        if key not in self.mats:
            self.mats.append(key)
        return self.mats.index(key)

    def _take(self, before, c, glow, omit=(), tex=None):
        """Give the faces made since `before` their material, and drop those facing an omitted side."""
        new = [f for f in self.bm.faces if f not in before]
        m = self.mat(c, glow, tex)
        drop = []
        for f in new:
            f.material_index = m
            f.normal_update()
            if any(f.normal.dot(SIDES[s]) > 0.99 for s in omit):
                drop.append(f)
        if drop:
            bmesh.ops.delete(self.bm, geom=drop, context="FACES")
        return [f for f in new if f.is_valid]

    def box(self, p, size, c, bevel=0.0, seg=1, edges="all", omit=(), r=None, glow=False, taper=None, tex=None):
        """A box centred on p, of size [x, y, z]. `bevel` rounds its edges ("all", "top" or "vertical");
        `taper` [x, z] scales its top (a tapered leg, a hopper)."""
        before = set(self.bm.faces)
        geom = bmesh.ops.create_cube(self.bm, size=1.0)
        verts = geom["verts"]
        bmesh.ops.scale(self.bm, vec=Vector(size), verts=verts)
        if taper:
            for v in verts:
                if v.co.y > 0:
                    v.co.x *= taper[0]
                    v.co.z *= taper[1]
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
        return self._take(before, c, glow, omit, tex)

    def cyl(self, p, d, h, c, seg=8, r=None, caps=True, glow=False, d2=None, tex=None):
        """A cylinder centred on p, d across and h tall along y (turned by r); d2 makes it a cone."""
        before = set(self.bm.faces)
        geom = bmesh.ops.create_cone(self.bm, cap_ends=caps, cap_tris=False, segments=seg, radius1=d / 2, radius2=(d2 if d2 is not None else d) / 2, depth=h)
        verts = geom["verts"]
        bmesh.ops.transform(self.bm, matrix=Matrix.Translation(Vector(p)) @ turn(r) @ Matrix.Rotation(-math.pi / 2, 4, "X"), verts=verts)
        return self._round(self._take(before, c, glow, tex=tex))

    def lathe(self, p, profile, c, seg=12, r=None, caps=True, glow=False, tex=None):
        """A profile of (radius, y) points, bottom to top, turned round the y axis through p (a bottle,
        a lamp shade, a pot, a chuck). A radius of 0 closes that end to a point; other ends are capped."""
        before = set(self.bm.faces)
        rings = []
        for rad, y in profile:
            if rad <= 1e-6:
                rings.append([self.bm.verts.new((0, y, 0))])
            else:
                rings.append([self.bm.verts.new((rad * math.cos(a), y, -rad * math.sin(a))) for a in (2 * math.pi * k / seg for k in range(seg))])
        for lo, hi in zip(rings, rings[1:]):
            for k in range(seg):
                a, b = k, (k + 1) % seg
                quad = [lo[a % len(lo)], lo[b % len(lo)], hi[b % len(hi)], hi[a % len(hi)]]
                quad = [v for i, v in enumerate(quad) if v not in quad[:i]]
                if len(quad) >= 3:
                    self.bm.faces.new(quad)
        if caps:
            for ring in (rings[0], rings[-1]):
                if len(ring) > 2:
                    self.bm.faces.new(ring)
        new = [f for f in self.bm.faces if f not in before]
        bmesh.ops.recalc_face_normals(self.bm, faces=new)
        verts = list({v for f in new for v in f.verts})
        bmesh.ops.transform(self.bm, matrix=Matrix.Translation(Vector(p)) @ turn(r), verts=verts)
        return self._round(self._take(before, c, glow, tex=tex))

    def sweep(self, path, d, c, seg=6, smooth=4, caps=True, glow=False, tex=None):
        """A tube `d` across along a path of (x, y, z) points (a pipe, a rail, a cable, a handle),
        through a smooth curve with `smooth` steps between points (1 keeps the corners)."""
        before = set(self.bm.faces)
        pts = _catmull(path, smooth)
        rings = []
        normal = None
        for i, pt in enumerate(pts):
            t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
            if normal is None:  # any direction across the first tangent
                normal = t.cross(Vector((0, 1, 0)) if abs(t.y) < 0.9 else Vector((1, 0, 0))).normalized()
            else:  # carried along without twisting
                normal = (normal - t * normal.dot(t)).normalized()
            side = t.cross(normal)
            rings.append([self.bm.verts.new(pt + (normal * math.cos(a) + side * math.sin(a)) * (d / 2)) for a in (2 * math.pi * k / seg for k in range(seg))])
        for lo, hi in zip(rings, rings[1:]):
            for k in range(seg):
                self.bm.faces.new((lo[k], lo[(k + 1) % seg], hi[(k + 1) % seg], hi[k]))
        if caps:
            self.bm.faces.new(rings[0])
            self.bm.faces.new(rings[-1])
        bmesh.ops.recalc_face_normals(self.bm, faces=[f for f in self.bm.faces if f not in before])
        return self._round(self._take(before, c, glow, tex=tex))

    def soft(self, p, size, c, round=0.5, puff=0.15, cuts=2, r=None, omit=(), glow=False, tex=None):
        """Something soft (a cushion, a pillow, a mattress, a bag): a box of size [x, y, z], subdivided,
        its edges rounded by `round` (0 square, 1 as round as its thinnest side allows) and its top
        and bottom puffed up in the middle by `puff` (a share of its height)."""
        before = set(self.bm.faces)
        geom = bmesh.ops.create_cube(self.bm, size=1.0)
        bmesh.ops.subdivide_edges(self.bm, edges=list({e for v in geom["verts"] for e in v.link_edges}), cuts=cuts, use_grid_fill=True)
        new = [f for f in self.bm.faces if f not in before]
        drop = []
        for f in new:
            f.normal_update()
            if any(f.normal.dot(SIDES[s]) > 0.99 for s in omit):
                drop.append(f)
        verts = list({v for f in new for v in f.verts})
        if drop:
            bmesh.ops.delete(self.bm, geom=drop, context="FACES")
            verts = [v for v in verts if v.is_valid]
        half = Vector(size) / 2
        rr = round * min(half)
        for v in verts:
            q = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
            inner = Vector(max(-(h - rr), min(h - rr, x)) for x, h in zip(q, half))
            off = q - inner
            if off.length > 1e-9 and rr > 0:
                q = inner + off.normalized() * rr
            q.y += math.copysign(puff * size[1], q.y) * max(0, 1 - (q.x / half.x) ** 2) * max(0, 1 - (q.z / half.z) ** 2) * 0.5
            v.co = q
        bmesh.ops.transform(self.bm, matrix=Matrix.Translation(Vector(p)) @ turn(r), verts=verts)
        return self._round(self._take(before, c, glow, tex=tex))

    def side(self, faces, s):
        """Those of `faces` facing a side ("front", "top"...), as box returns them, turned with the box or not."""
        return [f for f in faces if f.is_valid and f.normal.dot(SIDES[s]) > 0.9]

    def split(self, face, n, along):
        """Cut a four-sided face into n strips across `along` (a direction, as SIDES or a vector), for
        slots and grilles. Returns the strips."""
        d = SIDES[along] if isinstance(along, str) else Vector(along)
        d = (d - face.normal * d.dot(face.normal)).normalized()
        normal = face.normal.copy()
        centre = face.calc_center_median()
        edges = [e for e in face.edges if abs((e.verts[1].co - e.verts[0].co).normalized().dot(d)) > 0.7]
        if len(edges) != 2 or n < 2:
            return [face]
        corners = [v.co.copy() for v in face.verts]
        lines = [(e.verts[0].co.copy(), e.verts[1].co.copy()) for e in edges]
        res = bmesh.ops.subdivide_edges(self.bm, edges=edges, cuts=n - 1)
        new = [v for v in res["geom_inner"] if isinstance(v, bmesh.types.BMVert)]
        by_edge = [[], []]
        for v in new:  # which of the two edges each new point is on
            dist = [(v.co - a).cross(b - a).length / max((b - a).length, 1e-9) for a, b in lines]
            by_edge[0 if dist[0] <= dist[1] else 1].append(v)
        # Pair the new points on the two edges by how far along `d` they are.
        a = sorted(by_edge[0], key=lambda v: v.co.dot(d))
        b = sorted(by_edge[1], key=lambda v: v.co.dot(d))
        for va, vb in zip(a, b):
            bmesh.ops.connect_vert_pair(self.bm, verts=[va, vb])
        lo = [min(c[k] for c in corners) - 1e-5 for k in range(3)]
        hi = [max(c[k] for c in corners) + 1e-5 for k in range(3)]
        strips = []
        for f in self.bm.faces:
            f.normal_update()
            m = f.calc_center_median()
            if f.normal.dot(normal) > 0.99 and abs((m - centre).dot(normal)) < 1e-4 and all(lo[k] <= m[k] <= hi[k] for k in range(3)):
                strips.append(f)
        return strips

    def inset(self, faces, by, depth=0.0, c=None, glow=False, tex=None):
        """Inset each face by `by` metres and push its middle in by `depth` (out if negative): panels,
        vents, buttons. With `c`, the middle takes that colour. Returns the middles. Not on a face of a box
        with bevelled corners: the inset pushes those corners outward, past the item's footprint (#364)."""
        res = bmesh.ops.inset_individual(self.bm, faces=faces, thickness=by, depth=-depth, use_even_offset=True)
        if c is not None:
            m = self.mat(c, glow, tex)
            for f in faces:
                if f.is_valid:
                    f.material_index = m
        return [f for f in faces if f.is_valid]

    def strip(self, points, y0, y1, depth, c, glow=False, tex=None):
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
        return self._take(before, c, glow, tex=tex)

    def blade(self, p, yaw, pitch, length, width, c, droop=0.0, roll=0.0, seg=3, thick=0.004, glow=False, tex=None):
        """A leaf or a blade of grass (#364): a thin sheet from p, `length` long, widest a third of the way
        and coming to a point, heading `yaw` degrees round from +x toward +z and `pitch` degrees up, its
        tip sagging `droop` metres, turned `roll` degrees about its own length. About 8 triangles a segment."""
        before = set(self.bm.faces)
        y, pt = math.radians(yaw), math.radians(pitch)
        d = Vector((math.cos(pt) * math.cos(y), math.sin(pt), math.cos(pt) * math.sin(y)))
        across = Vector((-math.sin(y), 0, math.cos(y)))
        across = Matrix.Rotation(math.radians(roll), 3, d) @ across
        rows = []
        for i in range(seg + 1):
            t = i / seg
            centre = Vector(p) + d * (length * t) + Vector((0, -droop * t * t, 0))
            ahead = d * length + Vector((0, -2 * droop * t, 0))  # the curve's direction here
            up = ahead.cross(across).normalized() * (thick / 2)
            w = max(width * math.sin(math.pi * (0.2 + 0.8 * t)) / 2, 0.001)
            rows.append([self.bm.verts.new(centre + across * s * w + up * u) for s, u in ((-1, 1), (1, 1), (1, -1), (-1, -1))])
        for a, b in zip(rows, rows[1:]):
            for k in range(4):
                self.bm.faces.new((a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]))
        self.bm.faces.new(rows[0])
        bmesh.ops.recalc_face_normals(self.bm, faces=[f for f in self.bm.faces if f not in before])
        return self._take(before, c, glow, tex=tex)


def _material(c, glow, tex):
    name = c + ("+glow" if glow else "") + (f"@{tex}" if tex else "")
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    if glow:
        m["glow"] = 1
    return m


def _uvs(mesh, mats):
    """Texture coordinates by box projection: each face takes the plane it faces most, TEX_SCALE metres to a tile."""
    uv = mesh.uv_layers.new(name="uv")
    for poly in mesh.polygons:
        tex = mats[poly.material_index][2] if poly.material_index < len(mats) else None
        scale = TEX_SCALE.get(tex, TEX_SCALE["default"])
        n = poly.normal
        axis = max(range(3), key=lambda k: abs(n[k]))
        a, b = [(1, 2), (0, 2), (0, 1)][axis]
        for li in poly.loop_indices:
            co = mesh.vertices[mesh.loops[li].vertex_index].co
            uv.data[li].uv = (co[a] / scale, co[b] / scale)


def _object(name, lod):
    bm = lod.bm
    bmesh.ops.transform(bm, matrix=TO_BLENDER, verts=bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.triangulate(bm, faces=bm.faces, quad_method="BEAUTY", ngon_method="BEAUTY")
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for c, glow, tex in lod.mats:
        mesh.materials.append(_material(c, glow, tex))
    _uvs(mesh, lod.mats)
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.set_sharp_from_angle(angle=math.radians(SMOOTH_ANGLE))
    # Round things' sides stay smooth, however few their facets.
    rnd = mesh.attributes.get("round")
    sharp = mesh.attributes.get("sharp_edge")
    if rnd and sharp:
        for k, a in enumerate(rnd.data):
            if a.value:
                sharp.data[k].value = False
        mesh.attributes.remove(mesh.attributes["round"])
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


def build(item, fp):
    """Build an item's first-person copy (a function filling a Lod) and export models/<item>.glb."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    counts = {}
    lod = Lod()
    fp(lod)
    obj = _object(item, lod)
    _bake_shade(obj)
    counts[item] = len(obj.data.polygons)
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
        export_texcoords=True,
    )
    print(f"MODEL {item}: " + ", ".join(f"{k} {v} triangles" for k, v in counts.items()) + f" -> {os.path.relpath(path, os.path.dirname(HERE))}")
