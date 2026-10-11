using System;
using System.Collections.Generic;
using Godot;

namespace DowntownMars;

/// <summary>
/// The hot drink in first person (T-139), as the web's (render3d/drink3d.ts): an arm low on the right holding
/// a mug of something dark and steaming, carried on the camera like a tool. It bobs as you walk. Grabbed at a
/// kitchenette or serving counter (Walker.DrinkHere), gone once you leave first person.
/// </summary>
public partial class Drink : Node3D
{
    /// <summary>Where it sits in the camera's frame (metres; the camera looks down −z), scaled down and held close so it never sinks into a wall, tipped toward you.</summary>
    static readonly Vector3 At = new(0.091f, -0.07f, -0.294f);
    const float Scale_ = 0.7f, Tip = 0.35f, BobUp = 0.012f, BobSide = 0.008f, Stride = 1.6f, Rise = 0.16f, PuffLife = 1.6f;
    const int Puffs = 6;
    static readonly Color Sleeve = new("#c8643c"), Cuff = new("#8a3f24"), Glove = new("#d9c7a8"), Mug = new("#efe6d6"), Band = new("#c8643c"), Coffee = new("#3b2416"), Steam = new("#f4efe8");

    // Lit by its own soft light from above left, not the scene's: the headlamp is right beside it and would burn it white.
    const string Shade = @"shader_type spatial;
render_mode unshaded;
uniform vec4 tint : source_color;
void fragment() {
    float l = clamp(dot(NORMAL, normalize(vec3(-0.35, 0.6, 0.7))), 0.0, 1.0);
    ALBEDO = tint.rgb * (0.55 + 0.5 * l);
}";

    readonly Node3D _hold = new();
    readonly List<(MeshInstance3D mesh, StandardMaterial3D mat, float sway)> _puffs = new();
    readonly float[] _age = new float[Puffs];
    float _stride;

    public bool Held
    {
        get => Visible;
        set => Visible = value;
    }

    public override void _Ready()
    {
        Visible = false;
        _hold.Position = At;
        _hold.Scale = Vector3.One * Scale_;
        _hold.Rotation = new Vector3(Tip, 0, 0);
        AddChild(_hold);
        var shader = new Shader { Code = Shade };
        MeshInstance3D Part(Mesh mesh, Color c, Vector3 at)
        {
            var mat = new ShaderMaterial { Shader = shader };
            mat.SetShaderParameter("tint", c);
            var m = new MeshInstance3D { Mesh = mesh, MaterialOverride = mat, Position = at, CastShadow = GeometryInstance3D.ShadowCastingSetting.Off };
            _hold.AddChild(m);
            return m;
        }
        // The arm comes up from below right, toward the far side, to the hand on the handle.
        var hand = new Vector3(0.066f, -0.004f, 0.008f);
        var arm = new Vector3(-0.4f, 0.6f, -0.7f).Normalized();
        var along = new Basis(new Quaternion(Vector3.Up, arm));
        Part(new CylinderMesh { TopRadius = 0.04f, BottomRadius = 0.05f, Height = 0.4f, RadialSegments = 12 }, Sleeve, hand - arm * 0.24f).Basis = along;
        Part(new CylinderMesh { TopRadius = 0.036f, BottomRadius = 0.036f, Height = 0.04f, RadialSegments = 12 }, Cuff, hand - arm * 0.045f).Basis = along;
        // The mug: cream, with a band of colour, a handle toward the hand, and dark coffee at the brim.
        Part(new CylinderMesh { TopRadius = 0.042f, BottomRadius = 0.038f, Height = 0.095f, RadialSegments = 18 }, Mug, Vector3.Zero);
        Part(new CylinderMesh { TopRadius = 0.0425f, BottomRadius = 0.0425f, Height = 0.014f, RadialSegments = 18, CapTop = false, CapBottom = false }, Band, new Vector3(0, -0.014f, 0));
        Part(new CylinderMesh { TopRadius = 0.036f, BottomRadius = 0.036f, Height = 0.004f, RadialSegments = 18 }, Coffee, new Vector3(0, 0.0485f, 0));
        Part(new TorusMesh { InnerRadius = 0.016f, OuterRadius = 0.032f, Rings = 14, RingSegments = 8 }, Mug, new Vector3(0.043f, 0.002f, 0)).Rotation = new Vector3(Mathf.Pi / 2, 0, 0);
        // Fingers round the handle.
        Part(new SphereMesh { Radius = 0.026f, Height = 0.052f, RadialSegments = 12, Rings = 8 }, Glove, hand).Scale = new Vector3(0.9f, 1.25f, 0.9f);
        // Steam: a few soft puffs rising off the top and fading.
        var puff = new SphereMesh { Radius = 0.008f, Height = 0.016f, RadialSegments = 10, Rings = 6 };
        for (var i = 0; i < Puffs; i++)
        {
            var mat = new StandardMaterial3D { ShadingMode = BaseMaterial3D.ShadingModeEnum.Unshaded, Transparency = BaseMaterial3D.TransparencyEnum.Alpha, AlbedoColor = new Color(Steam, 0) };
            var m = new MeshInstance3D { Mesh = puff, MaterialOverride = mat, CastShadow = GeometryInstance3D.ShadowCastingSetting.Off };
            _hold.AddChild(m);
            _puffs.Add((m, mat, i * 1.7f));
            _age[i] = (float)i / Puffs * PuffLife;
        }
    }

    /// <summary>Move the steam on, and bob by how far the walker went (metres) since the last step.</summary>
    public void Step(float dt, float walked)
    {
        if (!Held) return;
        _stride += walked;
        var phase = _stride / Stride * Mathf.Tau;
        Position = new Vector3(MathF.Cos(phase / 2) * BobSide, -MathF.Abs(MathF.Sin(phase / 2)) * BobUp, 0);
        for (var i = 0; i < _puffs.Count; i++)
        {
            var (mesh, mat, sway) = _puffs[i];
            _age[i] = (_age[i] + dt) % PuffLife;
            var t = _age[i] / PuffLife;
            mesh.Position = new Vector3(MathF.Sin(t * 5 + sway) * 0.012f, 0.05f + t * Rise, MathF.Cos(t * 4 + sway) * 0.008f);
            mesh.Scale = Vector3.One * (0.6f + t * 1.2f);
            mat.AlbedoColor = new Color(Steam, 0.16f * MathF.Sin(t * Mathf.Pi));
        }
    }
}
