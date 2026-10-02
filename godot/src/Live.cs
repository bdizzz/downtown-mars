using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// The live viewer (docs/PLAN-GODOT.md, phase 2): the game running in the bridge (npm run bridge),
/// drawn by Godot. Snapshots bring the time, the people and the stocks; scenes bring the hole.
/// The sun crosses the sky by the game's hour; the HUD shows the day, the speed and the stocks, and
/// picks a floor (the bridge sends the scene cut there).
/// Keys: Space pauses, 1–3 set the speed, Up/Down step the picked floor, Home shows all floors,
/// Tab switches Iso and first person, L hides the labels, F12 saves a screenshot.
/// </summary>
public partial class Live : Node3D
{
    static readonly int[] Speeds = { 0, 1, 2, 4 };
    /// <summary>Lamps lit: on the floor in view, this many above it and below.</summary>
    static readonly (int above, int below) LampFloors = (0, 1);
    static readonly (string key, string name)[] Stocks = { ("o2", "Oxygen"), ("water", "Water"), ("meals", "Meals"), ("rations", "Rations"), ("power", "Power"), ("rock", "Rock"), ("metal", "Metal"), ("brick", "Brick"), ("glass", "Glass") };

    Bridge _bridge = null!;
    HoleScene _hole = null!;
    People _people = null!;
    CameraRig? _rig;
    WorldEnvironment _env = null!;
    DirectionalLight3D _sun = null!;
    FogVolume? _haze;
    MeshInstance3D _ground = null!;

    // HUD.
    Label _title = null!, _clock = null!, _stocks = null!, _status = null!;
    readonly List<Button> _speedButtons = new();
    VBoxContainer _floorPicker = null!;
    int _pickerFloors = -1;

    // What the game is doing.
    HoleShape _shape = new();
    int? _topFloor;
    int _speed = 1;
    int _gameId = -1;
    float _light = 1;
    double _clockSeconds, _shadowClock;

    /// <summary>Start-up options from the command line (Main.cs): a floor to pick, first person, and a screenshot then quit.</summary>
    public int? StartFloor { get; set; }
    public bool StartWalking { get; set; }
    public float ShotAfter { get; set; }
    /// <summary>Benchmark: after a warmup, average this many seconds of frames, print them, save a shot and quit.</summary>
    public float BenchSeconds { get; set; }
    const double BenchWarmup = 8;
    readonly List<double> _frames = new(), _gpu = new(), _cpu = new(), _process = new();

    public override void _Ready()
    {
        _bridge = new Bridge();
        _env = Lighting.MakeEnvironment();
        AddChild(_env);
        _sun = Lighting.MakeSun(new float[] { 40, 80, 20 });
        AddChild(_sun);
        _hole = new HoleScene { Name = "Hole" };
        AddChild(_hole);
        _people = new People { Name = "People" };
        if (!Dev.Off("people")) AddChild(_people);
        if (Dev.Off("sunshadow")) _sun.ShadowEnabled = false;
        if (Dev.Off("msaa")) GetViewport().Msaa3D = Viewport.Msaa.Disabled;
        _ground = new MeshInstance3D { Name = "Ground" };
        AddChild(_ground);
        BuildHud();
        RenderingServer.ViewportSetMeasureRenderTime(GetViewport().GetViewportRid(), true);
    }

    public override void _ExitTree() => _bridge.Dispose();

    double _liveMs;

    public override void _Process(double delta)
    {
        var watch = System.Diagnostics.Stopwatch.StartNew();
        try { Step(delta); }
        finally { _liveMs = watch.Elapsed.TotalMilliseconds; }
    }

    void Step(double delta)
    {
        _clockSeconds += delta;
        if (BenchSeconds > 0 && _clockSeconds > BenchWarmup)
        {
            _frames.Add(delta * 1000);
            var vp = GetViewport().GetViewportRid();
            _gpu.Add(RenderingServer.ViewportGetMeasuredRenderTimeGpu(vp));
            _cpu.Add(RenderingServer.ViewportGetMeasuredRenderTimeCpu(vp) + RenderingServer.GetFrameSetupTimeCpu());
            _process.Add(_people.LastMs + _liveMs);
            if (_clockSeconds > BenchWarmup + BenchSeconds)
            {
                var ms = _frames.OrderBy(f => f).ToList();
                GD.Print($"BENCH {{\"avgMs\":{ms.Average():0.0},\"p95Ms\":{ms[(int)(ms.Count * 0.95)]:0.0},\"fps\":{1000 / ms.Average():0.0},\"drawCalls\":{RenderingServer.GetRenderingInfo(RenderingServer.RenderingInfo.TotalDrawCallsInFrame)},\"chunks\":{_hole.Chunks},\"triangles\":{RenderingServer.GetRenderingInfo(RenderingServer.RenderingInfo.TotalPrimitivesInFrame)},\"gpuMs\":{_gpu.Average():0.0},\"renderCpuMs\":{_cpu.Average():0.0},\"scriptMs\":{_process.Average():0.0},\"walking\":{(_rig?.Walking == true ? "true" : "false")}}}");
                Screenshot("bench");
                GetTree().Quit();
            }
        }
        if (ShotAfter > 0 && _clockSeconds > ShotAfter)
        {
            ShotAfter = 0;
            Screenshot("live");
            GetTree().Quit();
        }
        // Every scene is built, but only the latest snapshot matters.
        JsonDocument? snapshot = null;
        while (_bridge.Poll(out var msg))
        {
            var type = msg.RootElement.GetProperty("type").GetString();
            if (type == "snapshot")
            {
                snapshot?.Dispose();
                snapshot = msg;
                // A fresh layout comes once: read it now in case a newer snapshot follows without it.
                if (msg.RootElement.GetProperty("snapshot").TryGetProperty("layout", out var layout)) OnLayout(layout);
                continue;
            }
            if (type == "scene") OnScene(msg.RootElement);
            else if (type == "people") _people.Set(msg.RootElement);
            msg.Dispose();
        }
        // Lamps near what you're looking at, and their shadows, follow the camera a few times a second.
        _shadowClock += delta;
        if (_shadowClock > 0.25 && GetViewport().GetCamera3D() is Camera3D cam)
        {
            _shadowClock = 0;
            // The floor in view: where you stand in first person, else the picked floor (or the top).
            var focus = _rig?.Walking == true ? Mathf.FloorToInt((-cam.GlobalPosition.Y - 3) / 4) + 1 : _topFloor ?? 1;
            _hole.UpdateLamps(cam.GlobalPosition, focus - LampFloors.above, focus + LampFloors.below);
        }
        if (snapshot != null)
        {
            OnSnapshot(snapshot.RootElement);
            snapshot.Dispose();
        }
        _status.Text = _bridge.Connected
            ? $"{Engine.GetFramesPerSecond()} fps · {RenderingServer.GetRenderingInfo(RenderingServer.RenderingInfo.TotalDrawCallsInFrame)} draw calls · {_hole.Chunks} chunks · {_hole.Lamps} lamps · {(_rig?.Walking == true ? "first person" : "iso")}\nSpace pause · 1–3 speed · ↑↓ floor · Home all floors · Tab first person · drag to turn · wheel to zoom · WASD to move · L labels"
            : "Waiting for the game: run  npm run bridge  in the repo (add -- --showcase=12 for a big test colony).";
    }

    void OnLayout(JsonElement layout)
    {
        var h = layout.GetProperty("hole");
        _shape = new HoleShape
        {
            ShaftRadiusM = h.GetProperty("shaftRadiusM").GetSingle(),
            Floors = h.GetProperty("floors").GetInt32(),
            RingSlots = h.GetProperty("ringSlots").EnumerateArray().Select(x => x.GetInt32()).ToArray(),
            UnlockedRings = h.GetProperty("unlockedRings").GetInt32(),
            FloorHeightM = 4,
        };
        _people.SetHole(_shape);
        if (_topFloor > _shape.Floors) PickFloor(null);
        if (_pickerFloors != _shape.Floors) BuildFloorPicker();
        if (StartFloor is int start)
        {
            StartFloor = null;
            PickFloor(start);
        }
        BuildGround();
        BuildOccluders();
        if (_haze != null) _haze.QueueFree();
        _haze = Lighting.MakeShaftHaze(_shape);
        AddChild(_haze);
    }

    void OnScene(JsonElement scene)
    {
        // A scene for another floor than ours (the bridge restarted, say): ask again.
        var cut = scene.GetProperty("topFloor");
        int? sceneFloor = cut.ValueKind == JsonValueKind.Number ? cut.GetInt32() : null;
        if (sceneFloor != _topFloor) _bridge.Send(new Dictionary<string, object?> { ["type"] = "view", ["topFloor"] = _topFloor });
        var t0 = Time.GetTicksMsec();
        _hole.Build(scene);
        _hole.SetNight(1 - _light);
        GD.Print($"Scene built: {_hole.Chunks} chunks, {_hole.Lamps} lamps in {Time.GetTicksMsec() - t0} ms");
        if (_rig == null)
        {
            _rig = new CameraRig(MetaNow());
            AddChild(_rig);
            if (StartWalking) _rig.Walk(true);
        }
    }

    void OnSnapshot(JsonElement msg)
    {
        _speed = msg.GetProperty("speed").GetInt32();
        var s = msg.GetProperty("snapshot");
        var gameId = s.GetProperty("gameId").GetInt32();
        if (gameId != _gameId)
        {
            _gameId = gameId;
            _rig?.Frame(MetaNow(), true);
        }
        var t = s.GetProperty("time");
        var pop = s.GetProperty("population").GetProperty("count").GetInt32();
        _title.Text = s.GetProperty("holeName").GetString();
        _clock.Text = $"Day {t.GetProperty("day").GetInt32()} · {t.GetProperty("hour").GetInt32():00}:{t.GetProperty("minute").GetInt32():00} · {pop} colonists";
        var res = s.GetProperty("resources");
        _stocks.Text = string.Join("   ", Stocks.Where(k => res.TryGetProperty(k.key, out _)).Select(k => $"{k.name} {res.GetProperty(k.key).GetDouble():0}"));
        for (var i = 0; i < Speeds.Length; i++) _speedButtons[i].ButtonPressed = Speeds[i] == _speed;
        var storm = s.GetProperty("weather").GetProperty("storm").GetSingle();
        Daylight(t.GetProperty("dayFraction").GetSingle(), storm);
    }

    /// <summary>The hour's light, as the web game's (stage3d.ts updateSky): the sun crosses once a day, the sky dims at night and in a storm.</summary>
    void Daylight(float f, float storm)
    {
        _light = f > 0.25f && f < 0.75f ? Mathf.Sin(Mathf.Pi * (f - 0.25f) / 0.5f) : 0;
        var a = (f - 0.25f) * Mathf.Tau;
        var pos = new Vector3(Mathf.Cos(a) * 100, Mathf.Max(5, Mathf.Sin(a) * 100), 30);
        _sun.LookAtFromPosition(pos, Vector3.Zero, Vector3.Up);
        _sun.LightEnergy = (0.15f + 2.0f * _light) * (1 - 0.7f * storm);
        var env = _env.Environment;
        env.AmbientLightEnergy = (0.08f + 0.2f * _light) * (1 - 0.4f * storm);
        if (env.Sky.SkyMaterial is ProceduralSkyMaterial sky)
        {
            var day = Lighting.DaySky;
            var night = Lighting.NightSky;
            sky.SkyTopColor = night.top.Lerp(day.top, _light);
            sky.SkyHorizonColor = night.horizon.Lerp(day.horizon, _light);
            sky.GroundHorizonColor = night.ground.Lerp(day.ground, _light);
        }
        _hole.SetNight(1 - _light);
    }

    Meta MetaNow() => new() { Hole = _shape, Cut = _topFloor };

    void PickFloor(int? floor)
    {
        if (floor != null) floor = Math.Clamp(floor.Value, 1, Math.Max(1, _shape.Floors));
        if (floor == _topFloor) return;
        _topFloor = floor;
        // With a floor picked, everything above it is left out, the ground too.
        _ground.Visible = floor == null;
        _people.SetTopFloor(floor);
        BuildOccluders();
        _bridge.Send(new Dictionary<string, object?> { ["type"] = "view", ["topFloor"] = floor });
        _rig?.Frame(MetaNow(), false);
        foreach (var b in _floorPicker.GetChildren().OfType<Button>())
        {
            var f = b.GetMeta("floor").AsInt32();
            b.ButtonPressed = f == -1 ? floor == null : f == floor;
        }
    }

    void SetSpeed(int speed) => _bridge.Send(new Dictionary<string, object> { ["type"] = "setSpeed", ["speed"] = speed });

    public override void _UnhandledInput(InputEvent e)
    {
        if (e is not InputEventKey { Pressed: true, Echo: false } k) return;
        switch (k.Keycode)
        {
            case Key.Space when _rig?.Walking != true: SetSpeed(_speed == 0 ? 1 : 0); break;
            case Key.Key1: SetSpeed(1); break;
            case Key.Key2: SetSpeed(2); break;
            case Key.Key3: SetSpeed(4); break;
            case Key.Up: if (_topFloor != null) PickFloor(_topFloor == 1 ? null : _topFloor - 1); break;
            case Key.Down: PickFloor((_topFloor ?? 0) + 1); break;
            case Key.Home: PickFloor(null); break;
            case Key.L: _hole.ShowLabels = !_hole.ShowLabels; break;
            case Key.F12: Screenshot($"live-{DateTime.Now:HHmmss}"); break;
            default: return;
        }
        GetViewport().SetInputAsHandled();
    }

    void Screenshot(string name)
    {
        var path = ProjectSettings.GlobalizePath($"res://shots/{name}.png");
        System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(path)!);
        GetViewport().GetTexture().GetImage().SavePng(path);
        GD.Print($"Saved {path}");
    }

    /// <summary>The ground round the hole: a wide ring of rock from the shaft's rim out to the horizon.</summary>
    void BuildGround()
    {
        const int segments = 96;
        const float far = 1500;
        var r0 = _shape.ShaftRadiusM;
        var verts = new List<Vector3>();
        var norms = new List<Vector3>();
        for (var i = 0; i < segments; i++)
        {
            float t0 = Mathf.Tau * i / segments, t1 = Mathf.Tau * (i + 1) / segments;
            Vector3 P(float r, float t) => new(r * Mathf.Cos(t), 0, r * Mathf.Sin(t));
            // Clockwise seen from above, Godot's front.
            foreach (var v in new[] { P(r0, t0), P(far, t0), P(far, t1), P(r0, t0), P(far, t1), P(r0, t1) }) verts.Add(v);
            for (var k = 0; k < 6; k++) norms.Add(Vector3.Up);
        }
        // Make sure of the winding: flip if the first face points down.
        var face = (verts[1] - verts[0]).Cross(verts[2] - verts[0]);
        if (face.Y > 0)
            for (var i = 0; i < verts.Count; i += 3) (verts[i + 1], verts[i + 2]) = (verts[i + 2], verts[i + 1]);
        var arrays = new Godot.Collections.Array();
        arrays.Resize((int)Mesh.ArrayType.Max);
        arrays[(int)Mesh.ArrayType.Vertex] = verts.ToArray();
        arrays[(int)Mesh.ArrayType.Normal] = norms.ToArray();
        var mesh = new ArrayMesh();
        mesh.AddSurfaceFromArrays(Mesh.PrimitiveType.Triangles, arrays);
        mesh.SurfaceSetMaterial(0, Dress.For(new StandardMaterial3D { ResourceName = "rock:ground", AlbedoColor = new Color("#7a3b22"), Roughness = 0.95f }));
        _ground.Mesh = mesh;
    }

    Node3D? _occluders;

    /// <summary>
    /// Each floor's slab as an occluder (a ring from the gallery ledge out past ring 3, just under the
    /// floor): Godot then leaves out whatever a floor hides, the floors under the one in view above all.
    /// </summary>
    void BuildOccluders()
    {
        _occluders?.QueueFree();
        _occluders = new Node3D { Name = "Occluders" };
        AddChild(_occluders);
        if (Dev.Off("occluders")) return;
        const int segments = 48;
        var r0 = _shape.ShaftRadiusM - 2;
        var r1 = _shape.ShaftRadiusM + _shape.RingSlots.Length * 10;
        // Floors above a picked one aren't there, so neither are their slabs.
        for (var f = _topFloor ?? 1; f <= _shape.Floors; f++)
        {
            var y = -3 - f * _shape.FloorHeightM - 0.05f;
            var verts = new List<Vector3>();
            var index = new List<int>();
            for (var i = 0; i < segments; i++)
            {
                var t = Mathf.Tau * i / segments;
                verts.Add(new Vector3(r0 * Mathf.Cos(t), y, r0 * Mathf.Sin(t)));
                verts.Add(new Vector3(r1 * Mathf.Cos(t), y, r1 * Mathf.Sin(t)));
                int a = i * 2, b = a + 1, c = (a + 2) % (segments * 2), d = (a + 3) % (segments * 2);
                index.AddRange(new[] { a, b, d, a, d, c });
            }
            var occ = new ArrayOccluder3D();
            occ.SetArrays(verts.ToArray(), index.ToArray());
            _occluders.AddChild(new OccluderInstance3D { Occluder = occ, Name = $"floor{f}" });
        }
    }

    // ---- HUD ----

    void BuildHud()
    {
        var layer = new CanvasLayer();
        AddChild(layer);
        var top = new PanelContainer { Position = new Vector2(10, 10) };
        top.AddThemeStyleboxOverride("panel", Panel());
        layer.AddChild(top);
        var rows = new VBoxContainer();
        top.AddChild(rows);
        var bar = new HBoxContainer();
        bar.AddThemeConstantOverride("separation", 14);
        rows.AddChild(bar);
        _title = Text("Downtown Mars", 20, new Color("#e8834a"));
        bar.AddChild(_title);
        _clock = Text("", 18, new Color("#f3e6d8"));
        bar.AddChild(_clock);
        var speeds = new HBoxContainer();
        bar.AddChild(speeds);
        foreach (var sp in Speeds)
        {
            var b = new Button { Text = sp == 0 ? "❚❚" : $"{sp}×", ToggleMode = true, FocusMode = Control.FocusModeEnum.None, CustomMinimumSize = new Vector2(44, 0) };
            var speed = sp;
            b.Pressed += () => SetSpeed(speed);
            speeds.AddChild(b);
            _speedButtons.Add(b);
        }
        _stocks = Text("", 15, new Color("#d8c4b0"));
        rows.AddChild(_stocks);

        _status = Text("", 13, new Color(1, 0.93f, 0.85f, 0.85f));
        _status.SetAnchorsPreset(Control.LayoutPreset.BottomLeft);
        _status.Position = new Vector2(12, -52);
        _status.GrowVertical = Control.GrowDirection.Begin;
        layer.AddChild(_status);

        var pickerPanel = new PanelContainer();
        pickerPanel.AddThemeStyleboxOverride("panel", Panel());
        pickerPanel.SetAnchorsPreset(Control.LayoutPreset.CenterRight);
        pickerPanel.GrowHorizontal = Control.GrowDirection.Begin;
        pickerPanel.Position = new Vector2(-70, -200);
        layer.AddChild(pickerPanel);
        var scroll = new ScrollContainer { CustomMinimumSize = new Vector2(56, 420), HorizontalScrollMode = ScrollContainer.ScrollMode.Disabled };
        pickerPanel.AddChild(scroll);
        _floorPicker = new VBoxContainer();
        scroll.AddChild(_floorPicker);
    }

    void BuildFloorPicker()
    {
        _pickerFloors = _shape.Floors;
        foreach (var c in _floorPicker.GetChildren()) c.QueueFree();
        for (var f = 0; f <= _shape.Floors; f++)
        {
            var floor = f == 0 ? (int?)null : f;
            var b = new Button { Text = f == 0 ? "All" : $"F{f}", ToggleMode = true, FocusMode = Control.FocusModeEnum.None, ButtonPressed = floor == _topFloor };
            b.SetMeta("floor", f == 0 ? -1 : f);
            b.Pressed += () => PickFloor(floor);
            _floorPicker.AddChild(b);
        }
    }

    static Label Text(string text, int size, Color color)
    {
        var l = new Label { Text = text, VerticalAlignment = VerticalAlignment.Center };
        l.AddThemeFontSizeOverride("font_size", size);
        l.AddThemeColorOverride("font_color", color);
        l.AddThemeColorOverride("font_shadow_color", new Color(0, 0, 0, 0.7f));
        return l;
    }

    static StyleBoxFlat Panel() => new()
    {
        BgColor = new Color(0.12f, 0.07f, 0.06f, 0.82f),
        CornerRadiusTopLeft = 8, CornerRadiusTopRight = 8, CornerRadiusBottomLeft = 8, CornerRadiusBottomRight = 8,
        ContentMarginLeft = 12, ContentMarginRight = 12, ContentMarginTop = 8, ContentMarginBottom = 8,
    };
}
