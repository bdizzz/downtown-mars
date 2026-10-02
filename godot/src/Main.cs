using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// The Godot experiment (docs/PLAN-GODOT.md). Loads a scene exported from the web game
/// (scenes/&lt;name&gt;.glb, with its lamps and the hole's shape in &lt;name&gt;.json), dresses its
/// materials, and lights it with Godot's renderer: sun and sky, global illumination (SDFGI),
/// screen-space occlusion and indirect light, volumetric fog, glow, and a real light per lamp.
///
/// Without arguments it's the live viewer (Live.cs), drawing the game the bridge runs; --floor=&lt;n&gt;
/// picks a floor, --walk starts in first person, --port=&lt;n&gt; finds the bridge there (default 7878), --shot=&lt;seconds&gt; saves shots/live.png then and quits,
/// --bench=&lt;seconds&gt; averages frame times after a warmup, prints them and quits, --click=x,y clicks there,
/// --build=&lt;room&gt; opens Build with that room in hand and --hover=x,y points there.
/// Command line (after "--"): --scene=&lt;name&gt; views an exported scene instead; --bench[=seconds] circles the
/// camera, writes bench/&lt;name&gt;.json and a screenshot, then quits; with --walk, in first person. --no-lamp-shadows: lamps light but cast no shadows; --lite: no SDFGI, SSIL or volumetric fog.
/// Keys: Tab switches Iso and first person; F12 saves a screenshot to shots/.
/// </summary>
public partial class Main : Node3D
{
    string? _scene;
    float _benchSeconds = 0;
    bool _benchWalk, _lampShadows = true, _lite;
    CameraRig _rig = null!;
    Label _hud = null!;
    int _lampCount;
    Meta _meta = null!;

    // Benchmark state.
    double _benchTime;
    readonly List<double> _frames = new();
    bool _shotTaken;

    public override void _Ready()
    {
        foreach (var arg in OS.GetCmdlineUserArgs())
        {
            if (arg.StartsWith("--scene=")) _scene = arg["--scene=".Length..];
            else if (arg == "--bench") _benchSeconds = 20;
            else if (arg.StartsWith("--bench=")) _benchSeconds = float.Parse(arg["--bench=".Length..]);
            else if (arg == "--walk") _benchWalk = true;
            else if (arg == "--no-lamp-shadows") _lampShadows = false;
            else if (arg == "--lite") _lite = true;
        }

        // Without a scene to load, the live game from the bridge.
        if (_scene == null)
        {
            var live = new Live { Name = "Live" };
            foreach (var arg in OS.GetCmdlineUserArgs())
            {
                if (arg.StartsWith("--shot=")) live.ShotAfter = float.Parse(arg["--shot=".Length..]);
                else if (arg.StartsWith("--floor=")) live.StartFloor = int.Parse(arg["--floor=".Length..]);
                else if (arg == "--walk") live.StartWalking = true;
                else if (arg.StartsWith("--port=")) live.Port = int.Parse(arg["--port=".Length..]);
                else if (arg.StartsWith("--bench=")) live.BenchSeconds = float.Parse(arg["--bench=".Length..]);
                else if (arg.StartsWith("--build=")) live.StartTool = arg["--build=".Length..];
                else if (arg.StartsWith("--hover="))
                {
                    var xy = arg["--hover=".Length..].Split(',');
                    live.HoverAt = new Vector2(float.Parse(xy[0]), float.Parse(xy[1]));
                }
                else if (arg.StartsWith("--click="))
                {
                    var xy = arg["--click=".Length..].Split(',');
                    live.ClickAt = new Vector2(float.Parse(xy[0]), float.Parse(xy[1]));
                }
            }
            AddChild(live);
            return;
        }

        var dir = ProjectSettings.GlobalizePath("res://scenes/");
        _meta = Meta.Load($"{dir}{_scene}.json");

        // The scene as the web game draws it.
        var doc = new GltfDocument();
        var state = new GltfState();
        var err = doc.AppendFromFile($"{dir}{_scene}.glb", state);
        if (err != Error.Ok)
        {
            GD.PushError($"Couldn't load scenes/{_scene}.glb: {err}");
            GetTree().Quit(1);
            return;
        }
        var root = doc.GenerateScene(state);
        AddChild(root);
        Dress.Apply(root);

        AddChild(Lighting.MakeEnvironment(_lite));
        AddChild(Lighting.MakeShaftHaze(_meta.Hole));
        AddChild(Lighting.MakeSun(_meta.Sun));
        _lampCount = Lighting.AddLamps(this, _meta.Lamps, _lampShadows);

        _rig = new CameraRig(_meta);
        AddChild(_rig);

        var hud = new CanvasLayer();
        _hud = new Label { Position = new Vector2(12, 10) };
        _hud.AddThemeColorOverride("font_color", new Color(1, 0.93f, 0.85f));
        _hud.AddThemeColorOverride("font_shadow_color", new Color(0, 0, 0, 0.8f));
        hud.AddChild(_hud);
        AddChild(hud);

        if (_benchSeconds > 0) _rig.StartBench(_benchSeconds, _benchWalk);
    }

    public override void _Process(double delta)
    {
        if (_scene == null) return;
        var calls = RenderingServer.GetRenderingInfo(RenderingServer.RenderingInfo.TotalDrawCallsInFrame);
        var prims = RenderingServer.GetRenderingInfo(RenderingServer.RenderingInfo.TotalPrimitivesInFrame);
        _hud.Text = $"{_scene} · {Engine.GetFramesPerSecond()} fps · {calls} draw calls · {prims / 1000}k triangles · {_lampCount} lamps · {_rig.ModeName}\nTab: Iso / first person · drag to turn · wheel to zoom · WASD to move · F12 screenshot";

        if (_benchSeconds <= 0) return;
        _benchTime += delta;
        // The first seconds compile shaders and settle the global illumination: not counted.
        if (_benchTime > Bench.Warmup) _frames.Add(delta);
        // Halfway round from above; a quarter round on foot, looking along the gallery.
        if (!_shotTaken && _benchTime > Bench.Warmup + _benchSeconds * (_benchWalk ? 0.25 : 0.5))
        {
            _shotTaken = true;
            Screenshot($"bench/{BenchName}.png");
        }
        if (_benchTime > Bench.Warmup + _benchSeconds) FinishBench(calls, prims);
    }

    public override void _UnhandledInput(InputEvent e)
    {
        if (_scene == null) return;
        if (e is InputEventKey { Pressed: true, Keycode: Key.F12 }) Screenshot($"shots/{_scene}-{DateTime.Now:HHmmss}.png");
    }

    string BenchName => _scene + (_benchWalk ? "-walk" : "") + (_lampShadows ? "" : "-noshadow") + (_lite ? "-lite" : "");

    void Screenshot(string path)
    {
        var full = ProjectSettings.GlobalizePath($"res://{path}");
        System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(full)!);
        GetViewport().GetTexture().GetImage().SavePng(full);
    }

    void FinishBench(ulong calls, ulong prims)
    {
        var ms = _frames.Select(f => f * 1000).OrderBy(f => f).ToList();
        var result = new
        {
            scene = _scene,
            frames = ms.Count,
            avgMs = ms.Average(),
            p95Ms = ms[(int)(ms.Count * 0.95)],
            avgFps = 1000 / ms.Average(),
            drawCalls = calls,
            triangles = prims,
            lamps = _lampCount,
            gpu = RenderingServer.GetVideoAdapterName(),
            resolution = GetViewport().GetVisibleRect().Size.ToString(),
        };
        var full = ProjectSettings.GlobalizePath($"res://bench/{BenchName}.json");
        System.IO.File.WriteAllText(full, JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true }));
        GD.Print($"BENCH {JsonSerializer.Serialize(result)}");
        GetTree().Quit();
    }
}

/// <summary>What the exporter wrote beside the scene: the hole's shape, its lamps and the sun.</summary>
public class Meta
{
    public HoleShape Hole { get; set; } = new();
    public List<Lamp> Lamps { get; set; } = new();
    public float[] Sun { get; set; } = { 40, 80, 20 };
    /// <summary>The floor picked when exported (the floors above it left out), or null with every floor.</summary>
    public int? Cut { get; set; }

    public static Meta Load(string path)
    {
        var json = System.IO.File.ReadAllText(path);
        return JsonSerializer.Deserialize<Meta>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new Meta();
    }
}

public class HoleShape
{
    public float ShaftRadiusM { get; set; } = 10;
    public int Floors { get; set; } = 1;
    public int[] RingSlots { get; set; } = Array.Empty<int>();
    public int UnlockedRings { get; set; } = 3;
    public float FloorHeightM { get; set; } = 4;
}

public class Lamp
{
    public float X { get; set; }
    public float Y { get; set; }
    public float Z { get; set; }
    public int Floor { get; set; }
    public string Color { get; set; } = "#ffffff";
    public float Reach { get; set; }
    public float Strength { get; set; }
}

static class Bench
{
    /// <summary>Seconds before frames count: shaders compile and SDFGI settles.</summary>
    public const double Warmup = 4;
}
