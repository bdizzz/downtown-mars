using System;
using System.Collections.Generic;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// Sparks spitting from a smelter's furnace mouth and steam rising off life support's scrubber vents,
/// as the web's (render3d/effects3d.ts): from the emitters the bridge sends (where each furnace and
/// scrubber stands, and how hard its room is running), a pool of particles per kind moved here with the
/// web's motion, drawn as camera-facing dots in one MultiMesh each. Sparks glow and fall; steam rises,
/// swells in and thins away. Nothing from floors hidden above a picked one.
/// </summary>
public partial class RoomEffects : Node3D
{
    enum Kind { Sparks, Steam }

    record struct Look(int Pool, float Rate, float LifeMin, float LifeMax, float Size0, float Size1, float Alpha, Color Color, bool Additive);

    static readonly Look[] Looks =
    {
        new(500, 32, 0.5f, 1.2f, 0.16f, 0.07f, 1, new Color("#ffa040"), true),
        new(300, 3, 2.2f, 3.6f, 0.35f, 1.5f, 0.28f, new Color("#f2ece4"), false),
    };
    const float SparkOut = 2.2f, SparkUp = 2.2f, SparkSpread = 1.2f, Gravity = 5, SteamRise = 0.55f, SteamDrift = 0.12f;

    class Emitter
    {
        public Kind Kind;
        public Vector3 At;
        public float Fx, Fz, Rate, Owed;
        public int Floor;
    }

    class Pool
    {
        public readonly Vector3[] Pos, Vel;
        public readonly float[] Age, Life;
        public readonly int[] Floor;
        public int Next;
        public readonly MultiMesh Mesh;

        public Pool(int n, Material material)
        {
            Pos = new Vector3[n];
            Vel = new Vector3[n];
            Age = new float[n];
            Life = new float[n];
            Floor = new int[n];
            Array.Fill(Age, 1);
            Array.Fill(Life, 1);
            Mesh = new MultiMesh { TransformFormat = MultiMesh.TransformFormatEnum.Transform3D, UseCustomData = true, Mesh = new QuadMesh { Size = Vector2.One, Material = material }, InstanceCount = n, VisibleInstanceCount = 0 };
        }
    }

    readonly Pool[] _pools;
    List<Emitter> _emitters = new();
    int? _topFloor;
    readonly Random _rand = new(7);

    public RoomEffects()
    {
        _pools = new Pool[Looks.Length];
        for (var k = 0; k < Looks.Length; k++)
        {
            var mat = new ShaderMaterial { Shader = new Shader { Code = Looks[k].Additive ? Code("blend_add") : Code("blend_mix") } };
            mat.SetShaderParameter("color", Looks[k].Color);
            _pools[k] = new Pool(Looks[k].Pool, mat);
            AddChild(new MultiMeshInstance3D
            {
                Multimesh = _pools[k].Mesh,
                CastShadow = GeometryInstance3D.ShadowCastingSetting.Off,
                CustomAabb = new Aabb(new Vector3(-500, -1000, -500), new Vector3(1000, 1100, 1000)),
            });
        }
    }

    /// <summary>The bridge's emitters; particles from spots that are gone go with them.</summary>
    public void Set(JsonElement m)
    {
        var list = new List<Emitter>();
        foreach (var e in m.GetProperty("emitters").EnumerateArray())
            list.Add(new Emitter
            {
                Kind = e.GetProperty("kind").GetString() == "sparks" ? Kind.Sparks : Kind.Steam,
                At = new Vector3(e.GetProperty("x").GetSingle(), e.GetProperty("y").GetSingle(), e.GetProperty("z").GetSingle()),
                Fx = e.GetProperty("fx").GetSingle(),
                Fz = e.GetProperty("fz").GetSingle(),
                Rate = e.GetProperty("rate").GetSingle(),
                Floor = e.GetProperty("floor").GetInt32(),
            });
        _emitters = list;
    }

    public void SetTopFloor(int? floor)
    {
        _topFloor = floor;
        // What's above a picked floor goes at once.
        foreach (var p in _pools)
            for (var i = 0; i < p.Age.Length; i++)
                if (floor != null && p.Floor[i] < floor) p.Age[i] = p.Life[i];
    }

    float R() => (float)_rand.NextDouble() - 0.5f;
    float U() => (float)_rand.NextDouble();

    void Spawn(Emitter e)
    {
        var k = (int)e.Kind;
        var p = _pools[k];
        var look = Looks[k];
        var i = p.Next;
        p.Next = (p.Next + 1) % p.Age.Length;
        p.Pos[i] = e.At + new Vector3(R() * 0.5f, R() * 0.2f, R() * 0.5f);
        if (e.Kind == Kind.Sparks)
        {
            // Out of the furnace's front, up, and spread sideways.
            var outward = SparkOut * (0.6f + U() * 0.8f);
            var side = R() * SparkSpread;
            p.Vel[i] = new Vector3(e.Fx * outward - e.Fz * side, SparkUp * (0.4f + U()), e.Fz * outward + e.Fx * side);
        }
        else p.Vel[i] = new Vector3(R() * SteamDrift, SteamRise * (0.7f + U() * 0.6f), R() * SteamDrift);
        p.Age[i] = 0;
        p.Life[i] = look.LifeMin + U() * (look.LifeMax - look.LifeMin);
        p.Floor[i] = e.Floor;
    }

    /// <summary>On by dt (game) seconds: emit as each room runs, move, age, and draw what's alive.</summary>
    public void Step(float dt)
    {
        if (dt > 0)
            foreach (var e in _emitters)
            {
                if (_topFloor != null && e.Floor < _topFloor) continue;
                e.Owed += Looks[(int)e.Kind].Rate * e.Rate * dt;
                while (e.Owed >= 1)
                {
                    Spawn(e);
                    e.Owed -= 1;
                }
            }
        for (var k = 0; k < _pools.Length; k++)
        {
            var p = _pools[k];
            var look = Looks[k];
            var shown = 0;
            for (var i = 0; i < p.Age.Length; i++)
            {
                if (p.Age[i] >= p.Life[i]) continue;
                p.Age[i] += dt;
                var t = p.Age[i] / p.Life[i];
                if (t >= 1) continue;
                if (k == (int)Kind.Sparks) p.Vel[i].Y -= Gravity * dt;
                p.Pos[i] += p.Vel[i] * dt;
                var size = look.Size0 + (look.Size1 - look.Size0) * t;
                // Sparks burn out; steam swells in, then thins away.
                var alpha = look.Alpha * (k == (int)Kind.Sparks ? 1 - t * t : Math.Min(1, t * 5) * (1 - t));
                p.Mesh.SetInstanceTransform(shown, new Transform3D(Basis.FromScale(new Vector3(size, size, size)), p.Pos[i]));
                p.Mesh.SetInstanceCustomData(shown, new Color(1, 1, 1, alpha));
                shown++;
            }
            p.Mesh.VisibleInstanceCount = shown;
        }
    }

    /// <summary>A soft round dot facing the camera, in the kind's colour, its alpha per particle.</summary>
    static string Code(string blend) => $@"
shader_type spatial;
render_mode unshaded, {blend}, depth_draw_never, cull_disabled, shadows_disabled;
#include ""res://shaders/view.gdshaderinc""
uniform vec3 color : source_color;
varying float alpha;
varying vec3 centre;
void vertex() {{
    alpha = INSTANCE_CUSTOM.a;
    float s = length(MODEL_MATRIX[0].xyz);
    centre = MODEL_MATRIX[3].xyz;
    MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0] * s, INV_VIEW_MATRIX[1] * s, INV_VIEW_MATRIX[2] * s, MODEL_MATRIX[3]);
}}
void fragment() {{
    if (cut_away(centre)) discard;
    float r = length(UV - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.2, 1.0, r)) * alpha;
    if (a < 0.01) discard;
    ALBEDO = color;
    ALPHA = a;
}}
";
}
