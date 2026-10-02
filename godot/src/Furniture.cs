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
/// hundred draw calls at most.
/// </summary>
public class Furniture
{
    const int CylSegments = 12, SphW = 10, SphH = 8;
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
    readonly Dictionary<(string, bool), Mesh?> _meshes = new();
    readonly Dictionary<Kind, ShaderMaterial> _materials = new();

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

    public void SetNight(float night) => _materials[Kind.Glow].SetShaderParameter("glow", GlowDay + night * GlowNight);

    /// <summary>The scene's furniture: { items, accents, placed: [item, accent, x, y, z, turn] }.</summary>
    public Node3D Build(JsonElement furniture)
    {
        var root = new Node3D { Name = "Furniture" };
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
        foreach (var ((item, _, _), list) in byItem)
        {
            foreach (var far in new[] { false, true })
            {
                var mesh = MeshFor(items[item], far);
                if (mesh == null) continue;
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
                    mm.SetInstanceTransform(i, new Transform3D(new Basis(Vector3.Up, v[5]), new Vector3(v[2], v[3], v[4])));
                    mm.SetInstanceCustomData(i, accents[(int)v[1]]);
                }
                root.AddChild(new MultiMeshInstance3D
                {
                    Multimesh = mm,
                    Name = items[item] + (far ? " far" : ""),
                    VisibilityRangeBegin = far ? FarFrom : 0,
                    VisibilityRangeEnd = far ? 0 : FarFrom,
                    CastShadow = far ? GeometryInstance3D.ShadowCastingSetting.Off : GeometryInstance3D.ShadowCastingSetting.On,
                });
            }
        }
        return root;
    }

    /// <summary>The floor a height is on (src/render3d/cylinder.ts floorAtY, with the crust 3 m and floors 4 m).</summary>
    static int FloorAt(float y) => Mathf.FloorToInt((-y - 3) / 4) + 1;

    /// <summary>An item's mesh, one surface per kind of part; vertex colour alpha 0 marks accent-coloured parts.</summary>
    Mesh? MeshFor(string id, bool far)
    {
        if (_meshes.TryGetValue((id, far), out var cached)) return cached;
        if (!_items.TryGetValue(id, out var def)) return _meshes[(id, far)] = null;
        var byKind = new Dictionary<Kind, (List<Vector3> v, List<Vector3> n, List<Color> c)>();
        foreach (var part in def.GetProperty("parts").EnumerateArray())
        {
            var c = part.GetProperty("c").GetString()!;
            if (far && part.GetProperty("z").EnumerateArray().Max(x => x.GetSingle()) < FarSmallest) continue;
            var kind = part.TryGetProperty("glow", out var g) && g.GetBoolean() ? Kind.Glow : PlantColors.Contains(c) ? Kind.Plant : c == "water" ? Kind.Water : Kind.Plain;
            var color = c == "accent" ? new Color(1, 1, 1, 0) : new Color(_colors.GetValueOrDefault(c, "#ff00ff")).SrgbToLinear() with { A = 1 };
            if (!byKind.TryGetValue(kind, out var s)) byKind[kind] = s = (new(), new(), new());
            AddPart(part, color, s.v, s.n, s.c, far);
        }
        if (byKind.Count == 0) return _meshes[(id, far)] = null;
        var mesh = new ArrayMesh();
        foreach (var (kind, s) in byKind)
        {
            var arrays = new Godot.Collections.Array();
            arrays.Resize((int)Mesh.ArrayType.Max);
            arrays[(int)Mesh.ArrayType.Vertex] = s.v.ToArray();
            arrays[(int)Mesh.ArrayType.Normal] = s.n.ToArray();
            arrays[(int)Mesh.ArrayType.Color] = s.c.ToArray();
            mesh.AddSurfaceFromArrays(Mesh.PrimitiveType.Triangles, arrays);
            mesh.SurfaceSetMaterial(mesh.GetSurfaceCount() - 1, _materials[kind]);
        }
        return _meshes[(id, far)] = mesh;
    }

    /// <summary>One part: a unit shape scaled, turned (degrees, X then Y then Z as three.js's "XYZ"), and moved to its centre.</summary>
    static void AddPart(JsonElement part, Color color, List<Vector3> verts, List<Vector3> norms, List<Color> cols, bool far)
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

        var tris = shape == "box" ? Box() : shape == "cyl" ? Cylinder(far) : Sphere(far);
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
            }
        }
    }

    // Unit shapes centred on the origin, as three.js's: a 1 m box, a cylinder 1 m across and tall, a sphere 1 m across.
    // Triangles with outward normals; winding is fixed up afterwards.

    static List<(Vector3, Vector3)>? _box;
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
    /// Furniture's surface: its part's colour, or (vertex alpha 0) its room's accent from the instance;
    /// glowing parts light up in their own colour; growing ones sway a little, more toward their tops.
    /// </summary>
    const string ShaderCode = @"
shader_type spatial;
uniform float roughness = 0.8;
uniform float metallic = 0.05;
uniform float glow = 0.0;
uniform float sway = 0.0;
varying vec3 tint;
void vertex() {
    tint = mix(INSTANCE_CUSTOM.rgb, COLOR.rgb, COLOR.a);
    if (sway > 0.0) {
        vec3 w = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float h = max(0.0, VERTEX.y);
        VERTEX.x += sin(TIME * 1.3 + w.x * 0.7 + w.z * 0.5) * sway * h;
        VERTEX.z += cos(TIME * 1.1 + w.z * 0.6) * sway * 0.6 * h;
    }
}
void fragment() {
    ALBEDO = tint;
    ROUGHNESS = roughness;
    METALLIC = metallic;
    EMISSION = tint * glow;
}
";
}
