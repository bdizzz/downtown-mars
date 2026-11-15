"""
The land's hero pieces (#497), made in Blender without its window:

    blender -b --python models/land/land.py

Sculpts each piece from Blender's noise (mathutils.noise): mesas and buttes worn back in beds, a crater's
tiered central mound (Gale's Mount Sharp), and buttresses for a canyon's walls; each at high resolution,
then cut down to a few thousand triangles (the Decimate modifier), with ambient occlusion baked into each
vertex (rays against the piece itself). Also a tileable rock-detail map for the land's rock shader: fine
laminations, fractures and grain as a height, turned into a normal (red, green) and a cavity (blue).

Writes models/land/pieces.json (the game reads it; the build never runs Blender) and
public/textures/land-rock.jpg. Pieces are in their own unit frame: x and z across (a radial piece's footprint
has radius 1; a buttress is 2 wide, x from -1 to 1, its face toward -z), y up from 0 (the ground) to 1 (its top).
"""
import base64
import json
import math
import os
import struct

import bpy
import bmesh
import numpy as np
from mathutils import Vector, noise
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
# Triangles each piece is cut down to, and the ambient occlusion: rays per vertex, how far they reach (units), how dark.
TRIS = 3000
AO = {"rays": 32, "reach": 0.22, "strength": 0.75}


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def fbm(p, octaves=4):
    return noise.fractal(Vector(p), 0.8, 2.0, octaves, noise_basis="PERLIN_ORIGINAL")


def ridged(p):
    """Sharp-crested ridges, 0 to about 1: gullies between spurs."""
    return 1 - abs(noise.noise(Vector(p), noise_basis="PERLIN_ORIGINAL"))


def facets(p):
    """Fractured rock: flat-ish facets with crisp edges (the nearest two cells' distances)."""
    d, _ = noise.voronoi(Vector(p), distance_metric="DISTANCE", exponent=2.5)
    return d[1] - d[0]


# ---- the radial pieces: a profile of radius by height, worn by noise round it ----

def mesa_profile(seed, kind):
    """Radius (footprint 1) by height t: talus, then beds each a cliff over a ledge, then the cap."""
    rng = np.random.default_rng(seed)
    if kind == "mound":
        tiers = 5
        steps = []
        r = 0.86
        t = 0.1
        for i in range(tiers):
            rise = (0.92 - 0.1) / tiers * (0.8 + 0.4 * rng.random())
            steps.append((t, t + rise * 0.75, r, r - 0.05))
            r -= 0.12 + 0.04 * rng.random()
            t += rise
        return {"talus": 0.1, "talus_r": 0.86, "steps": steps, "top": 1.0, "dome": True}
    talus = (0.22 if kind == "mesa" else 0.4) + 0.08 * rng.random()
    beds = 4 if kind == "mesa" else 3
    cliff_r = 0.78 if kind == "mesa" else 0.58
    steps = []
    t = talus
    r = cliff_r
    for i in range(beds):
        rise = (0.97 - talus) / beds * (0.8 + 0.4 * rng.random())
        hard = rng.random()
        steps.append((t, t + rise * (0.7 + 0.25 * hard), r, r - (0.02 + 0.07 * (1 - hard))))
        r -= 0.02 + 0.07 * (1 - hard)
        t += rise
    return {"talus": talus, "talus_r": cliff_r, "steps": steps, "top": 0.97, "dome": False}


def profile_radius(prof, t):
    if t <= prof["talus"]:
        # Concave talus from the foot out at 1 up to the cliff's foot.
        u = t / prof["talus"]
        return 1.0 - (1.0 - prof["talus_r"]) * (1 - (1 - u) ** 2)
    r = prof["talus_r"]
    for (t0, t1, r0, r1) in prof["steps"]:
        if t < t0:
            return r
        if t <= t1:
            return r0 - (r0 - r0 * 0.985) * (t - t0) / max(1e-6, t1 - t0)  # the cliff: nearly sheer
        r = r1
        # The ledge above it, leaning back to the next bed's foot.
    return r


def radial_piece(name, kind, seed):
    prof = mesa_profile(seed, kind)
    o = (seed * 13.1, seed * 7.7, seed * 3.3)
    S = 200
    rows = 110
    verts = []
    faces = []
    ts = [-0.06] + [i / (rows - 1) for i in range(rows)]
    top_r = []
    for i, t in enumerate(ts):
        tt = max(0.0, min(1.0, t))
        base = profile_radius(prof, tt) if t >= 0 else 1.04
        for j in range(S):
            a = j / S * math.tau
            c, s = math.cos(a), math.sin(a)
            # Broad swells round it, gullies cutting the cliffs, fractured faces, fans of debris below the gullies.
            swell = 1 + 0.1 * fbm((c * 1.3 + o[0], s * 1.3 + o[1], tt * 0.8 + o[2]), 3)
            g = ridged((c * 3.2 + o[0], s * 3.2 + o[1], o[2]))
            g = max(0.0, g - 0.55) / 0.45
            cut = 1 - 0.14 * g * smoothstep(prof["talus"] * 0.9, 0.95, tt)
            fan = 1 + 0.07 * g * (1 - smoothstep(0.0, prof["talus"], tt))
            frac = 1 + 0.035 * (facets((c * 6 + o[0], s * 6 + o[1], tt * 5 + o[2])) - 0.3)
            r = base * swell * cut * fan * frac
            y = t
            if kind == "mound" and t > 0.98:
                y = t
            verts.append((r * c, y, r * s))
        if i == len(ts) - 1:
            top_r = [verts[-S + j] for j in range(S)]
    # The top: rings in to the middle, a little uneven, domed on the mound.
    last = len(verts) - S
    rings = 10
    for k in range(1, rings + 1):
        f = 1 - k / rings
        for j in range(S):
            x, y, z = top_r[j]
            h = 1.0 + 0.012 * fbm((x * 4 + o[0], z * 4 + o[1], o[2]), 3)
            if prof["dome"]:
                h = 1.0 + 0.08 * (1 - f * f)
            verts.append((x * f, h, z * f) if k < rings else (0.0, h, 0.0))
    total_rows = len(ts) + rings
    for i in range(total_rows - 1):
        for j in range(S):
            a = i * S + j
            b = i * S + (j + 1) % S
            c_ = (i + 1) * S + j
            d = (i + 1) * S + (j + 1) % S
            faces.append((a, b, d, c_))
    return finish(name, verts, faces)


# ---- a buttress: a spur of canyon wall, its face toward -z ----

def buttress(name, seed):
    rng = np.random.default_rng(seed)
    o = (seed * 5.3, seed * 2.9, seed * 8.1)
    beds = []
    t = 0.24
    while t < 0.95:
        rise = 0.09 + 0.06 * rng.random()
        hard = rng.random()
        beds.append((t, min(0.97, t + rise), 0.015 + 0.06 * (1 - hard)))
        t += rise

    def depth(x, t):
        # How far back the face stands (units of its half-width): talus, then beds stepping back, spur-shaped across.
        if t <= 0.24:
            d = 0.42 * (1 - (1 - t / 0.24) ** 2)
        else:
            d = 0.42
            for (t0, t1, back) in beds:
                if t < t0:
                    break
                d += back * smoothstep(t1 - 0.012, t1, t) if t <= t1 else back
            d += 0.06 * (t - 0.24)
        spur = 0.55 * x * x
        g = ridged((x * 2.2 + o[0], t * 0.6 + o[1], o[2]))
        gully = 0.18 * max(0.0, g - 0.55) / 0.45 * smoothstep(0.2, 0.9, t)
        frac = 0.035 * (facets((x * 5 + o[0], t * 7 + o[1], o[2])) - 0.3)
        return d + spur * smoothstep(0.1, 0.5, t) + gully + frac + 0.04 * fbm((x * 1.5 + o[0], t * 1.2, o[2]), 3)

    X = 140
    T = 110
    verts = []
    faces = []
    ts = [-0.05] + [i / (T - 1) for i in range(T)]
    for t in ts:
        for k in range(X):
            x = -1.1 + 2.2 * k / (X - 1)
            tt = max(0.0, t)
            verts.append((x, t, depth(x, tt) - (0.04 if t < 0 else 0)))
    # The top, back into the plateau.
    for back in (0.05, 0.25, 0.6, 1.1):
        for k in range(X):
            x = -1.1 + 2.2 * k / (X - 1)
            verts.append((x, 1.0 + 0.01 * fbm((x * 3 + o[0], back * 3, o[2]), 2), depth(x, 1.0) + back))
    rows = len(ts) + 4
    for i in range(rows - 1):
        for k in range(X - 1):
            a = i * X + k
            b = a + 1
            c_ = a + X
            d = c_ + 1
            faces.append((a, c_, d, b))
    return finish(name, verts, faces)


# ---- cut down, shade, pack ----

def finish(name, verts, faces):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    tri_now = sum(len(p.vertices) - 2 for p in mesh.polygons)
    mod = obj.modifiers.new("cut", "DECIMATE")
    mod.ratio = min(1.0, TRIS / tri_now)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.normal_update()
    bm.verts.ensure_lookup_table()
    pos = [v.co.copy() for v in bm.verts]
    tris = [tuple(v.index for v in f.verts) for f in bm.faces]
    normals = [v.normal.copy() for v in bm.verts]
    bm.free()
    tree = BVHTree.FromPolygons(pos, tris)
    golden = math.pi * (3 - math.sqrt(5))
    dirs = []
    for i in range(AO["rays"]):
        u = (i + 0.5) / AO["rays"]
        r = math.sqrt(u)
        a = i * golden
        dirs.append(Vector((r * math.cos(a), r * math.sin(a), math.sqrt(1 - u))))
    ao = []
    for co, n in zip(pos, normals):
        if n.length < 1e-6:
            ao.append(1.0)
            continue
        basis = n.to_track_quat("Z", "Y").to_matrix()
        hidden = 0
        for d in dirs:
            w = basis @ d
            if tree.ray_cast(co + n * 0.002, w, AO["reach"])[0] is not None or (w.y < 0 and co.y + w.y * AO["reach"] < 0):
                hidden += 1
        ao.append(1 - AO["strength"] * hidden / AO["rays"])
    lo = [min(p[i] for p in pos) for i in range(3)]
    hi = [max(p[i] for p in pos) for i in range(3)]
    q = bytearray()
    for p in pos:
        for i in range(3):
            q += struct.pack("<H", round((p[i] - lo[i]) / max(1e-9, hi[i] - lo[i]) * 65535))
    shade = bytes(round(max(0, min(1, s)) * 255) for s in ao)
    idx = bytearray()
    for t in tris:
        idx += struct.pack("<HHH", *t)
    print(f"{name}: {len(pos)} vertices, {len(tris)} triangles")
    bpy.data.objects.remove(obj)
    return {
        "min": [round(v, 5) for v in lo],
        "max": [round(v, 5) for v in hi],
        "positions": base64.b64encode(bytes(q)).decode(),
        "shade": base64.b64encode(shade).decode(),
        "indices": base64.b64encode(bytes(idx)).decode(),
    }


# ---- the rock-detail map ----

def periodic_noise(n, cells, rng):
    """Smooth value noise on an n×n tile that wraps, `cells` lattice cells across."""
    lat = rng.random((cells, cells))
    u = np.arange(n) / n * cells
    i0 = np.floor(u).astype(int)
    f = u - i0
    f = f * f * (3 - 2 * f)
    i1 = (i0 + 1) % cells
    a = lat[np.ix_(i0, i0)]
    b = lat[np.ix_(i0, i1)]
    c = lat[np.ix_(i1, i0)]
    d = lat[np.ix_(i1, i1)]
    fy = f[:, None]
    fx = f[None, :]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def periodic_cells(n, cells, rng):
    """Cracks between fractured blocks: the gap between the nearest two seeds, on a wrapping tile."""
    seeds = rng.random((cells, cells, 2))
    yy, xx = np.mgrid[0:n, 0:n] / n * cells
    d1 = np.full((n, n), 9.0)
    d2 = np.full((n, n), 9.0)
    gx = np.floor(xx).astype(int)
    gy = np.floor(yy).astype(int)
    for oy in (-1, 0, 1):
        for ox in (-1, 0, 1):
            cx = gx + ox
            cy = gy + oy
            s = seeds[cy % cells, cx % cells]
            d = np.hypot(cx + s[..., 0] - xx, cy + s[..., 1] - yy)
            d2 = np.where(d < d1, d1, np.minimum(d2, d))
            d1 = np.minimum(d1, d)
    return d2 - d1


def detail_map(path, n=256):
    rng = np.random.default_rng(497)
    height = np.zeros((n, n))
    for cells, amp in ((4, 0.5), (8, 0.25), (16, 0.14), (32, 0.08)):
        height += amp * periodic_noise(n, cells, rng)
    # Laminations: fine beds running across (v is up the rock when the map is laid on a cliff), wavering.
    v = np.arange(n)[:, None] / n
    waver = periodic_noise(n, 6, rng) * 0.05
    lam = np.sin((v + waver) * math.tau * 14) * 0.5 + 0.5
    height += 0.18 * lam ** 3
    # Fractures: blocks with cracks between, at two sizes.
    for cells, amp in ((6, 0.35), (14, 0.18)):
        gap = periodic_cells(n, cells, rng)
        height -= amp * np.exp(-gap / 0.05)
    height = (height - height.min()) / (height.max() - height.min())
    # The normal from the height's slope (wrapping), and the cavity: how far below its neighbourhood each point sits.
    gx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * 6
    gy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * 6
    nz = 1 / np.sqrt(gx * gx + gy * gy + 1)
    nx = -gx * nz
    ny = -gy * nz
    blur = height.copy()
    for _ in range(6):
        blur = (blur + np.roll(blur, 1, 0) + np.roll(blur, -1, 0) + np.roll(blur, 1, 1) + np.roll(blur, -1, 1)) / 5
    cavity = np.clip(0.5 + (height - blur) * 4, 0, 1)
    img = np.stack([(nx * 0.5 + 0.5), (ny * 0.5 + 0.5), cavity, np.ones((n, n))], axis=-1)
    # Saved by Blender as a JPEG (a noisy map packs badly as a PNG); its rows run bottom to top.
    image = bpy.data.images.new("land-rock", n, n, alpha=False, float_buffer=False)
    image.colorspace_settings.name = "Non-Color"
    image.pixels.foreach_set(np.clip(img[::-1], 0, 1).astype(np.float32).ravel())
    image.filepath_raw = path
    image.file_format = "JPEG"
    bpy.context.scene.render.image_settings.quality = 78
    image.save_render(path)


def main():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    pieces = {
        "mesa_a": radial_piece("mesa_a", "mesa", 1),
        "mesa_b": radial_piece("mesa_b", "mesa", 2),
        "butte_a": radial_piece("butte_a", "butte", 3),
        "butte_b": radial_piece("butte_b", "butte", 4),
        "mound": radial_piece("mound", "mound", 5),
        "buttress_a": buttress("buttress_a", 6),
        "buttress_b": buttress("buttress_b", 7),
        "buttress_c": buttress("buttress_c", 8),
    }
    out = {"_note": "Made by models/land/land.py in Blender (#497); see its header. Quantised: positions as uint16 across min..max, shade as a byte, triangles as uint16 indices.", "pieces": pieces}
    with open(os.path.join(HERE, "pieces.json"), "w") as f:
        json.dump(out, f, separators=(",", ":"))
    os.makedirs(os.path.join(ROOT, "public", "textures"), exist_ok=True)
    detail_map(os.path.join(ROOT, "public", "textures", "land-rock.jpg"))
    print("wrote models/land/pieces.json and public/textures/land-rock.jpg")


main()
