using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// The drill rig at the bottom of the hole, as the bridge sends it (src/bridge/rig.ts, the web's own
/// rig): a tree of parts. Here it rides down with the dig front (from the snapshot, as the web's stage
/// places it), stretches its cables up the shaft, and moves as render3d/drillRig.ts step() and strike()
/// do: the cutterhead turns, the beacon spins, the reel pays out, spoil rides the conveyor and the lamps
/// blink while it bores; when it strikes something it shudders for a few seconds, lamps flaring. Its
/// floodlights light the bottom of the shaft for real.
/// </summary>
public partial class Rig : Node3D
{
    const float FloorH = 4, Crust = 3, Drop = FloorH / 2, ShakeSeconds = 3;

    Node3D? _root, _head, _beacon, _reel, _hoist, _power;
    readonly List<Node3D> _lumps = new();
    ShaderMaterial? _lamp, _beaconMat;
    readonly OmniLight3D _flood = new() { LightColor = new Color("#ffb35c"), OmniRange = 16, OmniAttenuation = 1.2f, ShadowEnabled = false, LightEnergy = 0 };
    float _hoistTop, _powerTop, _conveyor;
    bool _active;
    float _t, _shake;
    int? _struck;
    bool _struckSeen;
    int _holeId = -1;

    public Rig()
    {
        AddChild(_flood);
        _flood.Position = new Vector3(0, 6, 0);
    }

    /// <summary>The bridge's rig: build it afresh.</summary>
    public void Set(JsonElement m)
    {
        _root?.QueueFree();
        _lumps.Clear();
        _head = _beacon = _reel = _hoist = _power = null;
        var holeId = m.GetProperty("holeId").GetInt32();
        if (holeId != _holeId)
        {
            // Another hole: its strikes so far aren't news.
            _holeId = holeId;
            _struckSeen = false;
        }
        var materials = m.GetProperty("materials").EnumerateArray().Select(MaterialFor).ToList();
        _root = Build(m.GetProperty("root"), materials);
        AddChild(_root);
        var tops = m.GetProperty("tops");
        _hoistTop = tops.GetProperty("hoist").GetSingle();
        _powerTop = tops.GetProperty("power").GetSingle();
        _conveyor = tops.GetProperty("conveyor").GetSingle();
    }

    ShaderMaterial MaterialFor(JsonElement m)
    {
        var name = m.GetProperty("name").GetString();
        var glow = m.GetProperty("emissiveIntensity").GetSingle();
        var emissive = new Color(m.GetProperty("emissive").GetString()!);
        var glows = glow > 0 && emissive.Luminance > 0.01f;
        var mat = Plain.Make(new Color(m.GetProperty("color").GetString()!) with { A = m.GetProperty("opacity").GetSingle() }, m.GetProperty("roughness").GetSingle(), m.GetProperty("metalness").GetSingle(),
            transparent: m.GetProperty("transparent").GetBoolean(), emission: glows ? emissive : null, emissionEnergy: glow);
        if (name == "rig:lamp") _lamp = mat;
        if (name == "rig:beacon") _beaconMat = mat;
        return mat;
    }

    static void Glow(ShaderMaterial? m, float energy) => m?.SetShaderParameter("emission_energy", energy);

    Node3D Build(JsonElement n, List<ShaderMaterial> materials)
    {
        var node = new Node3D { Name = string.IsNullOrEmpty(n.GetProperty("name").GetString()) ? "part" : n.GetProperty("name").GetString()!.Replace(":", "_") };
        float[] F(string k) => n.GetProperty(k).EnumerateArray().Select(x => x.GetSingle()).ToArray();
        var p = F("p");
        var q = F("q");
        var s = F("s");
        node.Position = new Vector3(p[0], p[1], p[2]);
        node.Quaternion = new Quaternion(q[0], q[1], q[2], q[3]).Normalized();
        node.Scale = new Vector3(s[0], s[1], s[2]);
        foreach (var mesh in n.GetProperty("meshes").EnumerateArray())
        {
            var chunk = JsonDocument.Parse($"{{\"lines\":false,\"positions\":\"{mesh.GetProperty("positions").GetString()}\",\"normals\":\"{mesh.GetProperty("normals").GetString()}\"}}").RootElement;
            var arrays = HoleScene.ChunkMesh(chunk);
            if (arrays == null) continue;
            arrays.SurfaceSetMaterial(0, materials[mesh.GetProperty("material").GetInt32()]);
            node.AddChild(new MeshInstance3D { Mesh = arrays });
        }
        switch (n.GetProperty("name").GetString())
        {
            case "rig:head": _head = node; break;
            case "rig:beacon": _beacon = node; break;
            case "rig:reel": _reel = node; break;
            case "rig:lump": _lumps.Add(node); break;
            case "rig:hoist": _hoist = node; break;
            case "rig:power": _power = node; break;
        }
        foreach (var c in n.GetProperty("children").EnumerateArray()) node.AddChild(Build(c, materials));
        return node;
    }

    /// <summary>
    /// The snapshot's drill and hole: where the cutter face is (half a floor below the sim's dig front, as
    /// the web's), whether it's boring, a strike, and whether the picked floor hides it.
    /// </summary>
    public void Place(JsonElement drill, int floors, int? cut)
    {
        int? floor = drill.GetProperty("floor").ValueKind == JsonValueKind.Number ? drill.GetProperty("floor").GetInt32() : null;
        var progress = drill.GetProperty("progress").GetSingle();
        float Bottom(int f) => -f * FloorH - Crust;
        float Top(int f) => (1 - f) * FloorH - Crust;
        var front = (floor is int fl ? Top(fl) - progress * FloorH : Bottom(floors)) - Drop;
        Position = new Vector3(Position.X, front, Position.Z);
        var active = drill.GetProperty("active").GetBoolean() && floor != null;
        if (active != _active && _shake <= 0) Light(active);
        _active = active;
        Visible = cut == null || (floor ?? floors) >= cut;
        // The cables, from the rig up to the rim.
        foreach (var (cable, top) in new[] { (_hoist, _hoistTop), (_power, _powerTop) })
        {
            if (cable == null) continue;
            var len = Math.Max(0.1f, -front - top);
            cable.Scale = new Vector3(cable.Scale.X, len, cable.Scale.Z);
            cable.Position = new Vector3(cable.Position.X, top + len / 2, cable.Position.Z);
        }
        // A strike since the last we saw (not one from before we joined): shudder.
        int? struck = drill.GetProperty("struckTick").ValueKind == JsonValueKind.Number ? drill.GetProperty("struckTick").GetInt32() : null;
        if (_struckSeen && struck != null && struck != _struck)
        {
            _shake = ShakeSeconds;
            GD.Print("Rig: struck something");
        }
        _struck = struck;
        _struckSeen = true;
    }

    void Light(bool on)
    {
        Glow(_lamp, on ? 2 : 0.5f);
        Glow(_beaconMat, on ? 1.5f : 0.2f);
        _flood.LightEnergy = on ? 2.5f : 0.6f;
    }

    /// <summary>As the web's step(): turning, running and blinking while it bores; a dying judder after a strike.</summary>
    public void Step(float dt)
    {
        if (_root == null) return;
        if (_shake > 0)
        {
            _shake = Math.Max(0, _shake - dt);
            var k = _shake / ShakeSeconds * 0.18f;
            _root.Position = new Vector3(MathF.Sin(_t * 61) * k, 0, MathF.Cos(_t * 47) * k);
            var flare = MathF.Sin(_t * 20) > 0;
            Glow(_lamp, flare ? 4 : 1);
            Glow(_beaconMat, 3);
            _flood.LightEnergy = flare ? 4 : 1.5f;
            _t += dt;
            if (_shake == 0)
            {
                _root.Position = Vector3.Zero;
                Light(_active);
            }
            if (!_active) return;
        }
        if (!_active) return;
        _t += dt;
        Turn(_head, Vector3.Up, dt * 0.35f);
        Turn(_beacon, Vector3.Up, dt * 5);
        Turn(_reel, Vector3.Back, dt * 0.05f);
        // Spoil rides up the belt and tips into the skip; new lumps come on at the bottom.
        foreach (var lump in _lumps)
        {
            var x = lump.Position.X + dt * 0.6f;
            if (x > _conveyor) x -= _conveyor;
            lump.Position = new Vector3(x, lump.Position.Y, lump.Position.Z);
            Turn(lump, Vector3.Up, dt);
        }
        var blink = MathF.Sin(_t * 4) > 0;
        Glow(_lamp, blink ? 2.4f : 1.2f);
        _flood.LightEnergy = blink ? 2.6f : 2.2f;
    }

    static void Turn(Node3D? node, Vector3 axis, float angle)
    {
        if (node != null) node.Quaternion = (node.Quaternion * new Quaternion(axis, angle)).Normalized();
    }
}
