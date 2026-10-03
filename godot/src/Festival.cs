using System;
using Godot;

namespace DowntownMars;

/// <summary>
/// A festival in the shaft, as the web's (render3d/festival3d.ts): strings of coloured lights looped
/// along every floor's gallery (from a picked floor down), sagging between hangers, and paper lanterns
/// drifting up the middle of the shaft to the rim, swaying, glowing. Unlike the web's, a few of the
/// lanterns carry real light up the shaft. Shown only while a festival is on.
/// </summary>
public partial class Festival : Node3D
{
    const float FloorH = 4, Crust = 3, Gallery = 2;
    const float PerMetre = 1.2f, Size = 0.09f, Sag = 0.35f, Span = 3, Below = 0.7f;
    const int Lanterns = 90, Lit = 6;
    const float Rise = 0.9f, LanternSize = 0.55f, Sway = 0.4f;
    static readonly Color[] Colors = { new("#ffb35c"), new("#f2c84b"), new("#ff7a5c"), new("#8fd0ff"), new("#b8f28f") };

    readonly MultiMeshInstance3D _lights = new() { CastShadow = GeometryInstance3D.ShadowCastingSetting.Off };
    readonly MeshInstance3D _string = new() { CastShadow = GeometryInstance3D.ShadowCastingSetting.Off };
    readonly MultiMesh _lanterns;
    readonly Vector3[] _pos = new Vector3[Lanterns];
    readonly float[] _phase = new float[Lanterns];
    readonly OmniLight3D[] _glow = new OmniLight3D[Lit];
    readonly ShaderMaterial _lanternMaterial;
    string _key = "";
    float _depth = 1, _t;

    public Festival()
    {
        AddChild(_lights);
        AddChild(_string);
        _lanternMaterial = new ShaderMaterial { Shader = new Shader { Code = LanternShader } };
        _lanterns = new MultiMesh { TransformFormat = MultiMesh.TransformFormatEnum.Transform3D, Mesh = new QuadMesh { Size = Vector2.One, Material = _lanternMaterial }, InstanceCount = Lanterns };
        AddChild(new MultiMeshInstance3D { Multimesh = _lanterns, CastShadow = GeometryInstance3D.ShadowCastingSetting.Off, CustomAabb = new Aabb(new Vector3(-50, -1000, -50), new Vector3(100, 1010, 100)) });
        for (var i = 0; i < Lit; i++)
        {
            _glow[i] = new OmniLight3D { LightColor = new Color("#ffa64d"), LightEnergy = 1.2f, OmniRange = 7, ShadowEnabled = false, LightVolumetricFogEnergy = 1.5f };
            AddChild(_glow[i]);
        }
        Visible = false;
    }

    /// <summary>On or off, and built for this hole from the picked floor down.</summary>
    public void Sync(bool on, HoleShape hole, int? topFloor)
    {
        Visible = on;
        if (!on) return;
        var key = $"{hole.ShaftRadiusM}:{hole.Floors}:{topFloor}";
        if (key == _key) return;
        _key = key;
        var r = hole.ShaftRadiusM - Gallery - 0.15f;
        var count = Math.Max(1, Mathf.RoundToInt(Mathf.Tau * r * PerMetre));
        var spans = Math.Max(3, Mathf.RoundToInt(Mathf.Tau * r / Span));
        var first = topFloor ?? 1;
        var floors = Math.Max(0, hole.Floors - first + 1);
        var mm = new MultiMesh { TransformFormat = MultiMesh.TransformFormatEnum.Transform3D, UseColors = true, Mesh = new SphereMesh { Radius = Size, Height = Size * 2, RadialSegments = 8, Rings = 4 }, InstanceCount = count * floors };
        ((SphereMesh)mm.Mesh).Material = Plain.Make(new Color(1, 1, 1), unshaded: true, vertexColors: true);
        var im = new ImmediateMesh();
        im.SurfaceBegin(Mesh.PrimitiveType.Lines);
        var i = 0;
        for (var f = first; f <= hole.Floors; f++)
        {
            var top = (1 - f) * FloorH - Crust - Below;
            // Hung at each hanger, sagging between.
            float Y(float a) => top - Sag * MathF.Sin(MathF.PI * (a / Mathf.Tau * spans % 1));
            for (var k = 0; k < count; k++)
            {
                var a = k / (float)count * Mathf.Tau;
                mm.SetInstanceTransform(i, new Transform3D(Basis.Identity, new Vector3(r * MathF.Cos(a), Y(a) - 0.06f, r * MathF.Sin(a))));
                // A little brighter than white allows, so the glow picks them up.
                mm.SetInstanceColor(i, Colors[k % Colors.Length] * 1.6f);
                i++;
            }
            var steps = spans * 8;
            for (var k = 0; k < steps; k++)
            {
                float a0 = k / (float)steps * Mathf.Tau, a1 = (k + 1) / (float)steps * Mathf.Tau;
                im.SurfaceAddVertex(new Vector3(r * MathF.Cos(a0), Y(a0), r * MathF.Sin(a0)));
                im.SurfaceAddVertex(new Vector3(r * MathF.Cos(a1), Y(a1), r * MathF.Sin(a1)));
            }
        }
        if (count * floors > 0) im.SurfaceEnd();
        _lights.Multimesh = mm;
        _string.Mesh = count * floors > 0 ? im : null;
        _string.MaterialOverride = Plain.Make(new Color("#3a2a22"), unshaded: true);

        // Lanterns: scattered up the shaft from the bottom of the dug floors to the rim.
        _depth = Math.Max(1, hole.Floors) * FloorH + Crust;
        var radius = hole.ShaftRadiusM - Gallery - 1;
        for (var k = 0; k < Lanterns; k++)
        {
            var a = k * 2.399963f % Mathf.Tau;
            var rr = MathF.Sqrt(k * 0.618034f % 1 * 0.9f + 0.05f) * radius;
            _pos[k] = new Vector3(rr * MathF.Cos(a), -(k * 0.37f % 1) * _depth, rr * MathF.Sin(a));
            _phase[k] = k * 1.7f % Mathf.Tau;
        }
    }

    /// <summary>Lanterns rise and sway; at the rim they start again at the bottom. They flicker a little.</summary>
    public void Step(float dt)
    {
        if (!Visible) return;
        _t += dt;
        for (var k = 0; k < Lanterns; k++)
        {
            var y = _pos[k].Y + Rise * dt * (0.7f + 0.6f * (k * 0.31f % 1));
            if (y > 2) y -= _depth + 2;
            _pos[k] = new Vector3(_pos[k].X + MathF.Sin(_t * 0.6f + _phase[k]) * Sway * dt, y, _pos[k].Z);
            _lanterns.SetInstanceTransform(k, new Transform3D(Basis.FromScale(Vector3.One * LanternSize), _pos[k]));
        }
        _lanternMaterial.SetShaderParameter("opacity", 0.75f + 0.15f * MathF.Sin(_t * 3));
        // Every fifteenth lantern lights the shaft round it.
        for (var i = 0; i < Lit; i++) _glow[i].Position = _pos[i * (Lanterns / Lit)];
    }

    const string LanternShader = @"
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled;
#include ""res://shaders/view.gdshaderinc""
uniform float opacity = 0.9;
varying vec3 centre;
void vertex() {
    float s = length(MODEL_MATRIX[0].xyz);
    centre = MODEL_MATRIX[3].xyz;
    MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0] * s, INV_VIEW_MATRIX[1] * s, INV_VIEW_MATRIX[2] * s, MODEL_MATRIX[3]);
}
void fragment() {
    if (cut_away(centre)) discard;
    float r = length(UV - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.2, 1.0, r)) * opacity;
    if (a < 0.01) discard;
    ALBEDO = vec3(1.0, 0.65, 0.3) * 1.6;
    ALPHA = a;
}
";
}
