using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// Furniture from data/furniture.json, as the web game builds it (src/render3d/furniture3d.ts):
/// each item from its parts (boxes, cylinders, spheres), one surface per kind of part (plain,
/// glowing, growing, water). Every copy of an item in the hole is one MultiMesh instance, its
/// room's accent colour in the instance's custom data, so the whole hole's furniture is a few
/// hundred draw calls at most. In first person, items with a Blender-made model (#360,
/// public/models/fp.bin from scripts/models.mjs, read the first time you go into first person)
/// draw it instead of their parts, near the camera; every other view draws the parts.
/// </summary>
public class Furniture
{
    const int CylSegments = 12, SphW = 10, SphH = 8;
    /// <summary>How much a near box's edges are chamfered (metres; less on small parts).</summary>
    const float Chamfer = 0.015f;
    /// <summary>What parts are made of, by colour, for their fine pattern (as the web's PART_MATS): 1 fibre composite, 2 fabric, 3 metal, 4 painted, 5 soil.</summary>
    static readonly Dictionary<string, int> PartMats = new()
    {
        ["fibre"] = 1, ["composite"] = 1, ["cushion"] = 2, ["cream"] = 2, ["metal"] = 3, ["steel"] = 3,
        ["panel"] = 4, ["hazard"] = 4, ["soil"] = 5, ["substrate"] = 5,
    };
    /// <summary>The far copy, as the web's: rounder things with fewer facets, parts smaller than this (metres) left out, beyond this distance.</summary>
    const int FarCyl = 6, FarSphW = 6, FarSphH = 4;
    const float FarSmallest = 0.45f, FarFrom = 55;
    /// <summary>Batches split each floor into this many parts round the ring, so near and far are judged room by room, more or less.</summary>
    const int Sectors = 8;
    /// <summary>Glow by day and the extra by night (as the web game's, a little stronger for Godot's exposure).</summary>
    const float GlowDay = 0.6f, GlowNight = 1.8f;
    /// <summary>Glowing parts smaller than this (metres, their longest side) are indicator lights.</summary>
    static readonly HashSet<string> PlantColors = new() { "plant", "leaf", "potato", "soy", "stalk", "wheat", "barley", "algae", "flower" };

    enum Kind { Plain, Glow, Plant, Water }

    readonly Dictionary<string, string> _colors = new();
    readonly Dictionary<string, JsonElement> _items = new();
    /// <summary>Items made in Blender (#357), first person only (#360): public/models/fp.bin, read when first needed.</summary>
    Dictionary<string, FpSlot[]>? _fp;
    bool _fpTried, _firstPerson;
    /// <summary>One material's worth of a first-person model: its colour, whether it glows, and its triangles (as view/models.ts).</summary>
    record FpSlot(string C, bool Glow, float[] V, float[] N, float[]? Shade, int[] I, int Tex, float[]? Uv);
    /// <summary>The models' fine textures (#361): grey tiles, one layer each, sampled by the shader where a slot names one.</summary>
    Texture2DArray? _fpTextures;
    enum Lod { Near, Far, Fp }
    readonly Dictionary<(string, Lod), Mesh?> _meshes = new();
    /// <summary>The batches last built (item, its placed copies), the node they're under, and which show only in or out of first person.</summary>
    readonly List<(string item, List<float[]> list, MultiMeshInstance3D near)> _batches = new();
    Color[] _accents = Array.Empty<Color>();
    Node3D? _root;
    readonly List<(MultiMeshInstance3D fp, MultiMeshInstance3D parts)> _fpPairs = new();
    readonly Dictionary<Kind, ShaderMaterial> _materials = new();

    /// <summary>Wall hangings, for walls down: each instance, where it stands, and its wall face (normal, where it stands, bottom and top, the point behind it).</summary>
    record Hung(MultiMesh Mm, int Index, Transform3D At, Vector2 Normal, Vector3 Face, float Y0, float Y1, Vector2 Point, bool Down);
    readonly List<Hung> _hung = new();

    public Furniture()
    {
        var path = ProjectSettings.GlobalizePath("res://") + "../data/furniture.json";
        using var doc = JsonDocument.Parse(System.IO.File.ReadAllText(path));
        foreach (var c in doc.RootElement.GetProperty("colors").EnumerateObject()) _colors[c.Name] = c.Value.GetString()!;
        foreach (var i in doc.RootElement.GetProperty("items").EnumerateObject()) _items[i.Name] = i.Value.Clone();
        var shader = new Shader { Code = ShaderCode };
        _materials[Kind.Plain] = Make(shader, 0.8f, 0.05f, 0, 0);
        _materials[Kind.Glow] = Make(shader, 0.4f, 0, GlowDay, 0);
        _materials[Kind.Plant] = Make(shader, 0.85f, 0, 0, 0.04f);
        _materials[Kind.Water] = Make(shader, 0.15f, 0.1f, 0, 0);
    }

    static ShaderMaterial Make(Shader shader, float roughness, float metallic, float glow, float sway)
    {
        var m = new ShaderMaterial { Shader = shader };
        m.SetShaderParameter("roughness", roughness);
        m.SetShaderParameter("metallic", metallic);
        m.SetShaderParameter("glow", glow);
        m.SetShaderParameter("sway", sway);
        return m;
    }

    /// <summary>
    /// Walls down: a hanging whose wall is lowered goes (as the web's HANG_GLSL, tested at the point on the
    /// wall behind it as view.gdshaderinc wall_in_the_way); back when it isn't.
    /// </summary>
    public void UpdateWalls(bool on, Vector3 camera)
    {
        for (var i = 0; i < _hung.Count; i++)
        {
            var h = _hung[i];
            var down = on && InTheWay(h.Normal, h.Face, camera, h.Y0, h.Y1);
            if (down == h.Down) continue;
            h.Mm.SetInstanceTransform(h.Index, down ? new Transform3D(Basis.FromScale(Vector3.Zero), h.At.Origin) : h.At);
            _hung[i] = h with { Down = down };
        }
    }

    /// <summary>view.gdshaderinc wall_in_front and wall_in_the_way (the web's rooms3d.ts inFront, inTheWay); the stub is 15%.</summary>
    static bool InTheWay(Vector2 n, Vector3 face, Vector3 camera, float y0, float y1)
    {
        var cam = new Vector2(camera.X, camera.Z);
        float least, most;
        if (face.Z <= face.Y) least = most = cam.Dot(n) / n.Length() - face.X;
        else
        {
            var dist = cam.Length();
            var th = Mathf.Atan2(cam.Y, cam.X);
            var span = face.Z - face.Y;
            float e0 = Mathf.Cos(face.Y - th), e1 = Mathf.Cos(face.Z - th);
            var hi = Mathf.PosMod(th - face.Y, Mathf.Tau) <= span ? 1 : Mathf.Max(e0, e1);
            var lo = Mathf.PosMod(th + Mathf.Pi - face.Y, Mathf.Tau) <= span ? -1 : Mathf.Min(e0, e1);
            var m = (face.Y + face.Z) / 2;
            var outward = n.Dot(new Vector2(Mathf.Cos(m), Mathf.Sin(m))) > 0;
            (least, most) = outward ? (dist * lo - face.X, dist * hi - face.X) : (face.X - dist * hi, face.X - dist * lo);
        }
        if (least < 0) return true;
        var len = n.Length();
        if (len < 1.5f) return false;
        var rise = camera.Y - y1;
        return rise <= 0 || most * (y1 - y0) * 0.85f > (len - 2f) * rise;
    }

    /// <summary>
    /// In first person or not: items with a model swap their near parts for it. The models are read the first
    /// time (DM_FX=nomodels leaves them out), and added to the furniture already built.
    /// </summary>
    public bool FirstPerson
    {
        get => _firstPerson;
        set
        {
            if (value == _firstPerson) return;
            _firstPerson = value;
            if (value && !_fpTried)
            {
                _fpTried = true;
                (_fp, _fpTextures) = LoadFp();
                if (_fpTextures != null) foreach (var m in _materials.Values) m.SetShaderParameter("fp_textures", _fpTextures);
                if (_fp != null && _root != null) foreach (var (item, list, near) in _batches) AddFp(item, list, near);
            }
            foreach (var (fp, parts) in _fpPairs)
            {
                fp.Visible = value;
                parts.Visible = !value;
            }
        }
    }

    /// <summary>public/models/fp.bin (its format is in scripts/models.mjs), or null if it's missing, unreadable or switched off.</summary>
    static (Dictionary<string, FpSlot[]>?, Texture2DArray?) LoadFp()
    {
        var path = ProjectSettings.GlobalizePath("res://") + "../public/models/fp.bin";
        if (Dev.Off("models") || !System.IO.File.Exists(path)) return (null, null);
        try
        {
            var buf = System.IO.File.ReadAllBytes(path);
            if (System.Text.Encoding.ASCII.GetString(buf, 0, 4) != "DMFP" || BitConverter.ToUInt32(buf, 4) != 2) throw new Exception("not a version 2 fp.bin");
            var len = (int)BitConverter.ToUInt32(buf, 8);
            using var header = JsonDocument.Parse(new ReadOnlyMemory<byte>(buf, 12, len));
            var start = 12 + len;
            float[] Floats(int at, int n) { var a = new float[n]; Buffer.BlockCopy(buf, start + at, a, 0, n * 4); return a; }
            var models = new Dictionary<string, FpSlot[]>();
            foreach (var item in header.RootElement.GetProperty("items").EnumerateObject())
                models[item.Name] = item.Value.EnumerateArray().Select(s =>
                {
                    var verts = s.GetProperty("verts").GetInt32();
                    var tris = s.GetProperty("tris").GetInt32();
                    var at = s.GetProperty("i").GetInt32();
                    var idx = new int[tris * 3];
                    for (var k = 0; k < idx.Length; k++) idx[k] = BitConverter.ToUInt16(buf, start + at + k * 2);
                    float[]? shade = null;
                    if (s.TryGetProperty("shade", out var sh))
                    {
                        shade = new float[verts];
                        for (var k = 0; k < verts; k++) shade[k] = buf[start + sh.GetInt32() + k] / 255f;
                    }
                    var tex = s.TryGetProperty("tex", out var t) ? t.GetInt32() : -1;
                    var uv = tex >= 0 && s.TryGetProperty("uv", out var u) ? Floats(u.GetInt32(), verts * 2) : null;
                    return new FpSlot(s.GetProperty("c").GetString()!, s.TryGetProperty("glow", out var g) && g.GetBoolean(),
                        Floats(s.GetProperty("v").GetInt32(), verts * 3), Floats(s.GetProperty("n").GetInt32(), verts * 3), shade, idx, uv == null ? -1 : tex, uv);
                }).ToArray();
            var tx = header.RootElement.GetProperty("textures");
            var size = tx.GetProperty("size").GetInt32();
            var layers = new Godot.Collections.Array<Image>();
            var names = tx.GetProperty("names").EnumerateArray().Select(n => n.GetString()!).ToArray();
            for (var k = 0; k < names.Length; k++)
            {
                var px = new byte[size * size];
                Buffer.BlockCopy(buf, start + tx.GetProperty("at").GetInt32() + k * size * size, px, 0, px.Length);
                var img = Image.CreateFromData(size, size, false, Image.Format.L8, px);
                img.GenerateMipmaps();
                layers.Add(img);
            }
            var textures = new Texture2DArray();
            textures.CreateFromImages(layers);
            GD.Print($"First-person furniture: {models.Count} models and {names.Length} textures from public/models/fp.bin");
            return (models, textures);
        }
        catch (Exception e)
        {
            GD.PushWarning($"public/models/fp.bin didn't load ({e.Message}); first person draws the code-built parts");
            return (null, null);
        }
    }

    public void SetNight(float night) => _materials[Kind.Glow].SetShaderParameter("glow", GlowDay + night * GlowNight);

    /// <summary>The scene's furniture: { items, accents, placed: [item, accent, x, y, z, turn] }.</summary>
    public Node3D Build(JsonElement furniture)
    {
        var root = new Node3D { Name = "Furniture" };
        _hung.Clear();
        var items = furniture.GetProperty("items").EnumerateArray().Select(e => e.GetString()!).ToArray();
        var accents = furniture.GetProperty("accents").EnumerateArray().Select(e => new Color(e.GetString()!).SrgbToLinear()).ToArray();
        // One batch per item per floor per part of the ring, so what's out of sight (or out of a light's reach) is left out,
        // and each batch twice: near, and a coarser copy (casting no shadow) from FarFrom metres.
        var byItem = new Dictionary<(int item, int floor, int sector), List<float[]>>();
        foreach (var p in furniture.GetProperty("placed").EnumerateArray())
        {
            var v = p.EnumerateArray().Select(x => x.GetSingle()).ToArray();
            var sector = (int)(((Mathf.Atan2(v[4], v[2]) / Mathf.Tau + 1) % 1) * Sectors) % Sectors;
            var key = ((int)v[0], FloorAt(v[3]), sector);
            if (!byItem.TryGetValue(key, out var list)) byItem[key] = list = new();
            list.Add(v);
        }
        _root = root;
        _accents = accents;
        _batches.Clear();
        _fpPairs.Clear();
        foreach (var ((item, _, _), list) in byItem)
        {
            var id = items[item];
            if (MeshFor(id, Lod.Near) is not { } nearMesh) continue;
            var near = Batch(nearMesh, list, id, false, true);
            root.AddChild(near);
            if (MeshFor(id, Lod.Far) is { } farMesh) root.AddChild(Batch(farMesh, list, id + " far", true, true));
            _batches.Add((id, list, near));
            if (_fp != null) AddFp(id, list, near);
        }
        return root;
    }

    /// <summary>A batch of one item's copies as a MultiMesh: near (to FarFrom metres) or far (from there, casting no shadow).</summary>
    MultiMeshInstance3D Batch(Mesh mesh, List<float[]> list, string name, bool far, bool hang)
    {
        var mm = new MultiMesh
        {
            TransformFormat = MultiMesh.TransformFormatEnum.Transform3D,
            UseCustomData = true,
            Mesh = mesh,
            InstanceCount = list.Count,
        };
        for (var i = 0; i < list.Count; i++)
        {
            var v = list[i];
            var at = new Transform3D(new Basis(Vector3.Up, v[5]), new Vector3(v[2], v[3], v[4]));
            mm.SetInstanceTransform(i, at);
            mm.SetInstanceCustomData(i, _accents[(int)v[1]]);
            if (hang && v.Length >= 15) _hung.Add(new Hung(mm, i, at, new Vector2(v[6], v[7]), new Vector3(v[12], v[13], v[14]), v[8], v[9], new Vector2(v[10], v[11]), false));
        }
        return new MultiMeshInstance3D
        {
            Multimesh = mm,
            Name = name,
            VisibilityRangeBegin = far ? FarFrom : 0,
            VisibilityRangeEnd = far ? 0 : FarFrom,
            CastShadow = far ? GeometryInstance3D.ShadowCastingSetting.Off : GeometryInstance3D.ShadowCastingSetting.On,
        };
    }

    /// <summary>A batch's first-person copy, if its item has a model: shown in first person in place of its near parts.</summary>
    void AddFp(string item, List<float[]> list, MultiMeshInstance3D near)
    {
        if (_root == null || MeshFor(item, Lod.Fp) is not { } mesh) return;
        var fp = Batch(mesh, list, item + " fp", false, false);
        fp.Visible = _firstPerson;
        near.Visible = !_firstPerson;
        _root.AddChild(fp);
        _fpPairs.Add((fp, near));
    }

    /// <summary>The floor a height is on (src/render3d/cylinder.ts floorAtY, with the crust 3 m and floors 4 m).</summary>
    static int FloorAt(float y) => Mathf.FloorToInt((-y - 3) / 4) + 1;

    /// <summary>An item's mesh, one surface per kind of part; vertex colour alpha 0 marks accent-coloured parts.</summary>
    Mesh? MeshFor(string id, Lod lod)
    {
        if (_meshes.TryGetValue((id, lod), out var cached)) return cached;
        if (!_items.TryGetValue(id, out var def)) return _meshes[(id, lod)] = null;
        var far = lod == Lod.Far;
        var byKind = new Dictionary<Kind, (List<Vector3> v, List<Vector3> n, List<Color> c, List<Vector2> uv, List<Vector2> uv2)>();
        if (lod == Lod.Fp)
        {
            // Only items with a model have a first-person copy; the rest show their near parts in first person too.
            if (_fp == null || !_fp.TryGetValue(Dev.FpStress ?? id, out var model)) return _meshes[(id, lod)] = null;
            foreach (var slot in model)
            {
                var c = slot.C;
                var kind = slot.Glow ? Kind.Glow : PlantColors.Contains(c) ? Kind.Plant : c == "water" ? Kind.Water : Kind.Plain;
                var color = c == "accent" ? new Color(1, 1, 1, 0) : new Color(_colors.GetValueOrDefault(c, "#ff00ff")).SrgbToLinear() with { A = 1 };
                if (!byKind.TryGetValue(kind, out var s)) byKind[kind] = s = (new(), new(), new(), new(), new());
                AddSlot(slot, color, PartMats.GetValueOrDefault(c, 0), s.v, s.n, s.c, s.uv, s.uv2);
            }
        }
        else foreach (var part in def.GetProperty("parts").EnumerateArray())
        {
            var c = part.GetProperty("c").GetString()!;
            if (far && part.GetProperty("z").EnumerateArray().Max(x => x.GetSingle()) < FarSmallest) continue;
            var kind = part.TryGetProperty("glow", out var g) && g.GetBoolean() ? Kind.Glow : PlantColors.Contains(c) ? Kind.Plant : c == "water" ? Kind.Water : Kind.Plain;
            var color = c == "accent" ? new Color(1, 1, 1, 0) : new Color(_colors.GetValueOrDefault(c, "#ff00ff")).SrgbToLinear() with { A = 1 };
            if (!byKind.TryGetValue(kind, out var s)) byKind[kind] = s = (new(), new(), new(), new(), new());
            AddPart(part, color, PartMats.GetValueOrDefault(c, 0), s.v, s.n, s.c, s.uv, far);
        }
        if (byKind.Count == 0) return _meshes[(id, lod)] = null;
        var mesh = new ArrayMesh();
        foreach (var (kind, s) in byKind)
        {
            var arrays = new Godot.Collections.Array();
            arrays.Resize((int)Mesh.ArrayType.Max);
            arrays[(int)Mesh.ArrayType.Vertex] = s.v.ToArray();
            arrays[(int)Mesh.ArrayType.Normal] = s.n.ToArray();
            arrays[(int)Mesh.ArrayType.Color] = s.c.ToArray();
            arrays[(int)Mesh.ArrayType.TexUV] = s.uv.ToArray();
            if (s.uv2.Count == s.v.Count && s.uv2.Count > 0) arrays[(int)Mesh.ArrayType.TexUV2] = s.uv2.ToArray();
            mesh.AddSurfaceFromArrays(Mesh.PrimitiveType.Triangles, arrays);
            mesh.SurfaceSetMaterial(mesh.GetSurfaceCount() - 1, _materials[kind]);
        }
        return _meshes[(id, lod)] = mesh;
    }

    /// <summary>
    /// One slot of a Blender-made model (public/models/fp.bin): its triangles as they are, the baked shade in UV.y.
    /// A textured slot (#361) puts 10 + its texture's layer in UV.x, in place of its colour's pattern, and where
    /// on the texture each vertex is in UV2. glTF winds front faces counter-clockwise, Godot clockwise, so each
    /// triangle is turned over.
    /// </summary>
    static void AddSlot(FpSlot slot, Color color, int mat, List<Vector3> verts, List<Vector3> norms, List<Color> cols, List<Vector2> uvs, List<Vector2> uvs2)
    {
        var (v, n, shade, idx) = (slot.V, slot.N, slot.Shade, slot.I);
        if (slot.Tex >= 0) mat = 10 + slot.Tex;
        for (var t = 0; t < idx.Length; t += 3)
            foreach (var k in new[] { idx[t], idx[t + 2], idx[t + 1] })
            {
                verts.Add(new Vector3(v[k * 3], v[k * 3 + 1], v[k * 3 + 2]));
                norms.Add(new Vector3(n[k * 3], n[k * 3 + 1], n[k * 3 + 2]));
                cols.Add(color);
                uvs.Add(new Vector2(mat, shade?[k] ?? 1));
                uvs2.Add(slot.Uv != null ? new Vector2(slot.Uv[k * 2], slot.Uv[k * 2 + 1]) : Vector2.Zero);
            }
    }

    /// <summary>One part: a unit shape scaled, turned (degrees, X then Y then Z as three.js's "XYZ"), and moved to its centre.</summary>
    static void AddPart(JsonElement part, Color color, int mat, List<Vector3> verts, List<Vector3> norms, List<Color> cols, List<Vector2> uvs, bool far)
    {
        var shape = part.GetProperty("s").GetString();
        var z = part.GetProperty("z").EnumerateArray().Select(x => x.GetSingle()).ToArray();
        var a = z[0];
        var b = z.Length > 1 ? z[1] : a;
        var c = z.Length > 2 ? z[2] : a;
        var scale = shape == "box" ? new Vector3(a, b, c) : shape == "cyl" ? new Vector3(a, b, a) : new Vector3(a, a, a);
        var rot = Basis.Identity;
        if (part.TryGetProperty("r", out var r))
        {
            var d = r.EnumerateArray().Select(x => Mathf.DegToRad(x.GetSingle())).ToArray();
            rot = new Basis(Vector3.Right, d[0]) * new Basis(Vector3.Up, d[1]) * new Basis(Vector3.Back, d[2]);
        }
        var p = part.GetProperty("p").EnumerateArray().Select(x => x.GetSingle()).ToArray();
        var at = new Vector3(p[0], p[1], p[2]);

        // Near boxes get chamfered edges, built at their real size (scaling would stretch the bevel).
        var chamfer = shape == "box" && !far ? Mathf.Min(Chamfer, Mathf.Min(a, Mathf.Min(b, c)) * 0.25f) : 0;
        var tris = chamfer > 0.002f ? ChamferBox(scale * 0.5f, chamfer) : shape == "box" ? Box() : shape == "cyl" ? Cylinder(far) : Sphere(far);
        if (chamfer > 0.002f) scale = Vector3.One;
        for (var i = 0; i < tris.Count; i += 3)
        {
            var tri = new (Vector3 v, Vector3 n)[3];
            for (var k = 0; k < 3; k++)
            {
                var (v, n) = tris[i + k];
                tri[k] = (rot * (v * scale) + at, (rot * (n / scale)).Normalized());
            }
            // Godot's front faces wind clockwise: the face normal from the winding points away from the outward one.
            var face = (tri[1].v - tri[0].v).Cross(tri[2].v - tri[0].v);
            var outward = tri[0].n + tri[1].n + tri[2].n;
            if (face.Dot(outward) > 0) (tri[1], tri[2]) = (tri[2], tri[1]);
            foreach (var (v, n) in tri)
            {
                verts.Add(v);
                norms.Add(n);
                cols.Add(color);
                uvs.Add(new Vector2(mat, 1));
            }
        }
    }

    // Unit shapes centred on the origin, as three.js's: a 1 m box, a cylinder 1 m across and tall, a sphere 1 m across.
    // Triangles with outward normals; winding is fixed up afterwards.

    static List<(Vector3, Vector3)>? _box;

    /// <summary>
    /// A box with its edges chamfered: six faces inset by the chamfer, a bevel strip along each edge,
    /// a small triangle at each corner. Half-sizes h; outward normals (winding is fixed up afterwards).
    /// </summary>
    static List<(Vector3, Vector3)> ChamferBox(Vector3 h, float c)
    {
        var list = new List<(Vector3, Vector3)>();
        // A corner's point on the face of axis `axis`: full out along that axis, pulled in by c along the others.
        Vector3 P(Vector3 s, int axis)
        {
            var p = new Vector3(s.X * (h.X - c), s.Y * (h.Y - c), s.Z * (h.Z - c));
            p[axis] = s[axis] * h[axis];
            return p;
        }
        var signs = new[] { -1f, 1f };
        for (var axis = 0; axis < 3; axis++)
            foreach (var sa in signs)
            {
                // The face: its four corners.
                int u = (axis + 1) % 3, v = (axis + 2) % 3;
                var n = Vector3.Zero;
                n[axis] = sa;
                Vector3 S(float su, float sv)
                {
                    var s = Vector3.Zero;
                    s[axis] = sa;
                    s[u] = su;
                    s[v] = sv;
                    return s;
                }
                Quad(list, P(S(-1, -1), axis), P(S(1, -1), axis), P(S(1, 1), axis), P(S(-1, 1), axis), n, n, n, n);
                // The bevel along each edge this face shares with the next axis's faces.
                foreach (var sb in signs)
                {
                    var bn = Vector3.Zero;
                    bn[axis] = sa;
                    bn[u] = sb;
                    bn = bn.Normalized();
                    Vector3 E(float sv) => S(sb, sv);
                    Quad(list, P(E(-1), axis), P(E(1), axis), P(E(1), u), P(E(-1), u), bn, bn, bn, bn);
                }
            }
        // The corners.
        foreach (var x in signs)
            foreach (var y in signs)
                foreach (var z in signs)
                {
                    var s = new Vector3(x, y, z);
                    var n = s.Normalized();
                    list.Add((P(s, 0), n));
                    list.Add((P(s, 1), n));
                    list.Add((P(s, 2), n));
                }
        return list;
    }
    static readonly Dictionary<bool, List<(Vector3, Vector3)>> _cyl = new(), _sph = new();

    static List<(Vector3, Vector3)> Box()
    {
        if (_box != null) return _box;
        _box = new();
        foreach (var n in new[] { Vector3.Right, Vector3.Left, Vector3.Up, Vector3.Down, Vector3.Back, Vector3.Forward })
        {
            var u = Mathf.Abs(n.Y) > 0.5f ? Vector3.Right : Vector3.Up;
            var w = n.Cross(u);
            Vector3 P(float s, float t) => (n + u * s + w * t) * 0.5f;
            Quad(_box, P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), n, n, n, n);
        }
        return _box;
    }

    static List<(Vector3, Vector3)> Cylinder(bool far)
    {
        if (_cyl.TryGetValue(far, out var cached)) return cached;
        var cyl = _cyl[far] = new();
        var segments = far ? FarCyl : CylSegments;
        for (var i = 0; i < segments; i++)
        {
            float t0 = Mathf.Tau * i / segments, t1 = Mathf.Tau * (i + 1) / segments;
            var n0 = new Vector3(Mathf.Cos(t0), 0, Mathf.Sin(t0));
            var n1 = new Vector3(Mathf.Cos(t1), 0, Mathf.Sin(t1));
            var lo0 = n0 * 0.5f + Vector3.Down * 0.5f;
            var lo1 = n1 * 0.5f + Vector3.Down * 0.5f;
            var hi0 = n0 * 0.5f + Vector3.Up * 0.5f;
            var hi1 = n1 * 0.5f + Vector3.Up * 0.5f;
            Quad(cyl, lo0, lo1, hi1, hi0, n0, n1, n1, n0);
            cyl.Add((Vector3.Up * 0.5f, Vector3.Up)); cyl.Add((hi0, Vector3.Up)); cyl.Add((hi1, Vector3.Up));
            cyl.Add((Vector3.Down * 0.5f, Vector3.Down)); cyl.Add((lo1, Vector3.Down)); cyl.Add((lo0, Vector3.Down));
        }
        return cyl;
    }

    static List<(Vector3, Vector3)> Sphere(bool far)
    {
        if (_sph.TryGetValue(far, out var cached)) return cached;
        var sph = _sph[far] = new();
        int w = far ? FarSphW : SphW, h = far ? FarSphH : SphH;
        Vector3 At(int i, int j)
        {
            var phi = Mathf.Tau * i / w;
            var theta = Mathf.Pi * j / h;
            return new Vector3(Mathf.Cos(phi) * Mathf.Sin(theta), Mathf.Cos(theta), Mathf.Sin(phi) * Mathf.Sin(theta));
        }
        for (var i = 0; i < w; i++)
            for (var j = 0; j < h; j++)
            {
                Vector3 a = At(i, j), b = At(i + 1, j), c = At(i + 1, j + 1), d = At(i, j + 1);
                Quad(sph, a * 0.5f, b * 0.5f, c * 0.5f, d * 0.5f, a, b, c, d);
            }
        return sph;
    }

    static void Quad(List<(Vector3, Vector3)> list, Vector3 a, Vector3 b, Vector3 c, Vector3 d, Vector3 na, Vector3 nb, Vector3 nc, Vector3 nd)
    {
        list.Add((a, na)); list.Add((b, nb)); list.Add((c, nc));
        list.Add((a, na)); list.Add((c, nc)); list.Add((d, nd));
    }

    /// <summary>
    /// Furniture's surface: its part's colour, or (vertex alpha 0) its room's accent from the instance, darkened by a model's baked shade (UV.y);
    /// glowing parts light up in their own colour; growing ones sway a little, more toward their tops.
    /// </summary>
    const string ShaderCode = @"
shader_type spatial;
#include ""res://shaders/view.gdshaderinc""
uniform float roughness = 0.8;
uniform float metallic = 0.05;
uniform float glow = 0.0;
uniform float sway = 0.0;
// The first-person models' fine textures (#361): a slot with one has 10 + its layer in UV.x, its place in UV2.
uniform sampler2DArray fp_textures : filter_linear_mipmap_anisotropic, repeat_enable;
varying vec2 fpuv;
varying vec3 tint;
varying vec3 wpos;
varying float mat;
varying float shade;
void vertex() {
    tint = mix(INSTANCE_CUSTOM.rgb, COLOR.rgb, COLOR.a);
    wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
    mat = UV.x;
    shade = UV.y;
    fpuv = UV2;
    if (sway > 0.0) {
        vec3 w = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float h = max(0.0, VERTEX.y);
        VERTEX.x += sin(TIME * 1.3 + w.x * 0.7 + w.z * 0.5) * sway * h;
        VERTEX.z += cos(TIME * 1.1 + w.z * 0.6) * sway * 0.6 * h;
    }
}
float hash3(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
        mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y),
        f.z);
}
float fbm3(vec3 p) {
    return 0.5 * noise3(p) + 0.25 * noise3(p * 2.03) + 0.125 * noise3(p * 4.12);
}
// What a part is made of (the web's partTone, surfaces.ts): its shade, and how rough.
vec2 part_tone(vec3 p, float m) {
    if (m < 0.5) return vec2(1.0, 0.0);
    if (m < 1.5) {
        float twill = 0.5 + 0.5 * sin((p.x + p.y + p.z) * 220.0) * sin((p.x - p.z) * 220.0 + p.y * 110.0);
        return vec2(mix(0.95, 1.03, twill) * mix(0.93, 1.04, fbm3(p * 5.0)), 0.05);
    }
    if (m < 2.5) {
        float weave = 0.5 + 0.5 * sin(p.x * 180.0) * sin(p.z * 180.0 + p.y * 180.0);
        return vec2(mix(0.93, 1.03, weave * 0.5 + noise3(p * 30.0) * 0.5), 0.15);
    }
    if (m < 3.5) {
        float brushed = mix(0.95, 1.04, noise3(vec3(p.x * 60.0, p.y * 2.0, p.z * 60.0)));
        float scuff = smoothstep(0.7, 0.85, fbm3(p * 6.0));
        return vec2(brushed * (1.0 - 0.1 * scuff), -0.35 + scuff * 0.3);
    }
    if (m < 4.5) {
        float wear = smoothstep(0.72, 0.8, fbm3(p * 4.0 + 7.0));
        float scratch = smoothstep(0.93, 0.97, noise3(vec3(p.x * 80.0, p.y * 3.0, p.z * 80.0)));
        return vec2((1.0 - 0.22 * wear) * (1.0 - 0.1 * scratch), wear * 0.2);
    }
    float clumps = mix(0.8, 1.12, fbm3(p * 14.0));
    return vec2(clumps * (1.0 - 0.25 * smoothstep(0.75, 0.85, noise3(p * 40.0))), 0.1);
}
void fragment() {
    if (cut_away(wpos)) discard;
    vec2 t = mat > 9.5 ? vec2(1.0, 0.0) : part_tone(wpos, mat);
    ALBEDO = tint * t.x * shade;
    if (mat > 9.5) ALBEDO *= texture(fp_textures, vec3(fpuv, floor(mat - 10.0 + 0.5))).r * 2.0;
    ROUGHNESS = clamp(roughness + t.y, 0.05, 1.0);
    METALLIC = mat > 2.5 && mat < 3.5 ? max(metallic, 0.5) : metallic;
    EMISSION = tint * glow;
}
";
}
