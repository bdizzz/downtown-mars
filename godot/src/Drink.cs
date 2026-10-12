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
    /// <summary>Where it sits in the camera's frame (metres; the camera looks down −z), scaled down and held close so it never sinks into a wall.</summary>
    static readonly Vector3 At = new(0.091f, -0.07f, -0.294f);
    const float Scale_ = 0.7f, BobUp = 0.012f, BobSide = 0.008f, Stride = 1.6f, Rise = 0.16f, PuffLife = 1.6f;
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
    /// <summary>The mug turns against the head's tilt, so its top stays level with the floor and nothing spills.</summary>
    readonly Node3D _mug = new();
    MeshInstance3D _sleeve = null!, _cuff = null!;
    static readonly Vector3 Grip = new(0.066f, -0.004f, 0.008f);
    static readonly Vector3 Shoulder = Grip - new Vector3(-0.4f, 0.6f, -0.7f).Normalized() * 0.44f;
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
        AddChild(_hold);
        _hold.AddChild(_mug);
        var shader = new Shader { Code = Shade };
        MeshInstance3D Part(Node3D on, Mesh mesh, Color c, Vector3 at)
        {
            var mat = new ShaderMaterial { Shader = shader };
            mat.SetShaderParameter("tint", c);
            var m = new MeshInstance3D { Mesh = mesh, MaterialOverride = mat, Position = at, CastShadow = GeometryInstance3D.ShadowCastingSetting.Off };
            on.AddChild(m);
            return m;
        }
        // The mug: cream, with a band of colour, a handle toward the hand, and dark coffee at the brim.
        Part(_mug, new CylinderMesh { TopRadius = 0.042f, BottomRadius = 0.038f, Height = 0.095f, RadialSegments = 18 }, Mug, Vector3.Zero);
        Part(_mug, new CylinderMesh { TopRadius = 0.0425f, BottomRadius = 0.0425f, Height = 0.014f, RadialSegments = 18, CapTop = false, CapBottom = false }, Band, new Vector3(0, -0.014f, 0));
        Part(_mug, new CylinderMesh { TopRadius = 0.036f, BottomRadius = 0.036f, Height = 0.004f, RadialSegments = 18 }, Coffee, new Vector3(0, 0.0485f, 0));
        Part(_mug, new TorusMesh { InnerRadius = 0.016f, OuterRadius = 0.032f, Rings = 14, RingSegments = 8 }, Mug, new Vector3(0.043f, 0.002f, 0)).Rotation = new Vector3(Mathf.Pi / 2, 0, 0);
        // Fingers round the handle: they turn with the mug.
        Part(_mug, new SphereMesh { Radius = 0.026f, Height = 0.052f, RadialSegments = 12, Rings = 8 }, Glove, Grip).Scale = new Vector3(0.9f, 1.25f, 0.9f);
        // The arm comes up from a shoulder below right to wherever the hand is, its wrist bending to keep the mug level.
        _sleeve = Part(_hold, new CylinderMesh { TopRadius = 0.04f, BottomRadius = 0.05f, Height = 1, RadialSegments = 12 }, Sleeve, Vector3.Zero);
        _cuff = Part(_hold, new CylinderMesh { TopRadius = 0.036f, BottomRadius = 0.036f, Height = 0.04f, RadialSegments = 12 }, Cuff, Vector3.Zero);
        BendArm();
        // Steam: a few soft puffs rising off the top and fading.
        var puff = new SphereMesh { Radius = 0.008f, Height = 0.016f, RadialSegments = 10, Rings = 6 };
        for (var i = 0; i < Puffs; i++)
        {
            var mat = new StandardMaterial3D { ShadingMode = BaseMaterial3D.ShadingModeEnum.Unshaded, Transparency = BaseMaterial3D.TransparencyEnum.Alpha, AlbedoColor = new Color(Steam, 0) };
            var m = new MeshInstance3D { Mesh = puff, MaterialOverride = mat, CastShadow = GeometryInstance3D.ShadowCastingSetting.Off };
            _mug.AddChild(m);
            _puffs.Add((m, mat, i * 1.7f));
            _age[i] = (float)i / Puffs * PuffLife;
        }
    }

    /// <summary>The sleeve from the shoulder to the hand, wherever the mug's turn has put it.</summary>
    void BendArm()
    {
        var hand = _mug.Transform * Grip;
        var along = hand - Shoulder;
        var length = along.Length();
        along /= length;
        var basis = new Basis(new Quaternion(Vector3.Up, along));
        // The sleeve stops short of the hand, where the cuff is.
        _sleeve.Transform = new Transform3D(basis * Basis.FromScale(new Vector3(1, length - 0.04f, 1)), Shoulder + along * (length - 0.04f) / 2);
        _cuff.Transform = new Transform3D(basis, hand - along * 0.045f);
    }

    /// <summary>Move the steam on, bob by how far the walker went (metres) since the last step, and keep the mug level as the head tilts (`pitch`, radians, up positive).</summary>
    public void Step(float dt, float walked, float pitch)
    {
        if (!Held) return;
        _mug.Rotation = new Vector3(-pitch, 0, 0);
        BendArm();
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
