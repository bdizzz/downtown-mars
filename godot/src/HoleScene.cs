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
            var material = materials[c.GetProperty("material").GetInt32()];
            // Walls down only where there are walls to lower (the mesh carries their tags).
            if (mesh.HasMeta("walls") && material is ShaderMaterial sm) sm.SetShaderParameter("walls", true);
            if (mesh.HasMeta("rooms") && material is ShaderMaterial rm) rm.SetShaderParameter("room_lines", true);
            mesh.SurfaceSetMaterial(0, material);
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
            var label = new Label3D
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
            };
            label.Layers = LabelLayers(label.Position.Y);
            label.SetMeta("room", l.GetProperty("roomId").GetInt32());
            _labels!.AddChild(label);
        }
        _badgesKey = "";
        SetBadges(_badged);
    }

    HashSet<int> _badged = new();
    string _badgesKey = "";

    /// <summary>A caution sign over the labels of these rooms (slowed or short of something), as the web's statusBadge.</summary>
    public void SetBadges(HashSet<int> rooms)
    {
        var key = string.Join(",", rooms.OrderBy(x => x));
        _badged = rooms;
        if (key == _badgesKey || _labels == null) return;
        _badgesKey = key;
        foreach (var l in _labels.GetChildren().OfType<Label3D>())
        {
            var badge = l.GetNodeOrNull<Label3D>("Badge");
            var want = l.HasMeta("room") && rooms.Contains(l.GetMeta("room").AsInt32());
            if (want && badge == null)
                l.AddChild(new Label3D
                {
                    Name = "Badge",
                    Layers = l.Layers,
                    Text = "⚠",
                    Position = new Vector3(0, BadgeAbove, 0),
                    Billboard = BaseMaterial3D.BillboardModeEnum.Enabled,
                    FontSize = 56,
                    PixelSize = 0.01f,
                    OutlineSize = 10,
                    Modulate = new Color("#f0a030"),
                    OutlineModulate = new Color(0.1f, 0.05f, 0.04f, 0.8f),
                });
            else if (!want) badge?.QueueFree();
        }
    }

    /// <summary>How far above a room's label its trouble badge floats, metres (the web's BADGE_ABOVE).</summary>
    const float BadgeAbove = 0.9f;

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

    /// <summary>Walls down for the wall hangings (the walls themselves drop in their shaders).</summary>
    public void UpdateWalls(bool on, Vector3 camera) => _furniture.UpdateWalls(on, camera);

    /// <summary>On the cutaway's cut-away side (view.gdshaderinc cut_away)?</summary>
    static bool CutAway(Vector4 cut, Vector3 p) => cut.W > 0.5f && p.X * cut.X + p.Z * cut.Z > 0;

    Vector4 _cut;
    (float from, float to)? _sharp;

    /// <summary>A label's layers: the rig's label layer (drawn sharp, apart from the miniature blur) on the floor in view, the scene's elsewhere.</summary>
    uint LabelLayers(float y) => _sharp is var (from, to) && y >= from && y < to ? CameraRig.LabelLayer : 1u;

    /// <summary>
    /// The floor in view, as heights (null at the surface): its labels are drawn apart from the miniature blur
    /// (CameraRig). Others stay in the scene, blurred, where floors and walls in front still hide them.
    /// </summary>
    public void SetSharpFloor((float from, float to)? span)
    {
        if (span == _sharp) return;
        _sharp = span;
        if (_labels == null) return;
        foreach (var l in _labels.GetChildren().OfType<Label3D>())
        {
            l.Layers = LabelLayers(l.Position.Y);
            if (l.GetNodeOrNull<Label3D>("Badge") is Label3D b) b.Layers = l.Layers;
        }
    }

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

    /// <summary>How far lines come toward the camera, metres, so outlines on wall caps and floors show (three.js draws them over at equal depth).</summary>
    const float LineLift = 0.04f;

    static Material MaterialFor(JsonElement m)
    {
        var kind = m.GetProperty("kind").GetString();
        var color = new Color(m.GetProperty("color").GetString()!);
        var opacity = m.GetProperty("opacity").GetSingle();
        var transparent = m.GetProperty("transparent").GetBoolean();
        if (kind == "line")
        {
            var line = Plain.Make(new Color(color, opacity), transparent: transparent, unshaded: true);
            line.SetShaderParameter("toward_camera", LineLift);
            return line;
        }
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
        // Walls down: each vertex's wall tag (CUSTOM0), a line's second wall (CUSTOM1), and where their faces stand (CUSTOM2, CUSTOM3), zeros where none.
        var flags = (Mesh.ArrayFormat)0;
        // An outline's room (id + 1) rides in CUSTOM1.z, for the edge shader to tint by its trouble or the hover.
        var walled = c.TryGetProperty("walls", out var we) & c.TryGetProperty("walls2", out var we2) & c.TryGetProperty("faces", out var wf);
        var roomed = c.TryGetProperty("rooms", out var re);
        if (walled || roomed)
        {
            var w = walled ? Floats(we) : null;
            var w2 = walled ? Floats(we2) : null;
            var wfa = walled ? Floats(wf) : null;
            var r = roomed ? Floats(re) : null;
            var wall = new float[count * 4];
            var wall2 = new float[count * 4];
            var face = new float[count * 4];
            var face2 = new float[count * 4];
            for (var i = 0; i < count; i++)
            {
                var k = order[i];
                if (w != null && w2 != null)
                {
                    for (var j = 0; j < 4; j++) wall[i * 4 + j] = w[k * 4 + j];
                    wall2[i * 4] = w2[k * 2];
                    wall2[i * 4 + 1] = w2[k * 2 + 1];
                    for (var j = 0; j < 3; j++)
                    {
                        face[i * 4 + j] = wfa![k * 6 + j];
                        face2[i * 4 + j] = wfa[k * 6 + 3 + j];
                    }
                }
                if (r != null) wall2[i * 4 + 2] = r[k];
            }
            arrays[(int)Mesh.ArrayType.Custom0] = wall;
            arrays[(int)Mesh.ArrayType.Custom1] = wall2;
            arrays[(int)Mesh.ArrayType.Custom2] = face;
            arrays[(int)Mesh.ArrayType.Custom3] = face2;
            flags = (Mesh.ArrayFormat)((long)Mesh.ArrayCustomFormat.RgbaFloat << (int)Mesh.ArrayFormat.FormatCustom0Shift
                | (long)Mesh.ArrayCustomFormat.RgbaFloat << (int)Mesh.ArrayFormat.FormatCustom1Shift
                | (long)Mesh.ArrayCustomFormat.RgbaFloat << (int)Mesh.ArrayFormat.FormatCustom2Shift
                | (long)Mesh.ArrayCustomFormat.RgbaFloat << (int)Mesh.ArrayFormat.FormatCustom3Shift);
        }
        mesh.AddSurfaceFromArrays(lines ? Mesh.PrimitiveType.Lines : Mesh.PrimitiveType.Triangles, arrays, null, null, flags);
        if (flags != 0) mesh.SetMeta("walls", true);
        if (roomed) mesh.SetMeta("rooms", true);
        return mesh;
    }
}
