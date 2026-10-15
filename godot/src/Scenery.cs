using System;
using System.Linq;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// What brings the hole to life without depending on rooms, as the web's (render3d/scenery3d.ts): the
/// Earth lander coming down onto the pad before a supply drop (or an event's landing), its flame
/// lighting the ground; the glass dome over the shaft once it's built; and dust motes drifting down
/// the open shaft. From above only, with no floor picked, as the web's.
/// </summary>
public partial class Scenery : Node3D
{
    const float StartHeight = 60, SurfaceRing = 16, FloorH = 4, Crust = 3, Gallery = 2;
    const int Motes = 260;
    const float Fall = 0.25f, MoteSize = 0.12f;

    readonly Node3D _lander = new() { Name = "Lander", Visible = false };
    readonly Node3D _flame = new() { Name = "Flame" };
    readonly OmniLight3D _flameLight = new() { LightColor = new Color("#ffb35c"), LightEnergy = 4, OmniRange = 30, ShadowEnabled = false };
    Node3D? _dome;
    string _domeKey = "";
    readonly MultiMesh _dust;
    readonly Vector3[] _motes = new Vector3[Motes];
    float _depth = 1;
    string _dustKey = "";
    float _descentTicks = 0.3f * 240;

    public Scenery()
    {
        AddChild(_lander);
        BuildLander();
        var dot = new QuadMesh { Size = Vector2.One, Material = DotMaterial() };
        _dust = new MultiMesh { TransformFormat = MultiMesh.TransformFormatEnum.Transform3D, Mesh = dot, InstanceCount = Motes };
        AddChild(new MultiMeshInstance3D { Multimesh = _dust, Name = "Dust", CastShadow = GeometryInstance3D.ShadowCastingSetting.Off, CustomAabb = new Aabb(new Vector3(-30, -1000, -30), new Vector3(60, 1010, 60)) });
        try
        {
            using var doc = JsonDocument.Parse(System.IO.File.ReadAllText(ProjectSettings.GlobalizePath("res://") + "../data/config.json"));
            _descentTicks = doc.RootElement.GetProperty("earth").GetProperty("descentDays").GetSingle() * doc.RootElement.GetProperty("ticksPerDay").GetSingle();
        }
        catch (Exception) { }
    }

    static Material DotMaterial()
    {
        var m = new ShaderMaterial { Shader = new Shader { Code = @"
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;
#include ""res://shaders/view.gdshaderinc""
varying vec3 centre;
void vertex() {
    float s = length(MODEL_MATRIX[0].xyz);
    centre = MODEL_MATRIX[3].xyz;
    MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0] * s, INV_VIEW_MATRIX[1] * s, INV_VIEW_MATRIX[2] * s, MODEL_MATRIX[3]);
}
void fragment() {
    if (cut_away(centre)) discard;
    float a = (1.0 - smoothstep(0.2, 1.0, length(UV - 0.5) * 2.0)) * 0.55;
    if (a < 0.01) discard;
    ALBEDO = vec3(1.0, 0.886, 0.753);
    ALPHA = a;
}" } };
        return m;
    }

    /// <summary>The lander's sizes, as the web's LANDER_PARTS: the descent stage, the cargo pods' height, how far out the feet stand.</summary>
    const float StageR = 2.4f, StageH = 1.5f, StageY = 2.3f, PodH = 1.6f, FootR = 3.7f;

    /// <summary>
    /// The supply lander, as the web's makeLander: a white octagonal descent stage with a hazard band, an engine
    /// bell and thruster quads, orange legs to footpads, four strapped cargo pods round a core, a beacon and dish,
    /// and the flame (an amber cone round a white-hot core). Its feet at y = 0.
    /// </summary>
    void BuildLander()
    {
        var hull = Plain.Make(new Color("#d9d4cc"), 0.5f, 0.3f);
        var dark = Plain.Make(new Color("#3e3b38"), 0.6f, 0.4f);
        var steel = Plain.Make(new Color("#d9862f"), 0.55f, 0.25f);
        var steelDark = Plain.Make(new Color("#a8641f"), 0.6f, 0.25f);
        var hazard = Plain.Make(new Color("#e0b030"), 0.7f);
        var beacon = Plain.Make(new Color("#ff4a30"), 0.6f, emission: new Color("#ff4a30"), emissionEnergy: 1.5f);
        MeshInstance3D Add(Mesh mesh, Vector3 at, float turn = 0)
        {
            var m = new MeshInstance3D { Mesh = mesh, Position = at, Rotation = new Vector3(0, turn, 0) };
            _lander.AddChild(m);
            return m;
        }
        CylinderMesh Cyl(float top, float bottom, float h, int sides, Material m, bool open = false) =>
            new() { TopRadius = top, BottomRadius = bottom, Height = h, RadialSegments = sides, Rings = 1, CapTop = !open, CapBottom = !open, Material = m };
        void Strut(Vector3 a, Vector3 b, float r, Material m)
        {
            var mesh = Add(Cyl(r, r, a.DistanceTo(b), 6, m), (a + b) / 2);
            mesh.Basis = new Basis(new Quaternion(Vector3.Up, (b - a).Normalized()));
        }
        static Vector3 Around(float r, float y, float a) => new(r * Mathf.Cos(a), y, r * Mathf.Sin(a));
        const float oct = Mathf.Tau / 16;

        // The descent stage: an octagon, dark rims, a hazard band round its middle.
        Add(Cyl(StageR, StageR, StageH, 8, hull), new Vector3(0, StageY, 0), oct);
        foreach (var dy in new[] { -1, 1 }) Add(Cyl(StageR + 0.05f, StageR + 0.05f, 0.16f, 8, dark), new Vector3(0, StageY + dy * StageH / 2, 0), oct);
        Add(Cyl(StageR + 0.03f, StageR + 0.03f, 0.3f, 8, hazard, open: true), new Vector3(0, StageY, 0), oct);
        // The engine bell, and a thruster quad at four corners.
        Add(Cyl(0.45f, 1.1f, 1.3f, 16, dark, open: true), new Vector3(0, StageY - StageH / 2 - 0.6f, 0));
        for (var k = 0; k < 4; k++) Add(new BoxMesh { Size = Vector3.One * 0.4f, Material = dark }, Around(StageR + 0.15f, StageY + 0.2f, k / 4f * Mathf.Tau));
        // Landing legs: a main leg and a brace down to each footpad.
        for (var k = 0; k < 4; k++)
        {
            var a = k / 4f * Mathf.Tau + Mathf.Pi / 4;
            var foot = Around(FootR, 0.25f, a);
            Strut(Around(StageR - 0.2f, StageY + 0.5f, a), foot, 0.13f, steel);
            Strut(Around(StageR - 0.3f, StageY - StageH / 2, a), foot, 0.08f, steelDark);
            Add(Cyl(0.5f, 0.6f, 0.18f, 12, dark), new Vector3(foot.X, 0.09f, foot.Z));
        }
        // The cargo: four pods strapped round a central core.
        var deck = StageY + StageH / 2;
        for (var k = 0; k < 4; k++)
        {
            var a = k / 4f * Mathf.Tau + Mathf.Pi / 4;
            var at = Around(1.25f, 0, a);
            Add(new BoxMesh { Size = new Vector3(1.3f, PodH, 1.3f), Material = hull }, at with { Y = deck + PodH / 2 }, -a);
            foreach (var dy in new[] { 0.35f, PodH - 0.35f }) Add(new BoxMesh { Size = new Vector3(1.34f, 0.12f, 1.34f), Material = steel }, at with { Y = deck + dy }, -a);
        }
        Add(Cyl(0.7f, 0.8f, PodH + 0.6f, 12, hull), new Vector3(0, deck + (PodH + 0.6f) / 2, 0));
        var crown = deck + PodH + 0.6f;
        Add(Cyl(0.2f, 0.7f, 0.7f, 12, hull), new Vector3(0, crown + 0.35f, 0));
        Add(new SphereMesh { Radius = 0.18f, Height = 0.36f, RadialSegments = 10, Rings = 6, Material = beacon }, new Vector3(0, crown + 0.85f, 0));
        Add(Cyl(0.5f, 0.08f, 0.2f, 14, steelDark, open: true), new Vector3(0.9f, crown - 0.1f, 0.9f)).Rotation = new Vector3(0.5f, 0, -0.5f);
        // The flame: an amber cone round a white-hot core, pointing down.
        _flame.Position = new Vector3(0, StageY - StageH / 2 - 1.25f, 0);
        var outer = Plain.Make(new Color("#ffb35c") with { A = 0.7f }, transparent: true, unshaded: true, emission: new Color("#ffb35c"), emissionEnergy: 3);
        var core = Plain.Make(new Color("#fff1c8"), unshaded: true, emission: new Color("#fff1c8"), emissionEnergy: 4);
        _flame.AddChild(new MeshInstance3D { Mesh = Cyl(1.2f, 0, 4.5f, 14, outer, open: true), Position = new Vector3(0, -2.25f, 0), CastShadow = GeometryInstance3D.ShadowCastingSetting.Off });
        _flame.AddChild(new MeshInstance3D { Mesh = Cyl(0.6f, 0, 2.6f, 12, core), Position = new Vector3(0, -1.3f, 0), CastShadow = GeometryInstance3D.ShadowCastingSetting.Off });
        _lander.AddChild(_flame);
        _flame.AddChild(_flameLight);
        _flameLight.Position = new Vector3(0, -2, 0);
    }

    /// <summary>
    /// From the snapshot: where the lander is (as the web's stage: down over the descent before a drop
    /// when the pad's ready, or after an event's landing, then a few hours on the pad), the dome, the dust.
    /// </summary>
    public void Update(JsonElement s, HoleShape hole, bool fromAbove)
    {
        var tick = s.GetProperty("tick").GetInt32();
        var e = s.GetProperty("earth");
        var landing = e.GetProperty("padReady").GetBoolean() && !e.GetProperty("waiting").GetBoolean() && e.GetProperty("ticksToDrop").GetSingle() <= _descentTicks;
        var landingTick = s.GetProperty("events").GetProperty("landingTick");
        var since = landingTick.ValueKind == JsonValueKind.Number ? tick - landingTick.GetInt32() : float.PositiveInfinity;
        float? eventT = since < _descentTicks + 240 / 4f ? Math.Min(1, since / _descentTicks) : null;
        float? t = landing ? 1 - e.GetProperty("ticksToDrop").GetSingle() / _descentTicks : eventT;
        if (_pad is float mid && t is float tt && fromAbove)
        {
            var r = hole.ShaftRadiusM + SurfaceRing;
            var ease = 1 - (1 - tt) * (1 - tt);
            _lander.Position = new Vector3(r * Mathf.Cos(mid), 0.5f + StartHeight * (1 - ease), r * Mathf.Sin(mid));
            _flame.Visible = tt < 0.97f;
            _lander.Visible = true;
        }
        else _lander.Visible = false;
        if (_dome != null) _dome.Visible = fromAbove;
        _dustShown = fromAbove;
    }

    /// <summary>From the layout: where the pad is, whether the shaft is domed, how deep the dust falls.</summary>
    public void SetLayout(JsonElement layout, HoleShape hole)
    {
        _pad = PadAngle(layout);
        Dome(layout.TryGetProperty("domed", out var d) && d.ValueKind == JsonValueKind.True, hole);
        SyncDust(hole);
    }

    float? _pad;
    bool _dustShown;

    /// <summary>The middle of the landing pad round the rim (radians), or null with no pad.</summary>
    static float? PadAngle(JsonElement layout)
    {
        var total = layout.GetProperty("surface").GetArrayLength();
        foreach (var room in layout.GetProperty("rooms").EnumerateArray())
        {
            if (room.GetProperty("type").GetString() != "landing_pad") continue;
            var cells = room.GetProperty("surfaceCells").EnumerateArray().Select(c => c.GetInt32()).ToArray();
            if (cells.Length == 0) return null;
            return (cells.Min() + cells.Length / 2f) / total * Mathf.Tau;
        }
        return null;
    }

    /// <summary>The glass dome over the shaft, as the web's makeDome: a flattened half-sphere on twelve ribs, a ring at its foot.</summary>
    void Dome(bool domed, HoleShape hole)
    {
        var key = domed ? $"{hole.ShaftRadiusM}" : "";
        if (key == _domeKey) return;
        _domeKey = key;
        _dome?.QueueFree();
        _dome = null;
        if (!domed) return;
        _dome = new Node3D { Name = "Dome", Position = new Vector3(0, 0.05f, 0) };
        var r = hole.ShaftRadiusM + 1.5f;
        var rise = r * 0.45f;
        var glass = new MeshInstance3D
        {
            Mesh = new SphereMesh { Radius = r, Height = 2 * r, IsHemisphere = true, RadialSegments = 48, Rings = 16, Material = Plain.Make(new Color("#a8d4f0") with { A = 0.18f }, 0.05f, 0.2f, transparent: true, specular: 0.8f) },
            Scale = new Vector3(1, rise / r, 1),
            CastShadow = GeometryInstance3D.ShadowCastingSetting.Off,
        };
        _dome.AddChild(glass);
        var metal = Plain.Make(new Color("#9aa4ab"), 0.4f, 0.6f);
        // Ribs: meridians from the foot over the crown, as tubes.
        var st = new SurfaceTool();
        st.Begin(Mesh.PrimitiveType.Triangles);
        for (var k = 0; k < 12; k++)
        {
            var turn = k / 12f * Mathf.Pi;
            Vector3 At(float u) => new Basis(Vector3.Up, turn) * new Vector3(r * Mathf.Cos(u), rise * Mathf.Sin(u), 0);
            const int steps = 32;
            for (var i = 0; i < steps; i++)
            {
                float u0 = Mathf.Pi * i / steps, u1 = Mathf.Pi * (i + 1) / steps;
                Vector3 a = At(u0), b = At(u1);
                var along = (b - a).Normalized();
                var side = along.Cross(new Basis(Vector3.Up, turn) * Vector3.Back).Normalized() * 0.12f;
                var up = new Basis(Vector3.Up, turn) * Vector3.Back * 0.12f;
                foreach (var (o0, o1) in new[] { (side, up), (up, -side), (-side, -up), (-up, side) })
                {
                    st.AddVertex(a + o0); st.AddVertex(b + o0); st.AddVertex(b + o1);
                    st.AddVertex(a + o0); st.AddVertex(b + o1); st.AddVertex(a + o1);
                }
            }
        }
        st.GenerateNormals();
        _dome.AddChild(new MeshInstance3D { Mesh = st.Commit(), MaterialOverride = metal });
        _dome.AddChild(new MeshInstance3D { Mesh = new TorusMesh { InnerRadius = r - 0.35f, OuterRadius = r + 0.35f, Rings = 64, RingSegments = 8, Material = metal }, Position = new Vector3(0, 0.2f, 0) });
        AddChild(_dome);
    }

    /// <summary>The motes, scattered down the open shaft (again when it deepens or widens).</summary>
    void SyncDust(HoleShape hole)
    {
        var key = $"{hole.Floors}:{hole.ShaftRadiusM}";
        if (key == _dustKey) return;
        _dustKey = key;
        _depth = (hole.Floors + 1) * FloorH + Crust;
        var radius = hole.ShaftRadiusM - Gallery - 0.3f;
        var s = (uint)(hole.Floors * 7919) | 1;
        float Rand() => (s = s * 1664525 + 1013904223) / 4294967296f;
        for (var i = 0; i < Motes; i++)
        {
            var a = Rand() * Mathf.Tau;
            var r = Mathf.Sqrt(Rand()) * radius;
            _motes[i] = new Vector3(r * Mathf.Cos(a), -Rand() * _depth, r * Mathf.Sin(a));
        }
    }

    /// <summary>Motes fall, and start again at the top.</summary>
    public void Step(float dt)
    {
        _dust.VisibleInstanceCount = _dustShown ? Motes : 0;
        if (!_dustShown) return;
        for (var i = 0; i < Motes; i++)
        {
            var y = _motes[i].Y - Fall * dt;
            if (y < -_depth) y += _depth;
            _motes[i].Y = y;
            _dust.SetInstanceTransform(i, new Transform3D(Basis.FromScale(Vector3.One * MoteSize), _motes[i]));
        }
    }
}
