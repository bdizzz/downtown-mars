using System;
using System.Runtime.InteropServices;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// The land round the hole, as the bridge sends it (src/bridge/terrain.ts, the web's own terrain3d.ts):
/// the ground rolling away from the pad in the regolith surface, the boulders as one MultiMesh, and the
/// horizon: its far ridge and the massifs, mesas, plateaus, hills and crater rims in front of it (T-016),
/// all faceted as the web's. The ground takes the colour the map
/// shows at the site (T-073), and the site's latitude sets the sun's path and the stars (T-020, Live.cs).
/// </summary>
public partial class Terrain : Node3D
{
    public int HoleId { get; private set; } = -1;
    /// <summary>The site's latitude in degrees north (a default before it has a place on the map).</summary>
    public float Latitude { get; private set; } = 45;

    static float[] Floats(JsonElement e) => MemoryMarshal.Cast<byte, float>(Convert.FromBase64String(e.GetString()!)).ToArray();
    static int[] Ints(JsonElement e) => MemoryMarshal.Cast<byte, int>(Convert.FromBase64String(e.GetString()!)).ToArray();

    /// <summary>A mesh from positions, normals, (if any) colours and (if any) indices; three.js winds counter-clockwise, Godot clockwise.</summary>
    static ArrayMesh Mesh(JsonElement m, Material material)
    {
        var p = Floats(m.GetProperty("positions"));
        var n = Floats(m.GetProperty("normals"));
        var verts = new Vector3[p.Length / 3];
        var norms = new Vector3[p.Length / 3];
        for (var i = 0; i < verts.Length; i++)
        {
            verts[i] = new Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
            norms[i] = new Vector3(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]);
        }
        // Colours face by face (#497: a canyon's beds), linear as three.js keeps them, as Plain's shader multiplies them in.
        Color[]? cols = null;
        if (m.TryGetProperty("colors", out var ce))
        {
            var c = Floats(ce);
            cols = new Color[verts.Length];
            for (var i = 0; i < cols.Length; i++) cols[i] = new Color(c[i * 3], c[i * 3 + 1], c[i * 3 + 2]);
        }
        var arrays = new Godot.Collections.Array();
        arrays.Resize((int)Godot.Mesh.ArrayType.Max);
        arrays[(int)Godot.Mesh.ArrayType.Vertex] = verts;
        arrays[(int)Godot.Mesh.ArrayType.Normal] = norms;
        if (m.TryGetProperty("indices", out var ie))
        {
            var idx = Ints(ie);
            for (var i = 0; i + 2 < idx.Length; i += 3) (idx[i + 1], idx[i + 2]) = (idx[i + 2], idx[i + 1]);
            arrays[(int)Godot.Mesh.ArrayType.Index] = idx;
        }
        else
        {
            for (var i = 0; i + 2 < verts.Length; i += 3)
            {
                (verts[i + 1], verts[i + 2]) = (verts[i + 2], verts[i + 1]);
                (norms[i + 1], norms[i + 2]) = (norms[i + 2], norms[i + 1]);
                if (cols != null) (cols[i + 1], cols[i + 2]) = (cols[i + 2], cols[i + 1]);
            }
        }
        if (cols != null) arrays[(int)Godot.Mesh.ArrayType.Color] = cols;
        // How far up its landform each vertex stands (#497), for the rock's beds: in UV.x.
        if (m.TryGetProperty("heights", out var he))
        {
            var h = Floats(he);
            var uv = new Vector2[verts.Length];
            for (var i = 0; i < uv.Length; i++) uv[i] = new Vector2(h[i], 0);
            if (!m.TryGetProperty("indices", out _))
                for (var i = 0; i + 2 < uv.Length; i += 3) (uv[i + 1], uv[i + 2]) = (uv[i + 2], uv[i + 1]);
            arrays[(int)Godot.Mesh.ArrayType.TexUV] = uv;
        }
        var mesh = new ArrayMesh();
        mesh.AddSurfaceFromArrays(Godot.Mesh.PrimitiveType.Triangles, arrays);
        mesh.SurfaceSetMaterial(0, material);
        return mesh;
    }

    /// <summary>Marks a material as land, for Free view's cut-out (view.gdshaderinc `slice_role`).</summary>
    public static Material Land(Material m)
    {
        if (m is ShaderMaterial s) s.SetShaderParameter("slice_role", 1);
        return m;
    }

    ShaderMaterial? _ground;

    static Texture2D? _detail;
    static bool _detailTried;

    /// <summary>The land's rock-detail map (#497), the web's own (public/textures/land-rock.jpg, made in Blender); null if it can't be read.</summary>
    static Texture2D? Detail()
    {
        if (_detailTried) return _detail;
        _detailTried = true;
        var path = ProjectSettings.GlobalizePath("res://") + "../public/textures/land-rock.jpg";
        var image = Image.LoadFromFile(path);
        if (image == null || image.IsEmpty()) return null;
        image.GenerateMipmaps();
        return _detail = ImageTexture.CreateFromImage(image);
    }

    /// <summary>
    /// The far shadows on the ground (#497, the web's FAR_SHADOW in surfaces.ts): the sun's shadow map reaches
    /// 200 m, so a canyon's walls, a crater's rim, the horizon and the landforms cast theirs by a march toward the
    /// sun in the ground's shader (surfaces.gdshader `far_lit`), against the skyline by angle and the landforms.
    /// </summary>
    void FarShadows(JsonElement m, Material ground)
    {
        _ground = ground as ShaderMaterial;
        if (_ground == null || !m.TryGetProperty("shadows", out var sh)) return;
        var o = Floats(sh.GetProperty("occluder"));
        var image = Image.CreateFromData(o.Length / 2, 1, false, Image.Format.Rgf, MemoryMarshal.AsBytes(o.AsSpan()).ToArray());
        _ground.SetShaderParameter("far_occluder", ImageTexture.CreateFromImage(image));
        var forms = new Vector4[8];
        var k = 0;
        foreach (var f in sh.GetProperty("forms").EnumerateArray())
        {
            if (k >= 8) break;
            forms[k++] = new Vector4(f[0].GetSingle(), f[1].GetSingle(), f[2].GetSingle(), f[3].GetSingle());
        }
        _ground.SetShaderParameter("far_forms", forms);
        _ground.SetShaderParameter("far_shadow", true);
    }

    /// <summary>Where the sun is (toward it) and how strong its direct light is, 0 to 1, for the far shadows.</summary>
    public void SetSun(Vector3 toward, float strength)
    {
        _ground?.SetShaderParameter("far_sun", toward);
        _ground?.SetShaderParameter("far_strength", strength);
    }

    public void Set(JsonElement m)
    {
        foreach (var c in GetChildren()) c.QueueFree();
        HoleId = m.GetProperty("holeId").GetInt32();
        Latitude = m.GetProperty("latitude").GetSingle();
        var groundMaterial = Looks.For("rock:ground", new Color(m.GetProperty("groundColor").GetString()!), 1, 0, false)!;
        Land(groundMaterial);
        AddChild(new MeshInstance3D { Mesh = Mesh(m.GetProperty("ground"), groundMaterial), Name = "Ground" });
        FarShadows(m, groundMaterial);
        var rocks = m.GetProperty("rocks");
        var t = Floats(rocks.GetProperty("transforms"));
        var mm = new MultiMesh
        {
            TransformFormat = MultiMesh.TransformFormatEnum.Transform3D,
            Mesh = Mesh(rocks.GetProperty("mesh"), Land(Plain.Make(new Color(rocks.GetProperty("color").GetString()!), 1, flat: true))),
            InstanceCount = t.Length / 12,
        };
        for (var i = 0; i < mm.InstanceCount; i++)
        {
            var k = i * 12;
            mm.SetInstanceTransform(i, new Transform3D(new Basis(new Vector3(t[k], t[k + 1], t[k + 2]), new Vector3(t[k + 3], t[k + 4], t[k + 5]), new Vector3(t[k + 6], t[k + 7], t[k + 8])), new Vector3(t[k + 9], t[k + 10], t[k + 11])));
        }
        AddChild(new MultiMeshInstance3D { Multimesh = mm, Name = "Boulders" });
        var horizon = m.GetProperty("horizon");
        AddChild(new MeshInstance3D { Mesh = Mesh(horizon.GetProperty("mesh"), Land(Plain.Make(new Color(horizon.GetProperty("color").GetString()!), 1, flat: true))), Name = "Horizon", CastShadow = GeometryInstance3D.ShadowCastingSetting.Off });
        if (!m.TryGetProperty("landforms", out var landforms)) return;
        var n = 0;
        foreach (var f in landforms.EnumerateArray())
        {
            var mesh = f.GetProperty("mesh");
            var colored = mesh.TryGetProperty("colors", out _);
            var material = Plain.Make(new Color(f.GetProperty("color").GetString()!), 1, vertexColors: colored, flat: true);
            // The land's rock (#497): bedded on mesas, walls and crater rims, weathered on the rest.
            if (mesh.TryGetProperty("heights", out _))
            {
                material.SetShaderParameter("land_rock", f.TryGetProperty("layered", out var l) && l.GetBoolean() ? 2 : 1);
                if (Detail() is Texture2D detail)
                {
                    material.SetShaderParameter("land_detail", detail);
                    material.SetShaderParameter("land_detail_on", true);
                }
            }
            AddChild(new MeshInstance3D { Mesh = Mesh(mesh, Land(material)), Name = $"Landform{n++}", CastShadow = GeometryInstance3D.ShadowCastingSetting.Off });
        }
    }
}
