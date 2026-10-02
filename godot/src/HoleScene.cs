using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// The hole as the bridge sends it (src/bridge/scene.ts): chunks of merged geometry, each with a
/// material, dressed here with Godot's own looks (Dress.cs); the furniture, drawn per item as
/// MultiMeshes (Furniture.cs); a real light per lamp; and room labels. Built again whenever a new
/// scene comes in.
/// </summary>
public partial class HoleScene : Node3D
{
    readonly Furniture _furniture = new();
    readonly List<OmniLight3D> _lamps = new();
    /// <summary>Lamps casting shadows: only the nearest few to the camera (a shadow pass per lamp redraws everything near it).</summary>
    const int ShadowLamps = 8;
    const float ShadowWithin = 40;
    public int Lamps { get; private set; }
    public int Chunks { get; private set; }
    public bool ShowLabels { get => _labels.Visible; set => _labels.Visible = value; }
    Node3D _labels = new() { Name = "Labels" };

    public void Build(JsonElement scene)
    {
        foreach (var c in GetChildren()) c.QueueFree();
        _labels = new Node3D { Name = "Labels" };
        AddChild(_labels);

        var materials = new List<Material>();
        foreach (var m in scene.GetProperty("materials").EnumerateArray()) materials.Add(MaterialFor(m));

        Chunks = 0;
        foreach (var c in scene.GetProperty("chunks").EnumerateArray())
        {
            var mesh = ChunkMesh(c);
            if (mesh == null) continue;
            mesh.SurfaceSetMaterial(0, materials[c.GetProperty("material").GetInt32()]);
            AddChild(new MeshInstance3D { Mesh = mesh, Name = $"chunk{Chunks++}" });
        }

        AddChild(_furniture.Build(scene.GetProperty("furniture")));

        Lamps = 0;
        _lamps.Clear();
        foreach (var l in scene.GetProperty("lamps").EnumerateArray())
        {
            var lamp = new OmniLight3D
            {
                Position = new Vector3(l.GetProperty("x").GetSingle(), l.GetProperty("y").GetSingle(), l.GetProperty("z").GetSingle()),
                LightColor = new Color(l.GetProperty("color").GetString()!),
                LightEnergy = l.GetProperty("strength").GetSingle() * Lighting.LampEnergy,
                OmniRange = l.GetProperty("reach").GetSingle() * Lighting.LampRange,
                OmniAttenuation = 1.4f,
                ShadowEnabled = false,
                LightIndirectEnergy = 1.2f,
                LightVolumetricFogEnergy = 0.6f,
            };
            lamp.SetMeta("floor", l.GetProperty("floor").GetInt32());
            AddChild(lamp);
            _lamps.Add(lamp);
            Lamps++;
        }

        foreach (var l in scene.GetProperty("labels").EnumerateArray())
        {
            _labels.AddChild(new Label3D
            {
                Text = l.GetProperty("text").GetString(),
                Position = new Vector3(l.GetProperty("x").GetSingle(), l.GetProperty("y").GetSingle(), l.GetProperty("z").GetSingle()),
                Billboard = BaseMaterial3D.BillboardModeEnum.Enabled,
                FontSize = 48,
                PixelSize = 0.01f,
                OutlineSize = 10,
                Modulate = new Color(1, 0.95f, 0.9f),
                OutlineModulate = new Color(0.1f, 0.05f, 0.04f, 0.8f),
                NoDepthTest = false,
            });
        }
    }

    /// <summary>
    /// Lamps on these floors light up, the rest are off (each light costs every pixel it might reach);
    /// and shadows for the lamps nearest the camera, off for the rest.
    /// </summary>
    public void UpdateLamps(Vector3 camera, int fromFloor, int toFloor)
    {
        foreach (var l in _lamps)
        {
            var f = l.GetMeta("floor").AsInt32();
            l.Visible = f >= fromFloor && f <= toFloor;
        }
        var near = _lamps
            .Where(l => l.Visible)
            .Select(l => (l, d: l.Position.DistanceSquaredTo(camera)))
            .Where(x => x.d < ShadowWithin * ShadowWithin)
            .OrderBy(x => x.d)
            .Take(ShadowLamps)
            .Select(x => x.l)
            .ToHashSet();
        foreach (var l in _lamps) l.ShadowEnabled = near.Contains(l);
    }

    /// <summary>Glowing furniture brightens as the sky darkens: 0 at noon, 1 at night.</summary>
    public void SetNight(float night) => _furniture.SetNight(night);

    static Material MaterialFor(JsonElement m)
    {
        var kind = m.GetProperty("kind").GetString();
        var color = new Color(m.GetProperty("color").GetString()!);
        var opacity = m.GetProperty("opacity").GetSingle();
        var transparent = m.GetProperty("transparent").GetBoolean();
        if (kind == "line")
            return new StandardMaterial3D
            {
                ShadingMode = BaseMaterial3D.ShadingModeEnum.Unshaded,
                AlbedoColor = new Color(color, opacity),
                Transparency = transparent ? BaseMaterial3D.TransparencyEnum.Alpha : BaseMaterial3D.TransparencyEnum.Disabled,
            };
        // The web game's material as a plain Godot one, then dressed by what it is.
        var src = new StandardMaterial3D
        {
            ResourceName = m.GetProperty("name").GetString(),
            AlbedoColor = new Color(color, opacity),
            Transparency = transparent ? BaseMaterial3D.TransparencyEnum.Alpha : BaseMaterial3D.TransparencyEnum.Disabled,
            Roughness = m.GetProperty("roughness").GetSingle(),
            Metallic = m.GetProperty("metalness").GetSingle(),
        };
        var emissive = new Color(m.GetProperty("emissive").GetString()!);
        var glow = m.GetProperty("emissiveIntensity").GetSingle();
        if (glow > 0 && emissive.Luminance > 0.01f)
        {
            src.EmissionEnabled = true;
            src.Emission = emissive;
            src.EmissionEnergyMultiplier = glow;
        }
        var dressed = Dress.For(src);
        if (m.GetProperty("vertexColors").GetBoolean() && dressed is StandardMaterial3D s && !s.VertexColorUseAsAlbedo)
        {
            s = (StandardMaterial3D)s.Duplicate();
            s.VertexColorUseAsAlbedo = true;
            return s;
        }
        return dressed;
    }

    static float[] Floats(JsonElement e)
    {
        var bytes = Convert.FromBase64String(e.GetString()!);
        return MemoryMarshal.Cast<byte, float>(bytes).ToArray();
    }

    /// <summary>One chunk's geometry. Three.js faces are counter-clockwise; Godot's clockwise, so each triangle turns over.</summary>
    static ArrayMesh? ChunkMesh(JsonElement c)
    {
        var lines = c.GetProperty("lines").GetBoolean();
        var p = Floats(c.GetProperty("positions"));
        var count = p.Length / 3;
        if (count == 0) return null;
        var order = new int[count];
        for (var i = 0; i < count; i++) order[i] = i;
        if (!lines)
            for (var i = 0; i + 2 < count; i += 3) (order[i + 1], order[i + 2]) = (order[i + 2], order[i + 1]);

        var verts = new Vector3[count];
        for (var i = 0; i < count; i++)
        {
            var k = order[i] * 3;
            verts[i] = new Vector3(p[k], p[k + 1], p[k + 2]);
        }
        var arrays = new Godot.Collections.Array();
        arrays.Resize((int)Mesh.ArrayType.Max);
        arrays[(int)Mesh.ArrayType.Vertex] = verts;
        if (c.TryGetProperty("normals", out var ne))
        {
            var n = Floats(ne);
            var normals = new Vector3[count];
            for (var i = 0; i < count; i++)
            {
                var k = order[i] * 3;
                normals[i] = new Vector3(n[k], n[k + 1], n[k + 2]);
            }
            arrays[(int)Mesh.ArrayType.Normal] = normals;
        }
        if (c.TryGetProperty("colors", out var ce))
        {
            var col = Floats(ce);
            var colors = new Color[count];
            for (var i = 0; i < count; i++)
            {
                var k = order[i] * 3;
                colors[i] = new Color(col[k], col[k + 1], col[k + 2]);
            }
            arrays[(int)Mesh.ArrayType.Color] = colors;
        }
        var mesh = new ArrayMesh();
        mesh.AddSurfaceFromArrays(lines ? Mesh.PrimitiveType.Lines : Mesh.PrimitiveType.Triangles, arrays);
        return mesh;
    }
}
