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
    readonly Rig _rig3d = new() { Name = "Rig" };
    readonly Storm _storm = new() { Name = "Storm" };
    readonly RoomEffects _fx = new() { Name = "RoomEffects" };
    readonly Festival _festival = new() { Name = "Festival" };
    readonly Cutaway _cutaway = new() { Name = "Cutaway" };
    readonly Terrain _terrain = new() { Name = "Terrain" };
    readonly PlanView _planView = new() { Name = "Plan" };
    /// <summary>The plan is showing (on, and the map isn't over it).</summary>
    bool PlanShown => ViewSettings.Plan && !_map.Open;
    bool _planSeen;
    /// <summary>Start in the plan view (--plan), for this run.</summary>
    public bool StartPlan { get; set; }
    int PlanFloor => Math.Clamp(_topFloor ?? 1, 1, Math.Max(1, _shape.Floors));
    bool _stormSeen;
    float _dayFraction = -1;
    Inspector _inspector = null!;
    BuildMode _build = null!;
    GameMenu _menu = null!;
    Choices _choices = null!;
    Charts _charts = null!;
    MapView _map = null!;
    NetworkPanel _network = null!;
    ColonyPanel _colony = null!;
    Button _officeButton = null!;
    /// <summary>Ticks in a game day (data/config.json), for "decide within" times.</summary>
    const int TicksPerDay = 240;
    int _speedBeforeMenu = 1;
    int _commandId = 1;
    Vector2 _pressAt;
    bool _pressed;
    CameraRig? _rig;
    WorldEnvironment _env = null!;
    DirectionalLight3D _sun = null!;
    /// <summary>The night's dust glow from overhead: dim, warm, no shadows (with GI on, Godot's ambient light doesn't reach).</summary>
    readonly DirectionalLight3D _glow = new() { Name = "NightGlow", LightColor = new Color(0.85f, 0.62f, 0.5f), ShadowEnabled = false, LightSpecular = 0.1f, LightEnergy = 0 };
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
    int _gameId = -1, _holeId = -1;
    OptionButton _holePicker = null!;
    string _holesKey = "";
    float _light = 1;
    double _clockSeconds, _shadowClock;

    /// <summary>Start-up options from the command line (Main.cs): a floor to pick, first person, and a screenshot then quit.</summary>
    public int? StartFloor { get; set; }
    public bool StartWalking { get; set; }
    /// <summary>Testing: walk ahead this many seconds once on foot.</summary>
    public float StrollSeconds { get; set; }
    /// <summary>Testing: keys to press as a keyboard would, "Tab@3,W@4-7" (a key at 3 s, a key held from 4 to 7 s).</summary>
    public string? Keys { get; set; }
    List<(Key key, double down, double up, bool pressed, bool released)>? _keys;
    readonly List<(Vector2 pos, double at)> _taps = new();
    readonly List<(InputEvent e, double at)> _events = new();
    /// <summary>Stand here in first person: x, y, z, heading in degrees (0 looks along +x), and optionally pitch.</summary>
    public float[]? StandAt { get; set; }
    /// <summary>The bridge's port (npm run bridge -- --port=…).</summary>
    public int Port { get; set; } = 17878;
    /// <summary>Start a bridge if none answers (off with --no-bridge), with these arguments for it (else --continue).</summary>
    public bool StartBridge { get; set; } = true;
    public List<string> BridgeArgs { get; } = new();
    int _bridgePid = -1;
    bool _bridgeTried;
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
        AddChild(_glow);
        _glow.LookAtFromPosition(new Vector3(-20, 100, 35), Vector3.Zero, Vector3.Up);
        _hole = new HoleScene { Name = "Hole" };
        AddChild(_hole);
        AddChild(_rig3d);
        AddChild(_storm);
        AddChild(_fx);
        AddChild(_festival);
        AddChild(_cutaway);
        // The plan under the HUD, over the 3D view (which rests while it's up).
        var planLayer = new CanvasLayer { Layer = 0, Name = "PlanLayer" };
        AddChild(planLayer);
        planLayer.AddChild(_planView);
        _planView.Ghost = () => _build.GhostShape;
        _planView.Outline = () => _inspector.OutlineLines;
        _people = new People { Name = "People" };
        if (!Dev.Off("people")) AddChild(_people);
        if (Dev.Off("sunshadow")) _sun.ShadowEnabled = false;
        if (Dev.Off("msaa")) GetViewport().Msaa3D = Viewport.Msaa.Disabled;
        _ground = new MeshInstance3D { Name = "Ground" };
        AddChild(_ground);
        // The land, once the bridge sends it: under the ground node, so it shows and hides with it.
        _ground.AddChild(_terrain);
        // A camera from the start, so there's a sky while waiting for the game (not a gray screen).
        var asked = ViewSettings.Camera;
        ViewSettings.Load();
        // A camera from the command line (--view=) wins over the saved one, for this run.
        if (asked != Overview.Iso) ViewSettings.Camera = asked;
        if (StartPlan) ViewSettings.Plan = true;
        _rig = new CameraRig(MetaNow()) { Walker = _walker };
        AddChild(_rig);
        _rig.SetMode(ViewSettings.Camera);
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
        // Event cards and the office; the office and the room panel share the right side.
        _choices = new Choices(_hud, SendCommand) { Name = "Choices" };
        AddChild(_choices);
        _charts = new Charts(_hud, m => _bridge.Send(m)) { Name = "Charts" };
        AddChild(_charts);
        _network = new NetworkPanel(_hud, m => _bridge.Send(m)) { Name = "Network" };
        AddChild(_network);
        _colony = new ColonyPanel(_hud, m => _bridge.Send(m)) { Name = "Colony", ShowRoom = id => Inspect(id) };
        AddChild(_colony);
        _map = new MapView(_hud, m => _bridge.Send(m)) { Name = "Map", Toast = t => _build.Toast(t) };
        AddChild(_map);
        // The map has its own layer: the hole's sun doesn't light it.
        _sun.LightCullMask &= ~MapView.MapLayer;
        _glow.LightCullMask &= ~MapView.MapLayer;
        _map.Closed = () =>
        {
            _rig?.MakeCurrent();
            _rig?.SetProcess(true);
            _rig?.SetProcessUnhandledInput(true);
        };
        // The room panel, the office, the charts and the network take turns on the right.
        _choices.OfficeOpened = () =>
        {
            Inspect(null);
            _charts.Toggle(false);
        };
        _charts.Opened = () =>
        {
            Inspect(null);
            _choices.ToggleOffice(false);
            _network.Toggle(false);
            _colony.Toggle(false);
        };
        _network.Opened = () =>
        {
            Inspect(null);
            _choices.ToggleOffice(false);
            _charts.Toggle(false);
            _colony.Toggle(false);
        };
        _colony.Opened = () =>
        {
            Inspect(null);
            _choices.ToggleOffice(false);
            _charts.Toggle(false);
            _network.Toggle(false);
        };
        // The menu over everything; the game pauses while it's open.
        _menu = new GameMenu(m => _bridge.Send(m)) { Name = "Menu", Toast = t => _build.Toast(t) };
        _menu.Shown = open =>
        {
            if (open) _speedBeforeMenu = _speed;
            SetSpeed(open ? 0 : _speedBeforeMenu);
        };
        _hud.AddChild(_menu);
        RenderingServer.ViewportSetMeasureRenderTime(GetViewport().GetViewportRid(), true);
    }

    public override void _ExitTree()
    {
        // A bridge we started stops with us, saving first.
        if (_bridgePid > 0 && OS.IsProcessRunning(_bridgePid))
        {
            _bridge.Send(new Dictionary<string, object> { ["type"] = "quit" });
            for (var i = 0; i < 30 && OS.IsProcessRunning(_bridgePid); i++) System.Threading.Thread.Sleep(50);
            if (OS.IsProcessRunning(_bridgePid)) OS.Kill(_bridgePid);
        }
        _bridge.Dispose();
        Looks.Release();
        Dress.Release();
    }

    double _liveMs;
    readonly Walker _walker = new();
    readonly HashSet<int> _mapsAsked = new();
    int _layoutVersion = -1;
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
        PlayKeys();
        // The rig moves at the game's pace (still when paused).
        _rig3d.Step((float)delta * _speed);
        _fx.Step((float)delta * _speed);
        _festival.Step((float)delta);
        Weather((float)delta);
        MaybeStartBridge();
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
            if (tool.StartsWith("corridor:")) _build.PickCorridor(tool["corridor:".Length..], false, false);
            else _build.Pick(tool);
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
            if (_rig != null) GD.Print($"CAMERA {_rig.Describe()}{(_map.Open ? " map " + _map.Describe() : "")}");
            if (_rig?.Walking == true && GetViewport().GetCamera3D() is Camera3D c) GD.Print($"WALKER onFoot={_rig.OnFoot} floor={_walker.Floor} at=({_walker.At.X:0.00},{_walker.At.Y:0.00}) r={_walker.At.Length():0.00} camera={c.GlobalPosition}");
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
            else if (type == "rig") _rig3d.Set(msg.RootElement);
            else if (type == "terrain")
            {
                _terrain.Set(msg.RootElement);
                // The flat ring was a stand-in.
                _ground.Mesh = null;
            }
            else if (type == "plan")
            {
                _planView.Set(msg.RootElement);
                _planSeen = true;
            }
            else if (type == "fx") _fx.Set(msg.RootElement);
            else if (type == "walkmap" && msg.RootElement.GetProperty("layoutVersion").GetInt32() == _layoutVersion && msg.RootElement.GetProperty("holeId").GetInt32() == _holeId) _walker.SetMap(Walker.Map.Parse(msg.RootElement));
            else if (type == "inspected")
            {
                _inspector.Show(msg.RootElement);
                if (_inspector.Open)
                {
                    _choices.ToggleOffice(false);
                    _charts.Toggle(false);
                    _network.Toggle(false);
                    _colony.Toggle(false);
                }
            }
            else if (type == "office")
            {
                _choices.SetOffice(msg.RootElement);
                _officeButton.Text = _choices.Waiting > 0 ? $"Office · {_choices.Waiting} waiting" : "Office";
                _officeButton.AddThemeColorOverride("font_color", _choices.Waiting > 0 ? new Color("#f0a030") : new Color("#f3e6d8"));
            }
            else if (type == "palette") _build.SetPalette(msg.RootElement);
            else if (type == "hovered" || type == "edgeHovered") _build.Hovered(msg.RootElement);
            else if (type == "notice") _build.Notice(msg.RootElement);
            else if (type == "saves") _menu.SetSaves(msg.RootElement);
            else if (type == "trends") _charts.SetTrends(msg.RootElement);
            else if (type == "map") _map.SetMap(msg.RootElement);
            else if (type == "site") _map.SetSite(msg.RootElement);
            else if (type == "network") _network.Set(msg.RootElement);
            else if (type == "colonyPeople") _colony.SetPeople(msg.RootElement);
            else if (type == "colonyConstruction") _colony.SetConstruction(msg.RootElement);
            else if (type == "colonyMaintenance") _colony.SetMaintenance(msg.RootElement);
            else if (type == "flows") _charts.SetFlows(msg.RootElement);
            else if (type == "saved") _menu.Saved(msg.RootElement);
            else if (type == "loaded")
            {
                var result = msg.RootElement.GetProperty("result");
                _build.Toast(result.GetProperty("ok").GetBoolean() ? "Loaded" : $"Couldn't load: {(result.TryGetProperty("reason", out var why) ? why.GetString() : "unknown")}");
            }
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
            var cutaway = _rig?.Walking != true && _rig?.Mode == Overview.Cutaway;
            var focus = _rig?.Walking == true ? Mathf.FloorToInt((-cam.GlobalPosition.Y - 3) / 4) + 1
                : cutaway ? Math.Max(_topFloor ?? 1, CameraRig.FloorAt(_rig!.CutawayY)) : _topFloor ?? 1;
            // Clicks find what they hit on the floors in view (and the surface, from above).
            _hole.EnsureCollision(new[] { 0, focus - 1, focus, focus + 1 });
            var (above, below) = Graphics.LampFloors(_quality);
            // The cutaway sees a few floors at once, side on.
            if (cutaway) (above, below) = (above + 1, below + 1);
            _hole.UpdateLamps(cam.GlobalPosition, focus - above, focus + below, _rig?.CutPlane ?? default);
        }
        _hole.ShowEdges = _rig?.Walking != true;
        UpdateViewBar();
        ApplyViewToShaders();
        WatchWalking();
        // With the corridor tool, a left drag paints (the right one still turns the camera).
        if (_rig != null)
        {
            _rig.LeftDragTurns = !_build.Painting;
            _rig.KeysMove = !_build.Active;
        }
        AskForMaps();
        if (snapshot != null)
        {
            OnSnapshot(snapshot.RootElement);
            snapshot.Dispose();
        }
        // While there's no game, say why in the middle of the screen, and hide what needs one.
        var waiting = !_bridge.Connected;
        _waiting.Visible = waiting;
        _pickerPanel.Visible = !waiting && _pickerFloors >= 0 && !_map.Open;
        _waiting.Text = _bridge.Silent
            ? $"Something is on port {Port}, but it isn't the game's bridge.\nRun  npm run bridge  in the repo, or start both with --port=<n>."
            : _bridgePid > 0 && OS.IsProcessRunning(_bridgePid) ? "Starting the game…"
            : _bridgePid > 0 ? "The game stopped: see ~/.downtown-mars/bridge.log"
            : $"Waiting for the game on port {Port}…\nRun  npm run bridge  in the repo (add  -- --showcase=12  for a big test colony).";
        _status.Text = _bridge.Silent
            ? $"Something is on port {Port} but it isn't the game's bridge. Run  npm run bridge  in the repo (or both with --port=<n>)."
            : _bridge.Connected
            ? $"{Engine.GetFramesPerSecond()} fps · {RenderingServer.GetRenderingInfo(RenderingServer.RenderingInfo.TotalDrawCallsInFrame)} draw calls · {_hole.Chunks} chunks · {_hole.Lamps} lamps · {(PlanShown ? $"plan, floor {PlanFloor}" : _rig?.OnFoot == true ? $"on foot, floor {_walker.Floor}" : _rig?.Walking == true ? "first person (flying)" : _rig?.ModeName ?? "iso")}\nEsc menu · M map · N network · P colony · O office · C charts · Click a room · B build · Space pause · 1–3 speed · ↑↓ floor · Home all floors · Tab first person · drag or scroll sideways to turn · scroll or pinch to zoom · WASD to move · L labels · F2 graphics · [ ] holes"
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
        // A scene for another floor than ours (the bridge restarted, say), or no plan yet with the plan up: ask again.
        if (sceneFloor != Cut || ViewSettings.Plan && !_planSeen) SendView();
        var t0 = Time.GetTicksMsec();
        _hole.Build(scene);
        _hole.SetNight(1 - _light);
        GD.Print($"Scene built: {_hole.Chunks} chunks, {_hole.Lamps} lamps in {Time.GetTicksMsec() - t0} ms");
        if (!_framed && _rig != null)
        {
            _framed = true;
            _rig.Frame(MetaNow(), true);
            if (StartWalking) _rig.Walk(true);
            _rig.StrollSeconds = StrollSeconds;
            if (StandAt is float[] at && at.Length >= 4) _rig.Stand(new Vector3(at[0], at[1], at[2]), Mathf.DegToRad(at[3]), at.Length > 4 ? Mathf.DegToRad(at[4]) : 0);
        }
    }

    void OnSnapshot(JsonElement msg)
    {
        _speed = msg.GetProperty("speed").GetInt32();
        // A new layout: the walking maps are out of date (ask again as needed).
        var version = msg.GetProperty("snapshot").GetProperty("layoutVersion").GetInt32();
        if (version != _layoutVersion)
        {
            _layoutVersion = version;
            _walker.Forget();
            _mapsAsked.Clear();
        }
        var s = msg.GetProperty("snapshot");
        var gameId = s.GetProperty("gameId").GetInt32();
        var holeId = s.GetProperty("holeId").GetInt32();
        UpdateHolePicker(s, holeId);
        if (gameId != _gameId || holeId != _holeId)
        {
            _gameId = gameId;
            _holeId = holeId;
            // Another game (new, or loaded): nothing from the last one holds.
            _walker.Forget();
            _mapsAsked.Clear();
            _rig?.Unground();
            Inspect(null);
            _rig?.Frame(MetaNow(), true);
        }
        var t = s.GetProperty("time");
        var pop = s.GetProperty("population").GetProperty("count").GetInt32();
        _title.Text = s.GetProperty("holeName").GetString();
        _clock.Text = $"Day {t.GetProperty("day").GetInt32()} · {t.GetProperty("hour").GetInt32():00}:{t.GetProperty("minute").GetInt32():00} · {pop} colonists";
        var res = s.GetProperty("resources");
        _stocks.Text = string.Join("   ", Stocks.Where(k => res.TryGetProperty(k.key, out _)).Select(k => $"{k.name} {res.GetProperty(k.key).GetDouble():0}"));
        for (var i = 0; i < Speeds.Length; i++) _speedButtons[i].ButtonPressed = Speeds[i] == _speed;
        _choices.SetEvents(s, TicksPerDay);
        _rig3d.Place(s.GetProperty("drill"), _shape.Floors, Cut);
        _festival.Sync(s.GetProperty("events").GetProperty("festival").ValueKind == JsonValueKind.Object, _shape, Cut);
        _choices.SetMessages(s, TicksPerDay);
        _storm.SetTarget(s.GetProperty("weather").GetProperty("storm").GetSingle(), !_stormSeen);
        _stormSeen = true;
        _dayFraction = t.GetProperty("dayFraction").GetSingle();
    }

    /// <summary>The hour's light, as the web game's (stage3d.ts updateSky): the sun crosses once a day, the sky dims at night and in a storm.</summary>
    void Daylight(float f, float storm)
    {
        // The sky's base colours by the hour; the storm (Storm.cs) thickens them to murk.
        _light = f > 0.25f && f < 0.75f ? Mathf.Sin(Mathf.Pi * (f - 0.25f) / 0.5f) : 0;
        var a = (f - 0.25f) * Mathf.Tau;
        var pos = new Vector3(Mathf.Cos(a) * 100, Mathf.Max(5, Mathf.Sin(a) * 100), 30);
        _sun.LookAtFromPosition(pos, Vector3.Zero, Vector3.Up);
        _sun.LightEnergy = (0.15f + 2.0f * _light) * (1 - 0.7f * storm);
        var env = _env.Environment;
        // Nights stay readable: as the sky darkens, the ambient light turns to the dust's dim glow, never black.
        env.AmbientLightEnergy = (0.12f + 0.16f * _light) * (1 - 0.4f * storm);
        env.AmbientLightSkyContribution = Graphics.SkyShare * Mathf.Lerp(0.35f, 1f, _light);
        _glow.LightEnergy = 0.35f * (1 - _light) * (1 - 0.5f * storm);
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

    /// <summary>Each frame: the hour's light, then the storm on top of it (eased, as the web's).</summary>
    void Weather(float dt)
    {
        if (_dayFraction < 0) return;
        Daylight(_dayFraction, _storm.Level);
        _storm.Step(dt, _light, _env.Environment, GetViewport().GetCamera3D(), Cut == null && _rig?.Walking != true && !_map.Open);
    }

    /// <summary>
    /// With no game answering after a moment, start one: the bridge in Node, from the repo, through a login
    /// shell (for Node on the PATH), its output in ~/.downtown-mars/bridge.log. It goes when the viewer does.
    /// </summary>
    void MaybeStartBridge()
    {
        if (!StartBridge || _bridgeTried || _clockSeconds < 1.5 || _bridge.Connected || _bridge.Silent) return;
        _bridgeTried = true;
        var repo = ProjectSettings.GlobalizePath("res://").TrimEnd('/');
        repo = System.IO.Path.GetDirectoryName(repo)!;
        var args = BridgeArgs.Count > 0 ? BridgeArgs : new List<string> { "--continue" };
        var line = $"export PATH=\"/opt/homebrew/bin:/usr/local/bin:$PATH\"; mkdir -p ~/.downtown-mars && cd '{repo}' && exec node scripts/bridge.mjs --port={Port} {string.Join(" ", args)} > ~/.downtown-mars/bridge.log 2>&1";
        _bridgePid = OS.CreateProcess("/bin/zsh", new[] { "-lc", line });
        GD.Print(_bridgePid > 0 ? $"Started the game (bridge, pid {_bridgePid}); its log: ~/.downtown-mars/bridge.log" : "Couldn't start the bridge: run  npm run bridge  in the repo");
    }

    /// <summary>Feed the test keys (--keys) to Godot's input, as a keyboard would.</summary>
    void PlayKeys()
    {
        if (Keys == null) return;
        _keys ??= Keys.Split(',').Select(k =>
        {
            var (name, when) = (k.Split('@')[0], k.Split('@')[1].Split('-'));
            // "pan:dx:dy@t", "pinch:factor@t", "wheel:up|down|left|right@t": what a trackpad or Magic Mouse, a pinch, and a wheel send.
            if (name.StartsWith("pan:") || name.StartsWith("pinch:") || name.StartsWith("wheel:"))
            {
                var p = name.Split(':');
                InputEvent ev = p[0] switch
                {
                    "pan" => new InputEventPanGesture { Delta = new Vector2(float.Parse(p[1]), float.Parse(p[2])), Position = new Vector2(800, 500) },
                    "pinch" => new InputEventMagnifyGesture { Factor = float.Parse(p[1]), Position = new Vector2(800, 500) },
                    _ => new InputEventMouseButton { Pressed = true, Factor = 1, Position = new Vector2(800, 500), ButtonIndex = p[1] switch { "up" => MouseButton.WheelUp, "down" => MouseButton.WheelDown, "left" => MouseButton.WheelLeft, _ => MouseButton.WheelRight } },
                };
                _events.Add((ev, double.Parse(when[0])));
                return (Key.None, double.MaxValue, double.MaxValue, true, true);
            }
            // "tap:x:y@t": a left click at that screen point (as a mouse would), through the UI too.
            if (name.StartsWith("tap:"))
            {
                var xy = name.Split(':');
                _taps.Add((new Vector2(float.Parse(xy[1]), float.Parse(xy[2])), double.Parse(when[0])));
                return (Key.None, double.MaxValue, double.MaxValue, true, true);
            }
            var down = double.Parse(when[0]);
            var up = when.Length > 1 ? double.Parse(when[1]) : down + 0.1;
            return (OS.FindKeycodeFromString(name), down, up, false, false);
        }).ToList();
        for (var t = _events.Count - 1; t >= 0; t--)
        {
            if (_clockSeconds < _events[t].at) continue;
            Input.ParseInputEvent(_events[t].e);
            _events.RemoveAt(t);
        }
        for (var t = _taps.Count - 1; t >= 0; t--)
        {
            if (_clockSeconds < _taps[t].at) continue;
            foreach (var down in new[] { true, false })
                Input.ParseInputEvent(new InputEventMouseButton { ButtonIndex = MouseButton.Left, Pressed = down, Position = _taps[t].pos, GlobalPosition = _taps[t].pos, ButtonMask = down ? MouseButtonMask.Left : 0 });
            _taps.RemoveAt(t);
        }
        for (var i = 0; i < _keys.Count; i++)
        {
            var k = _keys[i];
            if (!k.pressed && _clockSeconds >= k.down)
            {
                Input.ParseInputEvent(new InputEventKey { Keycode = k.key, PhysicalKeycode = k.key, Pressed = true });
                k.pressed = true;
            }
            if (k.pressed && !k.released && _clockSeconds >= k.up)
            {
                Input.ParseInputEvent(new InputEventKey { Keycode = k.key, PhysicalKeycode = k.key, Pressed = false });
                k.released = true;
            }
            _keys[i] = k;
        }
    }

    /// <summary>In first person, the walking maps for the floor you're on and those above and below (stairs go there).</summary>
    void AskForMaps()
    {
        if (_rig?.Walking != true || !_bridge.Connected || _layoutVersion < 0) return;
        var here = _rig.OnFoot ? _walker.Floor : CameraRig.FloorAt(GetViewport().GetCamera3D()?.GlobalPosition.Y ?? -5);
        for (var f = here - 1; f <= here + 1; f++)
        {
            if (f < 1 || f > _shape.Floors || _walker.Has(f) || !_mapsAsked.Add(f)) continue;
            _bridge.Send(new Dictionary<string, object> { ["type"] = "walkmap", ["floor"] = f });
        }
    }

    /// <summary>The hole picker: every hole by name and head count, shown once there's more than one.</summary>
    void UpdateHolePicker(JsonElement s, int holeId)
    {
        var holes = s.GetProperty("holes").EnumerateArray().Select(h => (id: h.GetProperty("id").GetInt32(), name: h.GetProperty("name").GetString()!, pop: h.GetProperty("population").GetInt32())).ToList();
        var key = string.Join("|", holes.Select(h => $"{h.id}:{h.name}:{h.pop}")) + $">{holeId}";
        if (key == _holesKey) return;
        _holesKey = key;
        _holePicker.Clear();
        foreach (var h in holes) _holePicker.AddItem($"{h.name} · {h.pop}", h.id);
        _holePicker.Select(holes.FindIndex(h => h.id == holeId));
        _holePicker.Visible = holes.Count > 1;
        _title.Visible = holes.Count <= 1;
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

    /// <summary>
    /// Pick a floor (null for all). In Iso the hole is cut there: everything above is left out. In first
    /// person nothing is cut (you're inside); picking a floor takes you to its gallery instead.
    /// </summary>
    void PickFloor(int? floor)
    {
        if (floor != null) floor = Math.Clamp(floor.Value, 1, Math.Max(1, _shape.Floors));
        if (floor == _topFloor && _rig?.Walking != true) return;
        _topFloor = floor;
        if (ViewSettings.Plan) SendView();
        if (_rig?.Walking == true) GoToFloor(floor ?? 1);
        else _rig?.Frame(MetaNow(), false);
        ApplyCut();
        foreach (var b in _floorPicker.GetChildren().OfType<Button>())
        {
            var f = b.GetMeta("floor").AsInt32();
            b.ButtonPressed = f == -1 ? floor == null : f == floor;
        }
    }

    /// <summary>The cut the scene shows: the picked floor in Iso, none in first person.</summary>
    int? Cut => _rig?.Walking == true ? null : _topFloor;
    int? _cutSent = -1;

    /// <summary>Show the cut: the scene (from the bridge), the ground, people and occluders.</summary>
    void ApplyCut()
    {
        var cut = Cut;
        _ground.Visible = cut == null;
        _people.SetTopFloor(cut);
        _fx.SetTopFloor(cut);
        if (cut == _cutSent) return;
        _cutSent = cut;
        BuildOccluders();
        SendView();
    }

    /// <summary>What the bridge builds the scene for: the cut, and room colours on or off.</summary>
    void SendView() => _bridge.Send(new Dictionary<string, object?> { ["type"] = "view", ["topFloor"] = Cut, ["roomColors"] = ViewSettings.RoomColors, ["plan"] = ViewSettings.Plan ? PlanFloor : null });

    /// <summary>The plan on or off (a 3D camera, or first person, turns it off).</summary>
    void SetPlan(bool on)
    {
        if (on == ViewSettings.Plan) return;
        ViewSettings.Plan = on;
        ViewSettings.Save();
        _planView.Refit();
        SendView();
    }

    // ---- the View bar ----

    readonly Dictionary<string, Button> _viewButtons = new();

    /// <summary>The View bar: the cameras, then walls down and room colours (as the web's View mode).</summary>
    void BuildViewBar(VBoxContainer rows)
    {
        var bar = new HBoxContainer();
        bar.AddThemeConstantOverride("separation", 4);
        rows.AddChild(bar);
        var label = Text("View", 14, new Color("#c9b29c"));
        bar.AddChild(label);
        Button Add(string id, string text, string tip, System.Action pressed)
        {
            var b = new Button { Text = text, ToggleMode = true, FocusMode = Control.FocusModeEnum.None, TooltipText = tip };
            b.AddThemeFontSizeOverride("font_size", 13);
            b.Pressed += pressed;
            bar.AddChild(b);
            _viewButtons[id] = b;
            return b;
        }
        Add("iso", "Iso", "One floor from above and off to one side (pick the floor on the right; drag to turn, scroll to zoom)", () => SetCamera(Overview.Iso));
        Add("cutaway", "Cutaway", "Look at the hole from outside, sliced open (scroll up and down to move along it)", () => SetCamera(Overview.Cutaway));
        Add("top", "Top", "Look straight down the shaft", () => SetCamera(Overview.Top));
        Add("walk", "First person", "Walk the galleries, corridors and public spaces (Tab)", () =>
        {
            SetPlan(false);
            _rig?.Walk(true);
        });
        Add("plan", "Plan", "One floor seen from above, drawn flat (pick the floor on the right; drag or scroll sideways to turn, scroll or pinch to zoom)", () => SetPlan(true));
        bar.AddChild(new VSeparator());
        Add("walls", "Walls down", "Walls between the camera and the rooms behind them lowered to a stub, as in The Sims (not in first person)", () =>
        {
            ViewSettings.WallsDown = !ViewSettings.WallsDown;
            ViewSettings.Save();
        });
        Add("colors", "Room colours", "Rooms in their category's colour, or (off) in what they're built from: rock, marscrete, brick, metal", () =>
        {
            ViewSettings.RoomColors = !ViewSettings.RoomColors;
            ViewSettings.Save();
            SendView();
        });
    }

    /// <summary>
    /// Each frame: the cutaway's cut and walls down for every surface's shader (view.gdshaderinc), the
    /// cutaway's backdrop and cut face, and the floor occluders (whole slabs, which would hide what the
    /// cutaway shows below them).
    /// </summary>
    void ApplyViewToShaders()
    {
        var walking = _rig?.Walking == true;
        var cut = _rig?.CutPlane ?? Vector4.Zero;
        RenderingServer.GlobalShaderParameterSet("cut_plane", cut);
        RenderingServer.GlobalShaderParameterSet("walls_down", ViewSettings.WallsDown && !walking ? 1f : 0f);
        _hole.SetCut(cut);
        if (GetViewport().GetCamera3D() is Camera3D view) _hole.UpdateWalls(ViewSettings.WallsDown && !walking, view.GlobalPosition);
        var cutaway = cut.W > 0.5f;
        _cutaway.Show(cutaway, _shape, _rig?.Heading ?? 0, Cut == null);
        if (_occluders != null) _occluders.Visible = !cutaway;
    }

    void SetCamera(Overview mode)
    {
        SetPlan(false);
        ViewSettings.Camera = mode;
        ViewSettings.Save();
        _rig?.SetMode(mode);
    }

    /// <summary>The View bar shows what's on (it can change by key, Tab, too).</summary>
    void UpdateViewBar()
    {
        var plan = ViewSettings.Plan;
        var walking = _rig?.Walking == true && !plan;
        var mode = _rig?.Mode ?? Overview.Iso;
        _viewButtons["iso"].ButtonPressed = !plan && !walking && mode == Overview.Iso;
        _viewButtons["cutaway"].ButtonPressed = !plan && !walking && mode == Overview.Cutaway;
        _viewButtons["top"].ButtonPressed = !plan && !walking && mode == Overview.Top;
        _viewButtons["walk"].ButtonPressed = walking;
        _viewButtons["plan"].ButtonPressed = plan;
        _viewButtons["walls"].ButtonPressed = ViewSettings.WallsDown;
        // Walls down is for the 3D overview cameras.
        _viewButtons["walls"].Disabled = walking || plan;
        // While the plan's up, the 3D view and its camera rest (the map has its own).
        var shown = PlanShown;
        _planView.Visible = shown;
        GetViewport().Disable3D = shown;
        if (_rig != null)
        {
            _rig.SetProcess(!shown && !_map.Open);
            _rig.SetProcessUnhandledInput(!shown && !_map.Open);
        }
        _viewButtons["colors"].ButtonPressed = ViewSettings.RoomColors;
    }

    /// <summary>First person: to a floor's gallery, finding your feet there once its walking map is in.</summary>
    void GoToFloor(int floor)
    {
        _rig?.Frame(new Meta { Hole = _shape, Cut = floor }, true);
        _rig?.Unground();
    }

    bool _wasWalking;

    /// <summary>Into first person with a floor picked: start on it; and in or out, show the right cut.</summary>
    void WatchWalking()
    {
        var walking = _rig?.Walking == true;
        if (walking == _wasWalking) return;
        _wasWalking = walking;
        if (walking && _topFloor is int f && !_rig!.OnFoot) GoToFloor(f);
        ApplyCut();
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
        // The plan: the floor it shows, at standing height.
        if (PlanShown)
        {
            var w = _planView.ToWorld(at);
            return new Vector3(w.X, -3 - PlanFloor * _shape.FloorHeightM + 0.5f, w.Y);
        }
        if (GetViewport().GetCamera3D() is not Camera3D cam) return null;
        var from = cam.ProjectRayOrigin(at);
        var dir = cam.ProjectRayNormal(at);
        var floor = _rig?.Walking == true ? Mathf.FloorToInt((-cam.GlobalPosition.Y - 3) / 4) + 1 : _topFloor ?? 1;
        var y = _build.HasTool && _build.SurfaceTool && _topFloor == null ? 0.2f : -3 - floor * _shape.FloorHeightM + 0.5f;
        if (Mathf.Abs(dir.Y) < 1e-4f) return null;
        var t = (y - from.Y) / dir.Y;
        return t > 0 ? from + dir * t : null;
    }

    /// <summary>A click (not a drag): build with the room in hand, or show the room under the pointer.</summary>
    void Click(Vector2 at)
    {
        if (_build.HasTool)
        {
            if (FloorPoint(at) is Vector3 p) _build.Place(p);
            return;
        }
        if ((RoomPoint(at) ?? FloorPoint(at)) is Vector3 q) _bridge.Send(new Dictionary<string, object> { ["type"] = "inspect", ["at"] = new[] { q.X, q.Y, q.Z } });
    }

    /// <summary>
    /// What the pointer is on, by a ray against the hole's surfaces: a point just inside it, at its floor's
    /// standing height, so the bridge finds the room (a wall's far side is the room behind it). Null if it hits nothing.
    /// </summary>
    Vector3? RoomPoint(Vector2 at)
    {
        if (PlanShown) return null;
        if (GetViewport().GetCamera3D() is not Camera3D cam) return null;
        var from = cam.ProjectRayOrigin(at);
        var dir = cam.ProjectRayNormal(at);
        var hit = GetWorld3D().DirectSpaceState.IntersectRay(PhysicsRayQueryParameters3D.Create(from, from + dir * 2000));
        if (hit.Count == 0) return null;
        var p = (Vector3)hit["position"];
        var n = (Vector3)hit["normal"];
        // On a floor (facing up): a little above it. On a wall: through it, then at standing height on its floor.
        if (n.Y > 0.7f) return p + Vector3.Up * 0.5f;
        var flat = new Vector3(dir.X, 0, dir.Z).Normalized();
        var q = p + flat * 0.4f;
        var floor = Mathf.FloorToInt((-p.Y - 3) / 4) + 1;
        return new Vector3(q.X, -3 - floor * _shape.FloorHeightM + 0.5f, q.Z);
    }

    /// <summary>The map open or shut (M): the hole's camera rests while it's open, and the panels on the right close.</summary>
    void ToggleMap()
    {
        var open = !_map.Open;
        if (open)
        {
            Inspect(null);
            _choices.ToggleOffice(false);
            _charts.Toggle(false);
            _network.Toggle(false);
            _build.Toggle(false);
            _rig?.SetProcess(false);
            _rig?.SetProcessUnhandledInput(false);
        }
        _map.Show(open);
    }

    public override void _UnhandledInput(InputEvent e)
    {
        // With the map open, the pointer turns and picks on the globe; keys still work.
        if (_map.Open && e is InputEventMouse or InputEventGesture)
        {
            _map.HandleInput(e);
            return;
        }
        // The plan: scroll or pinch zooms, sideways (or a drag) turns; clicks go on as in 3D.
        if (PlanShown)
        {
            if (ScrollInput.Read(e, out var scroll, out var zoom))
            {
                _planView.TurnBy(scroll.X * 0.003f);
                _planView.ZoomBy(Mathf.Exp(-scroll.Y * 0.0015f) * zoom);
                return;
            }
            if (e is InputEventMouseMotion pm && (pm.ButtonMask & (_build.Painting ? MouseButtonMask.Right : MouseButtonMask.Left | MouseButtonMask.Right)) != 0)
                _planView.TurnBy(pm.Relative.X * 0.005f);
        }
        _build.ShiftErase = Input.IsKeyPressed(Key.Shift);
        if (e is InputEventMouseMotion motion && _build.HasTool && FloorPoint(motion.Position) is Vector3 over)
        {
            _build.Hover(over, motion.Position);
            // Dragging with the corridor tool paints along the borders crossed.
            if (_build.Painting && (motion.ButtonMask & MouseButtonMask.Left) != 0) _build.Paint(over);
        }
        if (e is InputEventMouseButton { ButtonIndex: MouseButton.Right, Pressed: false } && _build.HasTool) _build.Drop();
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
                _build.EndPaint();
                if (mb.Position.DistanceTo(_pressAt) < 5) Click(mb.Position);
            }
            return;
        }
        if (e is not InputEventKey { Pressed: true, Echo: false } k) return;
        switch (k.Keycode)
        {
            case Key.Tab when PlanShown:
                SetPlan(false);
                _rig?.Walk(true);
                break;
            case Key.Escape when _menu.Visible: _menu.Close(); break;
            case Key.Escape when _map.Open: ToggleMap(); break;
            case Key.M when !_build.Active: ToggleMap(); break;
            case Key.N when !_build.Active: _network.Toggle(); break;
            case Key.P when !_build.Active: _colony.Toggle(); break;
            case Key.Escape when _colony.Open: _colony.Toggle(false); break;
            case Key.Escape when _network.Open: _network.Toggle(false); break;
            case Key.Escape when _build.HasTool: _build.Drop(); break;
            case Key.Escape when _build.Active: _build.Toggle(false); break;
            case Key.Escape when _inspector.Open: Inspect(null); break;
            case Key.Escape when _choices.OfficeOpen: _choices.ToggleOffice(false); break;
            case Key.Escape when _charts.Open: _charts.Toggle(false); break;
            case Key.Escape: _menu.Open(); break;
            case Key.B when !_build.Active: _build.Toggle(true); break;
            case Key.R when _build.HasTool: _build.Rotate(); break;
            case Key.Space when _rig?.Walking != true: SetSpeed(_speed == 0 ? 1 : 0); break;
            case Key.Key1: SetSpeed(1); break;
            case Key.Key2: SetSpeed(2); break;
            case Key.Key3: SetSpeed(4); break;
            // In first person, up and down a floor from where you are; in Iso, the picked floor up and down.
            case Key.Up when _rig?.Walking == true: PickFloor(Math.Max(1, (_rig.OnFoot ? _walker.Floor : _topFloor ?? 1) - 1)); break;
            case Key.Down when _rig?.Walking == true: PickFloor((_rig.OnFoot ? _walker.Floor : _topFloor ?? 1) + 1); break;
            case Key.Up: if (_topFloor != null) PickFloor(_topFloor == 1 ? null : _topFloor - 1); break;
            case Key.Down: PickFloor((_topFloor ?? 0) + 1); break;
            case Key.Home: PickFloor(null); break;
            case var key when _build.Active && key >= Key.A && key <= Key.Z && key != Key.R && _build.PickByKey(((char)key).ToString()): break;
            case Key.L: _hole.ShowLabels = !_hole.ShowLabels; break;
            case Key.O: _choices.ToggleOffice(); break;
            case Key.C when _rig?.Walking != true || _rig.OnFoot: _charts.Toggle(); break;
            case Key.F2: CycleQuality(); break;
            // The previous or next hole (as the picker).
            case Key.Bracketleft or Key.Bracketright when _holePicker.ItemCount > 1:
                var next = (_holePicker.Selected + (k.Keycode == Key.Bracketright ? 1 : _holePicker.ItemCount - 1)) % _holePicker.ItemCount;
                _bridge.Send(new Dictionary<string, object> { ["type"] = "setActiveHole", ["holeId"] = (int)_holePicker.GetItemId(next) });
                break;
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
        // The bridge's terrain replaces this stand-in.
        if (_terrain.HoleId >= 0) return;
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
        for (var f = Cut ?? 1; f <= _shape.Floors; f++)
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
        // With more than one hole, the title is a picker: the hole in view.
        _holePicker = new OptionButton { Visible = false, FocusMode = Control.FocusModeEnum.None, TooltipText = "The hole in view" };
        _holePicker.AddThemeFontSizeOverride("font_size", 18);
        _holePicker.AddThemeColorOverride("font_color", new Color("#e8834a"));
        _holePicker.ItemSelected += i => _bridge.Send(new Dictionary<string, object> { ["type"] = "setActiveHole", ["holeId"] = (int)_holePicker.GetItemId((int)i) });
        bar.AddChild(_holePicker);
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
        BuildViewBar(rows);
        var menuButton = new Button { Text = "☰ Menu", FocusMode = Control.FocusModeEnum.None, TooltipText = "Save, load, new game (Esc)" };
        menuButton.Pressed += () => _menu.Open();
        bar.AddChild(menuButton);
        bar.MoveChild(menuButton, 0);
        _officeButton = new Button { Text = "Office", FocusMode = Control.FocusModeEnum.None, TooltipText = "Visits, promises, ordinances and notables" };
        _officeButton.Pressed += () => _choices.ToggleOffice();
        bar.AddChild(_officeButton);
        var mapButton = new Button { Text = "Map", FocusMode = Control.FocusModeEnum.None, TooltipText = "Mars, your holes and where to found the next (M)" };
        mapButton.Pressed += ToggleMap;
        bar.AddChild(mapButton);
        var networkButton = new Button { Text = "Network", FocusMode = Control.FocusModeEnum.None, TooltipText = "Holes, culture, opinion and trade routes (N)" };
        networkButton.Pressed += () => _network.Toggle();
        bar.AddChild(networkButton);
        var colonyButton = new Button { Text = "Colony", FocusMode = Control.FocusModeEnum.None, TooltipText = "People, construction and maintenance (P)" };
        colonyButton.Pressed += () => _colony.Toggle();
        bar.AddChild(colonyButton);
        var chartsButton = new Button { Text = "Charts", FocusMode = Control.FocusModeEnum.None, TooltipText = "Trends and flows (C)" };
        chartsButton.Pressed += () => _charts.Toggle();
        bar.AddChild(chartsButton);
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
