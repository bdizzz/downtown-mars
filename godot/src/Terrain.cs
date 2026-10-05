using System;
using System.Runtime.InteropServices;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// The land round the hole, as the bridge sends it (src/bridge/terrain.ts, the web's own terrain3d.ts):
/// the ground rolling away from the pad in the regolith surface, the boulders as one MultiMesh, and the
/// horizon's mountains, mesas or hills, both faceted as the web's.
/// </summary>
public partial class Terrain : Node3D
{
    public int HoleId { get; private set; } = -1;

    static float[] Floats(JsonElement e) => MemoryMarshal.Cast<byte, float>(Convert.FromBase64String(e.GetString()!)).ToArray();
    static int[] Ints(JsonElement e) => MemoryMarshal.Cast<byte, int>(Convert.FromBase64String(e.GetString()!)).ToArray();

    /// <summary>A mesh from positions, normals and (if any) indices; three.js winds counter-clockwise, Godot clockwise.</summary>
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
            }
        }
        var mesh = new ArrayMesh();
        mesh.AddSurfaceFromArrays(Godot.Mesh.PrimitiveType.Triangles, arrays);
        mesh.SurfaceSetMaterial(0, material);
        return mesh;
    }

    /// <summary>Marks a material as land, for Iso's slice (view.gdshaderinc).</summary>
    public static Material Land(Material m)
    {
        if (m is ShaderMaterial s) s.SetShaderParameter("land", true);
        return m;
    }

    public void Set(JsonElement m)
    {
        foreach (var c in GetChildren()) c.QueueFree();
        HoleId = m.GetProperty("holeId").GetInt32();
        var groundMaterial = Looks.For("rock:ground", new Color("#7a3b22"), 1, 0, false)!;
        Land(groundMaterial);
        AddChild(new MeshInstance3D { Mesh = Mesh(m.GetProperty("ground"), groundMaterial), Name = "Ground" });
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
    }
}
