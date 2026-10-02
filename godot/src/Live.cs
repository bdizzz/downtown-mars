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
    static readonly (string key, string name)[] Stocks = { ("o2", "Oxygen"), ("water", "Water"), ("meals", "Meals"), ("rations", "Rations"), ("power", "Power"), ("rock", "Rock"), ("metal", "Metal"), ("brick", "Brick"), ("glass", "Glass") };

    Bridge _bridge = null!;
    HoleScene _hole = null!;
    People _people = null!;
    Inspector _inspector = null!;
    BuildMode _build = null!;
    int _commandId = 1;
    Vector2 _pressAt;
    bool _pressed;
    CameraRig? _rig;
    WorldEnvironment _env = null!;
    DirectionalLight3D _sun = null!;
    FogVolume? _haze;
    MeshInstance3D _ground = null!;

    // HUD.
    CanvasLayer _hud = null!;
    Label _title = null!, _clock = null!, _stocks = null!, _status = null!, _waiting = null!;
    PanelContainer _pickerPanel = null!;
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
    /// <summary>Stand here in first person: x, y, z, heading in degrees (0 looks along +x), and optionally pitch.</summary>
    public float[]? StandAt { get; set; }
    /// <summary>The bridge's port (npm run bridge -- --port=…).</summary>
    public int Port { get; set; } = 17878;
    /// <summary>A graphics level from the command line (--quality=low…ultra), not saved; otherwise the saved one.</summary>
    public Quality? StartQuality { get; set; }
    Quality _quality;
    Button _qualityButton = null!;
    /// <summary>A click at this screen point once the scene is up (for testing picking from the command line).</summary>
    public Vector2? ClickAt { get; set; }
    /// <summary>A room to have in hand once the palette's in, and a point to hover (testing building from the command line).</summary>
    public string? StartTool { get; set; }
    public Vector2? HoverAt { get; set; }
    public float ShotAfter { get; set; }
    /// <summary>Benchmark: after a warmup, average this many seconds of frames, print them, save a shot and quit.</summary>
    public float BenchSeconds { get; set; }
    const double BenchWarmup = 8;
    readonly List<double> _frames = new(), _gpu = new(), _cpu = new(), _process = new();

    public override void _Ready()
    {
        _bridge = new Bridge(port: Port);
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
        // A camera from the start, so there's a sky while waiting for the game (not a gray screen).
        _rig = new CameraRig(MetaNow());
        AddChild(_rig);
        BuildGround();
        BuildHud();
        _quality = StartQuality ?? Graphics.Load();
        ApplyQuality();
        _inspector = new Inspector(_hud) { Name = "Inspector" };
        _inspector.Closed = () => Inspect(null);
        _inspector.Command = SendCommand;
        AddChild(_inspector);
        _build = new BuildMode(_hud, m => _bridge.Send(m)) { Name = "Build" };
        AddChild(_build);
        RenderingServer.ViewportSetMeasureRenderTime(GetViewport().GetViewportRid(), true);
    }

    public override void _ExitTree()
    {
        _bridge.Dispose();
        Looks.Release();
        Dress.Release();
    }

    double _liveMs;
    bool _framed;

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
                GD.Print($"BENCH {{\"avgMs\":{ms.Average():0.0},\"p95Ms\":{ms[(int)(ms.Count * 0.95)]:0.0},\"fps\":{1000 / ms.Average():0.0},\"drawCalls\":{RenderingServer.GetRenderingInfo(RenderingServer.RenderingInfo.TotalDrawCallsInFrame)},\"chunks\":{_hole.Chunks},\"triangles\":{RenderingServer.GetRenderingInfo(RenderingServer.RenderingInfo.TotalPrimitivesInFrame)},\"gpuMs\":{_gpu.Average():0.0},\"renderCpuMs\":{_cpu.Average():0.0},\"scriptMs\":{_process.Average():0.0},\"quality\":\"{_quality}\",\"walking\":{(_rig?.Walking == true ? "true" : "false")}}}");
                Screenshot("bench");
                GetTree().Quit();
            }
        }
        if (StartTool is string tool && _rig != null && _clockSeconds > 4)
        {
            StartTool = null;
            _build.Toggle(true);
            _build.Pick(tool);
        }
        if (HoverAt is Vector2 hover && _rig != null && _clockSeconds > 5 && FloorPoint(hover) is Vector3 over)
        {
            HoverAt = null;
            _build.Hover(over, hover);
        }
        if (ClickAt is Vector2 click && _rig != null && _clockSeconds > 6)
        {
            ClickAt = null;
            Click(click);
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
            else if (type == "inspected") _inspector.Show(msg.RootElement);
            else if (type == "palette") _build.SetPalette(msg.RootElement);
            else if (type == "hovered") _build.Hovered(msg.RootElement);
            else if (type == "notice") _build.Notice(msg.RootElement);
            else if (type == "commandResult" && msg.RootElement.GetProperty("result") is var r && !r.GetProperty("ok").GetBoolean())
                _build.Toast(r.TryGetProperty("reason", out var why) ? why.GetString() ?? "Can't do that" : "Can't do that");
            msg.Dispose();
        }
        // Lamps near what you're looking at, and their shadows, follow the camera a few times a second.
        _shadowClock += delta;
        if (_shadowClock > 0.25 && GetViewport().GetCamera3D() is Camera3D cam)
        {
            _shadowClock = 0;
            // The floor in view: where you stand in first person, else the picked floor (or the top).
            var focus = _rig?.Walking == true ? Mathf.FloorToInt((-cam.GlobalPosition.Y - 3) / 4) + 1 : _topFloor ?? 1;
            var (above, below) = Graphics.LampFloors(_quality);
            _hole.UpdateLamps(cam.GlobalPosition, focus - above, focus + below);
        }
        _hole.ShowEdges = _rig?.Walking != true;
        if (snapshot != null)
        {
            OnSnapshot(snapshot.RootElement);
            snapshot.Dispose();
        }
        // While there's no game, say why in the middle of the screen, and hide what needs one.
        var waiting = !_bridge.Connected;
        _waiting.Visible = waiting;
        _pickerPanel.Visible = !waiting && _pickerFloors >= 0;
        _waiting.Text = _bridge.Silent
            ? $"Something is on port {Port}, but it isn't the game's bridge.\nRun  npm run bridge  in the repo, or start both with --port=<n>."
            : $"Waiting for the game on port {Port}…\nRun  npm run bridge  in the repo (add  -- --showcase=12  for a big test colony).";
        _status.Text = _bridge.Silent
            ? $"Something is on port {Port} but it isn't the game's bridge. Run  npm run bridge  in the repo (or both with --port=<n>)."
            : _bridge.Connected
            ? $"{Engine.GetFramesPerSecond()} fps · {RenderingServer.GetRenderingInfo(RenderingServer.RenderingInfo.TotalDrawCallsInFrame)} draw calls · {_hole.Chunks} chunks · {_hole.Lamps} lamps · {(_rig?.Walking == true ? "first person" : "iso")}\nClick a room · B build · Space pause · 1–3 speed · ↑↓ floor · Home all floors · Tab first person · drag to turn · wheel to zoom · WASD to move · L labels · F2 graphics"
            : $"Waiting for the game on port {Port}: run  npm run bridge  in the repo (add -- --showcase=12 for a big test colony).";
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
        ApplyQuality();
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
        if (!_framed && _rig != null)
        {
            _framed = true;
            _rig.Frame(MetaNow(), true);
            if (StartWalking) _rig.Walk(true);
            if (StandAt is float[] at && at.Length >= 4) _rig.Stand(new Vector3(at[0], at[1], at[2]), Mathf.DegToRad(at[3]), at.Length > 4 ? Mathf.DegToRad(at[4]) : 0);
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

    void ApplyQuality()
    {
        Graphics.Apply(_quality, _env.Environment, _sun, _haze, GetViewport());
        _hole.ShadowLamps = Graphics.ShadowLamps(_quality);
        _qualityButton.Text = $"Graphics: {_quality}";
    }

    /// <summary>The next graphics level round (F2 or the HUD button), kept for next time.</summary>
    void CycleQuality()
    {
        _quality = (Quality)(((int)_quality + 1) % 4);
        Graphics.Save(_quality);
        ApplyQuality();
        _build.Toast($"Graphics: {_quality}");
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

    /// <summary>Show a room in the panel (null closes it).</summary>
    void Inspect(int? roomId) => _bridge.Send(new Dictionary<string, object?> { ["type"] = "inspect", ["roomId"] = roomId });

    void SendCommand(Dictionary<string, object> command) => _bridge.Send(new Dictionary<string, object> { ["type"] = "command", ["id"] = _commandId++, ["command"] = command });

    /// <summary>
    /// Where the pointer meets the floor in view: where you stand in first person, else the picked
    /// floor (or the first); the surface for a surface room in hand with no floor picked.
    /// </summary>
    Vector3? FloorPoint(Vector2 at)
    {
        if (GetViewport().GetCamera3D() is not Camera3D cam) return null;
        var from = cam.ProjectRayOrigin(at);
        var dir = cam.ProjectRayNormal(at);
        var floor = _rig?.Walking == true ? Mathf.FloorToInt((-cam.GlobalPosition.Y - 3) / 4) + 1 : _topFloor ?? 1;
        var y = _build.Tool != null && _build.SurfaceTool && _topFloor == null ? 0.2f : -3 - floor * _shape.FloorHeightM + 0.5f;
        if (Mathf.Abs(dir.Y) < 1e-4f) return null;
        var t = (y - from.Y) / dir.Y;
        return t > 0 ? from + dir * t : null;
    }

    /// <summary>A click (not a drag): build with the room in hand, or show the room under the pointer.</summary>
    void Click(Vector2 at)
    {
        if (FloorPoint(at) is not Vector3 p) return;
        if (_build.Tool != null) _build.Place(p);
        else _bridge.Send(new Dictionary<string, object> { ["type"] = "inspect", ["at"] = new[] { p.X, p.Y, p.Z } });
    }

    public override void _UnhandledInput(InputEvent e)
    {
        if (e is InputEventMouseMotion motion && _build.Tool != null && FloorPoint(motion.Position) is Vector3 over) _build.Hover(over, motion.Position);
        if (e is InputEventMouseButton { ButtonIndex: MouseButton.Right, Pressed: false } && _build.Tool != null) _build.Drop();
        // Clicks pick a room; drags turn the camera (CameraRig), so tell them apart by how far the pointer moved.
        if (e is InputEventMouseButton { ButtonIndex: MouseButton.Left } mb)
        {
            if (mb.Pressed)
            {
                _pressAt = mb.Position;
                _pressed = true;
            }
            else if (_pressed)
            {
                _pressed = false;
                if (mb.Position.DistanceTo(_pressAt) < 5) Click(mb.Position);
            }
            return;
        }
        if (e is not InputEventKey { Pressed: true, Echo: false } k) return;
        switch (k.Keycode)
        {
            case Key.Escape when _build.Tool != null: _build.Drop(); break;
            case Key.Escape when _build.Active: _build.Toggle(false); break;
            case Key.Escape when _inspector.Open: Inspect(null); break;
            case Key.B when !_build.Active: _build.Toggle(true); break;
            case Key.R when _build.Tool != null: _build.Rotate(); break;
            case var key when _build.Active && key >= Key.A && key <= Key.Z && _build.PickByKey(((char)key).ToString()): break;
            case Key.Space when _rig?.Walking != true: SetSpeed(_speed == 0 ? 1 : 0); break;
            case Key.Key1: SetSpeed(1); break;
            case Key.Key2: SetSpeed(2); break;
            case Key.Key3: SetSpeed(4); break;
            case Key.Up: if (_topFloor != null) PickFloor(_topFloor == 1 ? null : _topFloor - 1); break;
            case Key.Down: PickFloor((_topFloor ?? 0) + 1); break;
            case Key.Home: PickFloor(null); break;
            case Key.L: _hole.ShowLabels = !_hole.ShowLabels; break;
            case Key.F2: CycleQuality(); break;
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
        mesh.SurfaceSetMaterial(0, Looks.For("rock:ground", new Color("#7a3b22"), 0.95f, 0, false) ?? Dress.For(new StandardMaterial3D { ResourceName = "rock:ground", AlbedoColor = new Color("#7a3b22"), Roughness = 0.95f }));
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
        var layer = _hud = new CanvasLayer();
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
        _qualityButton = new Button { Text = "Graphics", FocusMode = Control.FocusModeEnum.None, TooltipText = "Graphics level (F2): Low, Medium, High, Ultra" };
        _qualityButton.Pressed += CycleQuality;
        bar.AddChild(_qualityButton);

        _status = Text("", 13, new Color(1, 0.93f, 0.85f, 0.85f));
        _status.SetAnchorsPreset(Control.LayoutPreset.BottomLeft);
        _status.Position = new Vector2(12, -52);
        _status.GrowVertical = Control.GrowDirection.Begin;
        layer.AddChild(_status);

        _waiting = Text("", 20, new Color("#f3e6d8"));
        _waiting.HorizontalAlignment = HorizontalAlignment.Center;
        _waiting.AddThemeStyleboxOverride("normal", Panel());
        _waiting.SetAnchorsPreset(Control.LayoutPreset.Center);
        _waiting.GrowHorizontal = Control.GrowDirection.Both;
        _waiting.GrowVertical = Control.GrowDirection.Both;
        layer.AddChild(_waiting);

        var pickerPanel = _pickerPanel = new PanelContainer();
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

    public static StyleBoxFlat Panel() => new()
    {
        BgColor = new Color(0.12f, 0.07f, 0.06f, 0.82f),
        CornerRadiusTopLeft = 8, CornerRadiusTopRight = 8, CornerRadiusBottomLeft = 8, CornerRadiusBottomRight = 8,
        ContentMarginLeft = 12, ContentMarginRight = 12, ContentMarginTop = 8, ContentMarginBottom = 8,
    };
}
