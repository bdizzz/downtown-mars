using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// Colonists as little figures, as the web game's (src/render3d/people3d.ts): legs, a body in their
/// clothes' colour and a head. Who's sitting, working or asleep where comes from the bridge (by the
/// hour and each room's staff); walkers stroll the gallery tubes, bobbing as they go, animated here.
/// Purely cosmetic. Three MultiMeshes: standing (and lying), sitting, heads.
/// </summary>
public partial class People : Node3D
{
    // As people3d.ts FIGURE.
    const int MaxWalkers = 60, PerColonists = 3, InRooms = 600;
    const float WalkSpeed = 0.35f, Bob = 0.045f, Stride = 7, Sway = 0.06f;
    static readonly uint[] Clothes = { 0xd8c0ae, 0x6f93bd, 0x86ad58, 0xc9a456, 0xd48092, 0x9b8fc4, 0x7fb8b0, 0xc47a5a };
    static readonly uint[] Skin = { 0xf1c9a5, 0xd9a47c, 0xb57a52, 0x8a5634, 0x5e3a22, 0xe8b894 };
    const uint Trousers = 0x3a3a44;
    static readonly Vector3 HeadStand = new(0, 1.52f, 0), HeadSit = new(0, 0.78f, -0.04f);
    const float HeadRadius = 0.12f, BedFeet = 0.85f;
    /// <summary>Lying: the standing figure turned so its up runs along -x and its front faces up.</summary>
    static readonly Basis Lying = new(new Vector3(0, 0, -1), new Vector3(-1, 0, 0), new Vector3(0, 1, 0));

    readonly MultiMesh _stand, _sit, _heads;

    struct Walker
    {
        public int Floor;
        public float Angle, A0, A1, Speed, Offset, Phase;
        public bool Full;
        public Color Clothes, Skin;
    }

    readonly List<Walker> _walkers = new();
    List<(int kind, Vector3 at, float turn, int floor, Color clothes, Color skin)> _seated = new();
    HoleShape _hole = new();
    int? _topFloor;
    double _time;
    string _walkKey = "";

    public People()
    {
        var shader = new Shader { Code = ShaderCode };
        var body = new ShaderMaterial { Shader = shader };
        body.SetShaderParameter("roughness", 0.85f);
        var head = new ShaderMaterial { Shader = shader };
        head.SetShaderParameter("roughness", 0.7f);
        head.SetShaderParameter("instance_only", true);
        _stand = Batch(Figure(StandingBoxes), body);
        _sit = Batch(Figure(SittingBoxes), body);
        _heads = Batch(new SphereMesh { Radius = HeadRadius, Height = HeadRadius * 2, RadialSegments = 10, Rings = 6 }, head);
        foreach (var (mm, name) in new[] { (_stand, "Standing"), (_sit, "Sitting"), (_heads, "Heads") })
            AddChild(new MultiMeshInstance3D { Multimesh = mm, Name = name, CustomAabb = new Aabb(new Vector3(-2000, -2000, -2000), new Vector3(4000, 4000, 4000)) });
    }

    static MultiMesh Batch(Mesh mesh, Material material)
    {
        if (mesh is PrimitiveMesh p) p.Material = material;
        else mesh.SurfaceSetMaterial(0, material);
        return new MultiMesh { TransformFormat = MultiMesh.TransformFormatEnum.Transform3D, UseCustomData = true, Mesh = mesh, InstanceCount = MaxWalkers + InRooms, VisibleInstanceCount = 0 };
    }

    public void SetHole(HoleShape hole) => _hole = hole;

    public void SetTopFloor(int? floor) => _topFloor = floor;

    /// <summary>The bridge's people message: { seated: [kind, x, y, z, turn, floor, clothes, skin], tubes, population }.</summary>
    public void Set(JsonElement msg)
    {
        _seated = msg.GetProperty("seated").EnumerateArray().Select(e =>
        {
            var v = e.EnumerateArray().Select(x => x.GetDouble()).ToArray();
            return ((int)v[0], new Vector3((float)v[1], (float)v[2], (float)v[3]), (float)v[4], (int)v[5], Hex((uint)v[6]), Hex((uint)v[7]));
        }).Take(InRooms).ToList();
        var population = msg.GetProperty("population").GetInt32();
        var runs = msg.GetProperty("tubes").EnumerateArray().Select(t => (floor: t.GetProperty("floor").GetInt32(), t0: t.GetProperty("t0").GetSingle(), t1: t.GetProperty("t1").GetSingle(), full: t.GetProperty("full").GetBoolean())).ToList();
        SyncWalkers(population, runs);
    }

    static Color Hex(uint rgb) => new Color((rgb << 8) | 0xff).SrgbToLinear();

    float Open => _hole.ShaftRadiusM - 2;

    /// <summary>The gallery crowd for the colony: more people, more walkers, spread over the tube runs, longer runs getting more.</summary>
    void SyncWalkers(int population, List<(int floor, float t0, float t1, bool full)> runs)
    {
        var usable = runs.Where(r => (r.t1 - r.t0) * Mathf.Tau * Open >= 4).ToList();
        var want = usable.Count > 0 ? Math.Min(MaxWalkers, (population + PerColonists - 1) / PerColonists) : 0;
        var key = $"{want}:{string.Join(";", usable)}";
        if (key == _walkKey) return;
        _walkKey = key;
        var rng = new RandomNumberGenerator { Seed = (ulong)(population * 131 + _hole.Floors) };
        var total = usable.Sum(r => r.t1 - r.t0);
        _walkers.Clear();
        for (var i = 0; i < want; i++)
        {
            var x = rng.Randf() * total;
            var run = usable[^1];
            foreach (var r in usable) if ((x -= r.t1 - r.t0) <= 0) { run = r; break; }
            float a0 = run.t0 * Mathf.Tau, a1 = run.t1 * Mathf.Tau;
            _walkers.Add(new Walker
            {
                Floor = run.floor,
                Angle = a0 + rng.Randf() * (a1 - a0),
                A0 = a0,
                A1 = a1,
                Full = run.full,
                Speed = (rng.Randf() < 0.5f ? -1 : 1) * WalkSpeed * (0.6f + rng.Randf() * 0.8f),
                Offset = rng.Randf() * 1.2f,
                Clothes = Hex(Clothes[rng.RandiRange(0, Clothes.Length - 1)]),
                Skin = Hex(Skin[rng.RandiRange(0, Skin.Length - 1)]),
                Phase = rng.Randf() * Mathf.Tau,
            });
        }
    }

    bool Shows(int floor) => _topFloor == null || floor >= _topFloor;

    /// <summary>Time spent placing figures last frame (ms), for the benchmark.</summary>
    public double LastMs { get; private set; }

    public override void _Process(double delta)
    {
        var watch = System.Diagnostics.Stopwatch.StartNew();
        _time += delta;
        var dt = (float)delta;
        int stand = 0, sit = 0, heads = 0;
        void Put(MultiMesh mm, ref int n, Transform3D t, Color clothes, Color skin, Vector3 headAt)
        {
            mm.SetInstanceTransform(n, t);
            mm.SetInstanceCustomData(n, clothes);
            n++;
            _heads.SetInstanceTransform(heads, new Transform3D(Basis.Identity, t * headAt));
            _heads.SetInstanceCustomData(heads, skin);
            heads++;
        }

        for (var i = 0; i < _walkers.Count; i++)
        {
            var w = _walkers[i];
            var r = Open + 0.4f + w.Offset * 0.9f;
            w.Angle += w.Speed * dt / Math.Max(1, r);
            if (!w.Full)
            {
                // Turn back at the end of the tube, a little short of it.
                var margin = 0.6f / Math.Max(1, r);
                if (w.Angle > w.A1 - margin && w.Speed > 0) w.Speed = -w.Speed;
                if (w.Angle < w.A0 + margin && w.Speed < 0) w.Speed = -w.Speed;
            }
            _walkers[i] = w;
            if (!Shows(w.Floor)) continue;
            var y = -w.Floor * _hole.FloorHeightM - 3 + 0.4f;
            // Facing the way they walk, bobbing with each step and swaying a little.
            var stride = (float)_time * Stride * Mathf.Abs(w.Speed) / WalkSpeed + w.Phase;
            var bob = Mathf.Abs(Mathf.Sin(stride)) * Bob;
            var sgn = Mathf.Sign(w.Speed);
            var facing = Mathf.Atan2(-Mathf.Sin(w.Angle) * sgn, Mathf.Cos(w.Angle) * sgn);
            var basis = Basis.FromEuler(new Vector3(0, facing, Mathf.Sin(stride) * Sway), EulerOrder.Yxz);
            var t = new Transform3D(basis, new Vector3(r * Mathf.Cos(w.Angle), y + bob, r * Mathf.Sin(w.Angle)));
            Put(_stand, ref stand, t, w.Clothes, w.Skin, HeadStand);
        }

        foreach (var p in _seated)
        {
            if (!Shows(p.floor)) continue;
            var turn = new Basis(Vector3.Up, p.turn);
            if (p.kind == 2)
            {
                // Lying on their back along the bed: head toward its head (-x), face up, feet at its foot.
                var feet = turn * new Vector3(BedFeet, 0.1f, 0);
                Put(_stand, ref stand, new Transform3D(turn * Lying, p.at + feet), p.clothes, p.skin, HeadStand);
            }
            else if (p.kind == 1) Put(_sit, ref sit, new Transform3D(turn, p.at), p.clothes, p.skin, HeadSit);
            else Put(_stand, ref stand, new Transform3D(turn, p.at), p.clothes, p.skin, HeadStand);
        }
        _stand.VisibleInstanceCount = stand;
        _sit.VisibleInstanceCount = sit;
        _heads.VisibleInstanceCount = heads;
        LastMs = watch.Elapsed.TotalMilliseconds;
    }

    // ---- the figure: boxes (x, y, z, width, height, depth, trousers?) as people3d.ts ----

    static readonly (float x, float y, float z, float w, float h, float d, bool trousers)[] StandingBoxes =
    {
        (-0.08f, 0.4f, 0, 0.13f, 0.8f, 0.15f, true),
        (0.08f, 0.4f, 0, 0.13f, 0.8f, 0.15f, true),
        (0, 1.1f, 0, 0.36f, 0.62f, 0.21f, false),
        (-0.235f, 1.1f, 0, 0.09f, 0.56f, 0.11f, false),
        (0.235f, 1.1f, 0, 0.09f, 0.56f, 0.11f, false),
        (0, 1.42f, 0, 0.1f, 0.06f, 0.1f, false),
    };

    static readonly (float x, float y, float z, float w, float h, float d, bool trousers)[] SittingBoxes =
    {
        (-0.08f, 0.06f, 0.2f, 0.13f, 0.14f, 0.46f, true),
        (0.08f, 0.06f, 0.2f, 0.13f, 0.14f, 0.46f, true),
        (-0.08f, -0.21f, 0.4f, 0.13f, 0.48f, 0.13f, true),
        (0.08f, -0.21f, 0.4f, 0.13f, 0.48f, 0.13f, true),
        (0, 0.4f, -0.04f, 0.36f, 0.6f, 0.21f, false),
        (-0.235f, 0.36f, 0.06f, 0.09f, 0.5f, 0.11f, false),
        (0.235f, 0.36f, 0.06f, 0.09f, 0.5f, 0.11f, false),
        (0, 0.72f, -0.04f, 0.1f, 0.06f, 0.1f, false),
    };

    /// <summary>Boxes merged into one mesh; vertex alpha 0 takes the instance's colour (clothes), trousers keep their own.</summary>
    static ArrayMesh Figure((float x, float y, float z, float w, float h, float d, bool trousers)[] boxes)
    {
        var st = new SurfaceTool();
        st.Begin(Mesh.PrimitiveType.Triangles);
        var trousers = Hex(Trousers);
        foreach (var b in boxes)
        {
            var mesh = new BoxMesh { Size = new Vector3(b.w, b.h, b.d) };
            var arrays = mesh.GetMeshArrays();
            var verts = (Vector3[])arrays[(int)Mesh.ArrayType.Vertex];
            var normals = (Vector3[])arrays[(int)Mesh.ArrayType.Normal];
            var index = (int[])arrays[(int)Mesh.ArrayType.Index];
            foreach (var i in index)
            {
                st.SetNormal(normals[i]);
                st.SetColor(b.trousers ? trousers : new Color(1, 1, 1, 0));
                st.AddVertex(verts[i] + new Vector3(b.x, b.y, b.z));
            }
        }
        return st.Commit();
    }

    const string ShaderCode = @"
shader_type spatial;
uniform float roughness = 0.85;
uniform bool instance_only = false;
varying vec3 tint;
void vertex() {
    tint = instance_only ? INSTANCE_CUSTOM.rgb : mix(INSTANCE_CUSTOM.rgb, COLOR.rgb, COLOR.a);
}
void fragment() {
    ALBEDO = tint;
    ROUGHNESS = roughness;
}
";
}
