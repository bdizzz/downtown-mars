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
    /// <summary>How many lamps cast shadows (the graphics level's).</summary>
    public int ShadowLamps { get; set; } = 4;
    const float ShadowWithin = 40;
    /// <summary>How much the nearest lamps light the haze.</summary>
    const float FogEnergy = 0.6f;
    public int Lamps { get; private set; }
    public int Chunks { get; private set; }
    bool _showLabels = true;
    public bool ShowLabels
    {
        get => _showLabels;
        set
        {
            _showLabels = value;
            if (_labels != null) _labels.Visible = value;
        }
    }
    readonly List<MeshInstance3D> _edges = new();
    readonly List<bool> _seeThrough = new();
    readonly Dictionary<int, List<MeshInstance3D>> _solid = new();
    readonly HashSet<int> _collided = new();

    /// <summary>Make these floors' surfaces solid to clicks (once each per scene).</summary>
    public void EnsureCollision(IEnumerable<int> floors)
    {
        if (Dev.Off("collision")) return;
        foreach (var f in floors)
        {
            if (!_collided.Add(f) || !_solid.TryGetValue(f, out var list)) continue;
            foreach (var instance in list)
            {
                var body = new StaticBody3D();
                body.AddChild(new CollisionShape3D { Shape = new ConcavePolygonShape3D { Data = instance.Mesh.GetFaces(), BackfaceCollision = true } });
                instance.AddChild(body);
            }
        }
    }
    bool _showEdges = true;
    /// <summary>Rooms' outlines: they help from above, and look like glitches up close (off in first person).</summary>
    public bool ShowEdges
    {
        get => _showEdges;
        set
        {
            _showEdges = value;
            foreach (var e in _edges) e.Visible = value;
        }
    }
    Node3D? _labels;

    public void Build(JsonElement scene)
    {
        foreach (var c in GetChildren()) c.QueueFree();
        _labels = new Node3D { Name = "Labels", Visible = _showLabels };
        AddChild(_labels);

        var materials = new List<Material>();
        _seeThrough.Clear();
        foreach (var m in scene.GetProperty("materials").EnumerateArray())
        {
            materials.Add(MaterialFor(m));
            _seeThrough.Add(m.GetProperty("transparent").GetBoolean());
        }

        Chunks = 0;
        _edges.Clear();
        _solid.Clear();
        _collided.Clear();
        foreach (var c in scene.GetProperty("chunks").EnumerateArray())
        {
            var mesh = ChunkMesh(c);
            if (mesh == null) continue;
            mesh.SurfaceSetMaterial(0, materials[c.GetProperty("material").GetInt32()]);
            var instance = new MeshInstance3D { Mesh = mesh, Name = $"chunk{Chunks++}" };
            // Solid surfaces take clicks (a ray finds what's under the pointer); glass and outlines don't.
            // Their collision is made when their floor comes into view (EnsureCollision): all at once took a second.
            if (!c.GetProperty("lines").GetBoolean() && !_seeThrough[c.GetProperty("material").GetInt32()])
            {
                var floor = c.GetProperty("floor").GetInt32();
                if (!_solid.TryGetValue(floor, out var list)) _solid[floor] = list = new();
                list.Add(instance);
            }
            if (c.GetProperty("lines").GetBoolean())
            {
                instance.Visible = _showEdges;
                instance.CastShadow = GeometryInstance3D.ShadowCastingSetting.Off;
                _edges.Add(instance);
            }
            AddChild(instance);
        }

        if (!Dev.Off("furniture")) AddChild(_furniture.Build(scene.GetProperty("furniture")));

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
                // Two passes per shadow, not a cube's six.
                OmniShadowMode = OmniLight3D.ShadowMode.DualParaboloid,
                LightIndirectEnergy = 1.2f,
                // Lamps don't move: global illumination takes them in once, not every frame.
                LightBakeMode = Light3D.BakeMode.Static,
                // Only the nearest light the haze (see UpdateLamps).
                LightVolumetricFogEnergy = 0,
            };
            lamp.SetMeta("floor", l.GetProperty("floor").GetInt32());
            AddChild(lamp);
            _lamps.Add(lamp);
            Lamps++;
        }

        if (!Dev.Off("labels"))
        foreach (var l in scene.GetProperty("labels").EnumerateArray())
        {
            _labels!.AddChild(new Label3D
            {
                Visible = !CutAway(_cut, new Vector3(l.GetProperty("x").GetSingle(), 0, l.GetProperty("z").GetSingle())),
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
    /// and shadows and haze for the lamps nearest the camera, off for the rest.
    /// </summary>
    public void UpdateLamps(Vector3 camera, int fromFloor, int toFloor, Vector4 cut = default)
    {
        foreach (var l in _lamps)
        {
            var f = l.GetMeta("floor").AsInt32();
            l.Visible = f >= fromFloor && f <= toFloor && !Dev.Off("lamps") && !CutAway(cut, l.Position);
        }
        var near = _lamps
            .Where(l => l.Visible)
            .Select(l => (l, d: l.Position.DistanceSquaredTo(camera)))
            .Where(x => x.d < ShadowWithin * ShadowWithin)
            .OrderBy(x => x.d)
            .Take(ShadowLamps)
            .Select(x => x.l)
            .ToHashSet();
        foreach (var l in _lamps)
        {
            var close = near.Contains(l);
            l.ShadowEnabled = close;
            l.LightVolumetricFogEnergy = close ? FogEnergy : 0;
        }
    }

    /// <summary>On the cutaway's cut-away side (view.gdshaderinc cut_away)?</summary>
    static bool CutAway(Vector4 cut, Vector3 p) => cut.W > 0.5f && p.X * cut.X + p.Z * cut.Z > 0;

    Vector4 _cut;

    /// <summary>The cutaway's cut: labels on the cut-away side go (the surfaces' shaders take the rest).</summary>
    public void SetCut(Vector4 cut)
    {
        if (cut == _cut) return;
        _cut = cut;
        if (_labels == null) return;
        foreach (var l in _labels.GetChildren().OfType<Label3D>()) l.Visible = !CutAway(cut, l.Position);
    }

    /// <summary>Glowing furniture brightens as the sky darkens: 0 at noon, 1 at night.</summary>
    public void SetNight(float night) => _furniture.SetNight(night);

    static Material MaterialFor(JsonElement m)
    {
        var kind = m.GetProperty("kind").GetString();
        var color = new Color(m.GetProperty("color").GetString()!);
        var opacity = m.GetProperty("opacity").GetSingle();
        var transparent = m.GetProperty("transparent").GetBoolean();
        if (kind == "line") return Plain.Make(new Color(color, opacity), transparent: transparent, unshaded: true);
        // Rooms, rock and finishes: the procedural surfaces (Looks.cs).
        if (!Dev.Off("looks") && Looks.For(m.GetProperty("name").GetString() ?? "", color, m.GetProperty("roughness").GetSingle(), m.GetProperty("metalness").GetSingle(), transparent) is Material look)
            return look;
        // Anything else (doors, props, glass, lamps): plain, so the view can cut it (Plain.cs).
        var emissive = new Color(m.GetProperty("emissive").GetString()!);
        var glow = m.GetProperty("emissiveIntensity").GetSingle();
        var glows = glow > 0 && emissive.Luminance > 0.01f;
        var vertexColors = m.GetProperty("vertexColors").GetBoolean();
        // Glass: clear, glossy, a faint tint.
        if (transparent)
            return Plain.Make(new Color(color, Mathf.Clamp(opacity, 0.08f, 0.35f)), 0.04f, 0, transparent: true, emission: glows ? emissive : null, emissionEnergy: glow, vertexColors: vertexColors, specular: 0.8f);
        return Plain.Make(color, Mathf.Min(m.GetProperty("roughness").GetSingle(), 0.8f), m.GetProperty("metalness").GetSingle(), emission: glows ? emissive : null, emissionEnergy: glow, vertexColors: vertexColors, grain: glows ? 0 : 1);
    }

    static float[] Floats(JsonElement e)
    {
        var bytes = Convert.FromBase64String(e.GetString()!);
        return MemoryMarshal.Cast<byte, float>(bytes).ToArray();
    }

    /// <summary>One chunk's geometry. Three.js faces are counter-clockwise; Godot's clockwise, so each triangle turns over.</summary>
    internal static ArrayMesh? ChunkMesh(JsonElement c)
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
