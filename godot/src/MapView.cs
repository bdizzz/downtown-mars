using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// The map of Mars, as the web's (ui/MapScreen.tsx and Globe.tsx): a globe wearing MOLA relief
/// (data/mars-relief.jpg, the web's own; heights from data/mars-elevation.json), the deposits you know of, named
/// features, your holes, convoys, routes with their rovers, and colonists moving. Drag to turn, wheel
/// to zoom; the pointer's place shows at the bottom; a click picks a site, whose report (from the
/// bridge's network.ts) says what's there and whether a hole can be founded, with the button to send
/// a convoy. Drawn on its own render layer with its own camera, far from the hole.
/// </summary>
public partial class MapView : Node3D
{
    const float R = 10, MarsKm = 3389.5f;
    const uint Layer = 1 << 10;
    const int TexW = 4096, TexH = 2048;

    readonly Action<object> _send;
    readonly Camera3D _cam = new() { Fov = 40, CullMask = Layer, Current = false };
    readonly MeshInstance3D _globe = new() { Layers = Layer };
    readonly Node3D _marks = new();
    readonly MeshInstance3D _lines = new() { Layers = Layer, CastShadow = GeometryInstance3D.ShadowCastingSetting.Off };
    readonly MeshInstance3D _pick = new() { Layers = Layer, Visible = false };
    readonly StandardMaterial3D _globeMaterial = new() { Roughness = 1 };
    Image _relief = null!;
    float _yaw, _pitch = 0.3f, _dist = 34;
    string _depositsKey = "";
    (float lat, float lon)? _site;
    Vector2? _press;

    // The panel: header, legend, lock note; the site report; and the footer under the pointer.
    readonly Control _ui = new();
    readonly Label _footer = new(), _locked = new();
    readonly PanelContainer _sitePanel = new();
    PanelContainer _topPanel = null!;

    /// <summary>Where the HUD's top bar ends: the map's panels sit just below it.</summary>
    public float Top
    {
        set
        {
            if (_topPanel != null) _topPanel.Position = _topPanel.Position with { Y = value };
            _sitePanel.Position = _sitePanel.Position with { Y = value };
        }
    }
    readonly VBoxContainer _siteRows = new();

    // For the pointer readout.
    float[] _elevation = Array.Empty<float>();
    int _ew, _eh;
    readonly List<(string name, float lat, float lon)> _features = new();
    List<(string kind, float lat, float lon, float r)> _deposits = new();
    readonly Dictionary<string, string> _depositNames = new();

    public bool Open => _ui.Visible;
    public string Describe() => $"yaw={Mathf.RadToDeg(_yaw):0} dist={_dist:0.0}";
    /// <summary>The render layer the map is drawn on (the hole's cameras and lights leave it out).</summary>
    public const uint MapLayer = Layer;
    public Action? Closed { get; set; }
    public Action<string>? Toast { get; set; }
    int _id = 3_000_000;

    public MapView(CanvasLayer hud, Action<object> send)
    {
        _send = send;
        Position = new Vector3(0, 50000, 0);
        AddChild(_cam);
        AddChild(_globe);
        AddChild(_marks);
        AddChild(_lines);
        AddChild(_pick);
        // Space behind the globe, and a sun of its own.
        _cam.Environment = new Godot.Environment
        {
            BackgroundMode = Godot.Environment.BGMode.Color,
            BackgroundColor = new Color(0.03f, 0.02f, 0.03f),
            AmbientLightSource = Godot.Environment.AmbientSource.Color,
            AmbientLightColor = new Color(0.9f, 0.85f, 0.8f),
            AmbientLightEnergy = 0.55f,
            TonemapMode = Godot.Environment.ToneMapper.Filmic,
        };
        var sun = new DirectionalLight3D { LightEnergy = 1.1f, LightCullMask = Layer, ShadowEnabled = false };
        AddChild(sun);
        sun.LookAtFromPosition(new Vector3(-30, 20, 30), Vector3.Zero, Vector3.Up);

        LoadData();
        _globe.Mesh = Sphere();
        _globe.MaterialOverride = _globeMaterial;
        _pick.Mesh = new TorusMesh { InnerRadius = 0.18f, OuterRadius = 0.26f, Rings = 24, RingSegments = 6 };
        _pick.MaterialOverride = new StandardMaterial3D { AlbedoColor = new Color("#e07a3f"), ShadingMode = BaseMaterial3D.ShadingModeEnum.Unshaded };

        BuildUi(hud);
        Visible = false;
    }

    // ---- data and the texture ----

    void LoadData()
    {
        var root = ProjectSettings.GlobalizePath("res://") + "../data/";
        using (var doc = JsonDocument.Parse(System.IO.File.ReadAllText(root + "mars-elevation.json")))
        {
            var e = doc.RootElement;
            _ew = e.GetProperty("width").GetInt32();
            _eh = e.GetProperty("height").GetInt32();
            var unit = e.GetProperty("unitMeters").GetSingle();
            _elevation = e.GetProperty("elevation").EnumerateArray().Select(v => v.GetSingle() * unit).ToArray();
        }
        using (var doc = JsonDocument.Parse(System.IO.File.ReadAllText(root + "mars-features.json")))
            foreach (var f in doc.RootElement.GetProperty("features").EnumerateArray())
                _features.Add((f.GetProperty("name").GetString()!, f.GetProperty("lat").GetSingle(), f.GetProperty("lon").GetSingle()));
        _relief = Relief();
        foreach (var f in _features)
        {
            var label = new Label3D
            {
                Text = f.name, Layers = Layer, FontSize = 40, PixelSize = 0.0035f, OutlineSize = 8,
                Modulate = new Color("#f6efe6"), OutlineModulate = new Color(0.08f, 0.04f, 0.03f, 0.7f),
                Billboard = BaseMaterial3D.BillboardModeEnum.Enabled, NoDepthTest = false,
            };
            label.Position = At(f.lat, f.lon, R * 1.004f);
            AddChild(label);
        }
    }

    float ElevationAt(float lat, float lon)
    {
        var y = Math.Clamp((int)MathF.Floor(90 - lat), 0, _eh - 1);
        var x = ((int)MathF.Floor(Wrap(lon)) % _ew + _ew) % _ew;
        return _elevation[y * _ew + x];
    }

    static float Wrap(float lon) => ((lon % 360) + 360) % 360;

    /// <summary>
    /// The shaded relief (data/mars-relief.jpg, 8 px a degree, drawn by scripts/build-relief.mjs as the
    /// web's map uses it: coloured by height, lit from the north-west, the polar caps), as big as the texture.
    /// </summary>
    Image Relief()
    {
        var img = Image.LoadFromFile(ProjectSettings.GlobalizePath("res://") + "../data/mars-relief.jpg");
        img.Resize(TexW, TexH, Image.Interpolation.Cubic);
        img.Convert(Image.Format.Rgba8);
        return img;
    }

    /// <summary>The relief with the deposits painted on (as the web's ellipses, wider toward the poles).</summary>
    void Paint(JsonElement deposits)
    {
        var img = (Image)_relief.Duplicate();
        var pxPerDeg = TexW / 360f;
        foreach (var d in deposits.EnumerateArray())
        {
            float lat = d.GetProperty("lat").GetSingle(), lon = d.GetProperty("lon").GetSingle(), r = d.GetProperty("radiusDeg").GetSingle();
            var color = new Color(d.GetProperty("color").GetString()!);
            float cx = Wrap(lon) / 360 * TexW, cy = (90 - lat) / 180 * TexH;
            float ry = r * pxPerDeg, rx = ry / Math.Max(0.2f, MathF.Cos(Mathf.DegToRad(lat)));
            for (var y = (int)(cy - ry - 2); y <= cy + ry + 2; y++)
                for (var xi = (int)(cx - rx - 2); xi <= cx + rx + 2; xi++)
                {
                    if (y < 0 || y >= TexH) continue;
                    var x = ((xi % TexW) + TexW) % TexW;
                    float dx = (xi - cx) / rx, dy = (y - cy) / ry, q = MathF.Sqrt(dx * dx + dy * dy);
                    if (q > 1.02f) continue;
                    var edge = q > 0.94f;
                    var under = img.GetPixel(x, y);
                    img.SetPixel(x, y, under.Lerp(color, edge ? 0.9f : 0.33f));
                }
        }
        img.GenerateMipmaps();
        _globeMaterial.AlbedoTexture = ImageTexture.CreateFromImage(img);
    }

    // ---- the globe's geometry: lat/lon as the texture's, east to the right seen from outside ----

    static Vector3 At(float lat, float lon, float r = R)
    {
        float φ = Mathf.DegToRad(lat), λ = Mathf.DegToRad(lon);
        return new Vector3(MathF.Cos(φ) * MathF.Cos(λ), MathF.Sin(φ), -MathF.Cos(φ) * MathF.Sin(λ)) * r;
    }

    static (float lat, float lon) LatLon(Vector3 p)
    {
        var n = p.Normalized();
        return (Mathf.RadToDeg(MathF.Asin(n.Y)), Wrap(Mathf.RadToDeg(MathF.Atan2(-n.Z, n.X))));
    }

    static ArrayMesh Sphere()
    {
        const int w = 128, h = 64;
        var verts = new List<Vector3>();
        var norms = new List<Vector3>();
        var uvs = new List<Vector2>();
        for (var j = 0; j <= h; j++)
            for (var i = 0; i <= w; i++)
            {
                float lat = 90 - 180f * j / h, lon = 360f * i / w;
                var p = At(lat, lon);
                verts.Add(p);
                norms.Add(p.Normalized());
                uvs.Add(new Vector2((float)i / w, (float)j / h));
            }
        var index = new List<int>();
        for (var j = 0; j < h; j++)
            for (var i = 0; i < w; i++)
            {
                int a = j * (w + 1) + i, b = a + 1, c = a + w + 1, d = c + 1;
                // Clockwise seen from outside (Godot's front).
                index.AddRange(new[] { a, c, b, b, c, d });
            }
        var arrays = new Godot.Collections.Array();
        arrays.Resize((int)Mesh.ArrayType.Max);
        arrays[(int)Mesh.ArrayType.Vertex] = verts.ToArray();
        arrays[(int)Mesh.ArrayType.Normal] = norms.ToArray();
        arrays[(int)Mesh.ArrayType.TexUV] = uvs.ToArray();
        arrays[(int)Mesh.ArrayType.Index] = index.ToArray();
        var mesh = new ArrayMesh();
        mesh.AddSurfaceFromArrays(Mesh.PrimitiveType.Triangles, arrays);
        return mesh;
    }

    // ---- open and close ----

    /// <summary>Waiting to face the hole in view once the bridge says where it is.</summary>
    bool _faceHome;

    public void Show(bool on, (float lat, float lon)? focus = null)
    {
        _faceHome = on && focus == null;
        Visible = on;
        _ui.Visible = on;
        _cam.Current = on;
        if (on)
        {
            if (focus is var (lat, lon))
            {
                _yaw = Mathf.DegToRad(lon);
                _pitch = Mathf.DegToRad(Math.Clamp(lat, -70, 70));
            }
            Apply();
            _send(new Dictionary<string, object> { ["type"] = "map" });
        }
        else Closed?.Invoke();
    }

    double _clock, _asked;

    public override void _Process(double delta)
    {
        if (!Visible) return;
        _clock += delta;
        if (_clock - _asked > 1)
        {
            _asked = _clock;
            _send(new Dictionary<string, object> { ["type"] = "map" });
            if (_site is var (lat, lon)) _send(new Dictionary<string, object> { ["type"] = "site", ["lat"] = lat, ["lon"] = lon });
        }
    }

    void Apply()
    {
        var dir = new Vector3(MathF.Cos(_pitch) * MathF.Cos(_yaw), MathF.Sin(_pitch), -MathF.Cos(_pitch) * MathF.Sin(_yaw));
        _cam.Position = dir * _dist;
        _cam.LookAt(GlobalPosition, Vector3.Up);
    }

    /// <summary>Where on the globe a screen point is, or null off it.</summary>
    (float lat, float lon)? GlobeAt(Vector2 screen)
    {
        var from = _cam.ProjectRayOrigin(screen) - GlobalPosition;
        var dir = _cam.ProjectRayNormal(screen);
        var b = from.Dot(dir);
        var c = from.LengthSquared() - R * R;
        var disc = b * b - c;
        if (disc < 0) return null;
        var t = -b - MathF.Sqrt(disc);
        return t < 0 ? null : LatLon(from + dir * t);
    }

    public void HandleInput(InputEvent e)
    {
        if (!Visible) return;
        if (e is InputEventMouseMotion m)
        {
            if ((m.ButtonMask & (MouseButtonMask.Left | MouseButtonMask.Right)) != 0)
            {
                // Turn the globe under the pointer, slower when close.
                var k = 0.004f * (_dist - R) / 24;
                _yaw -= m.Relative.X * k;
                _pitch = Math.Clamp(_pitch + m.Relative.Y * k, -1.4f, 1.4f);
                Apply();
            }
            Readout(m.Position);
        }
        // As the web's globe: sideways scrolling spins the planet, up and down (or a pinch) zooms; any device (ScrollInput.cs).
        if (ScrollInput.Read(e, out var scroll, out var zoom))
        {
            if (Math.Abs(scroll.X) > Math.Abs(scroll.Y)) _yaw += scroll.X * 0.003f * (_dist - R) / 24;
            else _dist *= MathF.Exp(scroll.Y * 0.0015f);
            _dist = Math.Clamp(_dist / zoom, R * 1.25f, R * 5);
            Apply();
        }
        if (e is InputEventMouseButton { ButtonIndex: MouseButton.Left } mb)
        {
            if (mb.Pressed) _press = mb.Position;
            else if (_press is Vector2 p && p.DistanceTo(mb.Position) < 5 && GlobeAt(mb.Position) is var (lat, lon))
            {
                PickSite(lat, lon);
                _press = null;
            }
        }
    }

    public void PickSite(float lat, float lon)
    {
        _site = (lat, lon);
        _pick.Position = At(lat, lon, R * 1.003f);
        _pick.Basis = Basis.LookingAt(-_pick.Position.Normalized(), Mathf.Abs(lat) > 80 ? Vector3.Forward : Vector3.Up) * new Basis(Vector3.Right, Mathf.Pi / 2);
        _pick.Visible = true;
        _send(new Dictionary<string, object> { ["type"] = "site", ["lat"] = lat, ["lon"] = lon });
    }

    /// <summary>The place under the pointer: where, how high, what's near, and what's in the ground.</summary>
    void Readout(Vector2 screen)
    {
        if (GlobeAt(screen) is not var (lat, lon))
        {
            _footer.Text = "Elevation: NASA Mars Global Surveyor MOLA. Deposits differ every game.";
            return;
        }
        var near = _features.Select(f => (f.name, km: Km(lat, lon, f.lat, f.lon))).MinBy(f => f.km);
        var here = _deposits.Where(d => Degrees(lat, lon, d.lat, d.lon) <= d.r).Select(d => _depositNames.GetValueOrDefault(d.kind, d.kind).ToLower()).Distinct().ToList();
        _footer.Text = $"{Math.Abs(lat):0.0}°{(lat >= 0 ? "N" : "S")} {lon:0.0}°E · {ElevationAt(lat, lon):#,0} m · {(near.km < 600 ? near.name : $"{near.km:#,0} km from {near.name}")}{(here.Count > 0 ? " · " + string.Join(", ", here) : "")}";
    }

    static float Degrees(float lat1, float lon1, float lat2, float lon2) => Mathf.RadToDeg(At(lat1, lon1, 1).AngleTo(At(lat2, lon2, 1)));
    static float Km(float lat1, float lon1, float lat2, float lon2) => Mathf.DegToRad(Degrees(lat1, lon1, lat2, lon2)) * MarsKm;

    // ---- what the bridge sends ----

    /// <summary>The bridge's map: deposits (painted on), holes, convoys, routes and migrations (marked).</summary>
    public void SetMap(JsonElement m)
    {
        if (_faceHome)
        {
            _faceHome = false;
            foreach (var h in m.GetProperty("holes").EnumerateArray())
                if (h.GetProperty("here").GetBoolean())
                {
                    _yaw = Mathf.DegToRad(h.GetProperty("lon").GetSingle());
                    _pitch = Mathf.DegToRad(Math.Clamp(h.GetProperty("lat").GetSingle(), -70, 70));
                    Apply();
                }
        }
        var deposits = m.GetProperty("deposits");
        var key = deposits.GetRawText();
        if (key != _depositsKey)
        {
            _depositsKey = key;
            Paint(deposits);
            _deposits = deposits.EnumerateArray().Select(d => (d.GetProperty("kind").GetString()!, d.GetProperty("lat").GetSingle(), d.GetProperty("lon").GetSingle(), d.GetProperty("radiusDeg").GetSingle())).ToList();
            foreach (var l in m.GetProperty("legend").EnumerateArray()) _depositNames[l.GetProperty("kind").GetString()!] = l.GetProperty("name").GetString()!;
            BuildLegend(m.GetProperty("legend"));
        }
        _locked.Text = m.GetProperty("locked").ValueKind == JsonValueKind.String ? m.GetProperty("locked").GetString() : "";
        _locked.Visible = _locked.Text != "";

        foreach (var c in _marks.GetChildren()) c.QueueFree();
        var im = new ImmediateMesh();
        var any = false;
        void Arc((float lat, float lon) a, (float lat, float lon) b, Color color, bool dashed)
        {
            var pa = At(a.lat, a.lon, 1);
            var pb = At(b.lat, b.lon, 1);
            const int steps = 48;
            if (!any) im.SurfaceBegin(Mesh.PrimitiveType.Lines);
            any = true;
            for (var i = 0; i < steps; i++)
            {
                if (dashed && i % 2 == 1) continue;
                im.SurfaceSetColor(color);
                im.SurfaceAddVertex(pa.Slerp(pb, (float)i / steps).Normalized() * R * 1.004f);
                im.SurfaceSetColor(color);
                im.SurfaceAddVertex(pa.Slerp(pb, (float)(i + 1) / steps).Normalized() * R * 1.004f);
            }
        }
        (float lat, float lon) Place(JsonElement p) => (p.GetProperty("lat").GetSingle(), p.GetProperty("lon").GetSingle());
        Vector3 Along((float lat, float lon) a, (float lat, float lon) b, float t) => At(a.lat, a.lon, 1).Slerp(At(b.lat, b.lon, 1), t).Normalized() * R * 1.006f;

        foreach (var r in m.GetProperty("routes").EnumerateArray())
        {
            var a = Place(r.GetProperty("from"));
            var b = Place(r.GetProperty("to"));
            Arc(a, b, new Color(0.44f, 0.7f, 0.79f, 0.8f), false);
            if (r.GetProperty("at").ValueKind == JsonValueKind.Number)
                Dot(Along(a, b, r.GetProperty("at").GetSingle()), r.GetProperty("outbound").GetBoolean() ? new Color("#6fb3c9") : new Color("#9aa7ab"), 0.07f);
        }
        foreach (var c in m.GetProperty("convoys").EnumerateArray())
        {
            if (c.GetProperty("from").ValueKind != JsonValueKind.Object) continue;
            var a = Place(c.GetProperty("from"));
            var b = Place(c.GetProperty("to"));
            Arc(a, b, new Color("#e07a3f"), true);
            Dot(Along(a, b, c.GetProperty("progress").GetSingle()), new Color("#e07a3f"), 0.09f);
            Tag(At(b.lat, b.lon, R * 1.02f), c.GetProperty("label").GetString()!, new Color("#ffffff"));
        }
        foreach (var mg in m.GetProperty("migrations").EnumerateArray())
            Dot(Along(Place(mg.GetProperty("from")), Place(mg.GetProperty("to")), mg.GetProperty("at").GetSingle()), new Color("#b48ad8"), 0.07f);
        foreach (var h in m.GetProperty("holes").EnumerateArray())
        {
            var p = At(h.GetProperty("lat").GetSingle(), h.GetProperty("lon").GetSingle(), R * 1.004f);
            var here = h.GetProperty("here").GetBoolean();
            Dot(p, here ? new Color("#e07a3f") : new Color("#f6efe6"), 0.14f);
            Tag(p.Normalized() * R * 1.03f, h.GetProperty("name").GetString()!, here ? new Color("#ffd8b8") : new Color("#ffffff"), 52);
        }
        if (any) im.SurfaceEnd();
        _lines.Mesh = any ? im : null;
        _lines.MaterialOverride = new StandardMaterial3D { VertexColorUseAsAlbedo = true, ShadingMode = BaseMaterial3D.ShadingModeEnum.Unshaded, Transparency = BaseMaterial3D.TransparencyEnum.Alpha };
    }

    void Dot(Vector3 at, Color color, float r)
    {
        _marks.AddChild(new MeshInstance3D
        {
            Mesh = new SphereMesh { Radius = r, Height = r * 2, RadialSegments = 12, Rings = 6 },
            Position = at,
            Layers = Layer,
            MaterialOverride = new StandardMaterial3D { AlbedoColor = color, ShadingMode = BaseMaterial3D.ShadingModeEnum.Unshaded },
        });
    }

    void Tag(Vector3 at, string text, Color color, int size = 44)
    {
        _marks.AddChild(new Label3D
        {
            Text = text, Position = at, Layers = Layer, FontSize = size, PixelSize = 0.004f, OutlineSize = 10,
            Modulate = color, OutlineModulate = new Color(0.1f, 0.05f, 0.04f, 0.85f), Billboard = BaseMaterial3D.BillboardModeEnum.Enabled,
            Offset = new Vector2(0, 36),
        });
    }

    /// <summary>The bridge's site report: where, what's in the ground, distances, what founding needs, and the button.</summary>
    public void SetSite(JsonElement s)
    {
        foreach (var c in _siteRows.GetChildren())
        {
            _siteRows.RemoveChild(c);
            c.QueueFree();
        }
        var head = new HBoxContainer();
        var title = Text("Site", 18, new Color("#e8834a"));
        title.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        head.AddChild(title);
        var close = new Button { Text = "×", Flat = true, FocusMode = Control.FocusModeEnum.None };
        close.Pressed += () =>
        {
            _site = null;
            _pick.Visible = false;
            _sitePanel.Visible = false;
        };
        head.AddChild(close);
        _siteRows.AddChild(head);
        _siteRows.AddChild(Text(s.GetProperty("where").GetString()!, 14, Body));
        _siteRows.AddChild(Text(s.GetProperty("near").GetString()!, 12, Muted));
        _siteRows.AddChild(Text("In the ground", 15, Body));
        var ground = s.GetProperty("ground");
        if (ground.ValueKind != JsonValueKind.Array) _siteRows.AddChild(Text("Not scouted yet.", 12, Muted));
        else if (ground.GetArrayLength() == 0) _siteRows.AddChild(Text("Nothing special: rock only.", 12, Muted));
        else foreach (var g in ground.EnumerateArray())
                _siteRows.AddChild(Text($"● {g.GetProperty("name").GetString()}: {g.GetProperty("text").GetString()}", 13, new Color(g.GetProperty("color").GetString()!)));
        _siteRows.AddChild(Text("From your holes", 15, Body));
        foreach (var d in s.GetProperty("distances").EnumerateArray()) _siteRows.AddChild(Text(d.GetString()!, 12, Body));
        _siteRows.AddChild(Text("Found a hole here", 15, Body));
        foreach (var c in s.GetProperty("checks").EnumerateArray())
        {
            var ok = c.GetProperty("ok").GetBoolean();
            _siteRows.AddChild(Text($"{(ok ? "✓" : "·")} {c.GetProperty("text").GetString()}", 12, ok ? new Color("#9fd28a") : Muted));
        }
        var found = new Button { Text = s.GetProperty("button").GetString(), Disabled = !s.GetProperty("ready").GetBoolean(), FocusMode = Control.FocusModeEnum.None };
        float lat = s.GetProperty("lat").GetSingle(), lon = s.GetProperty("lon").GetSingle();
        found.Pressed += () => _send(new Dictionary<string, object> { ["type"] = "found", ["id"] = _id++, ["site"] = new Dictionary<string, object> { ["lat"] = lat, ["lon"] = lon } });
        _siteRows.AddChild(found);
        _sitePanel.Visible = true;
    }

    // ---- the overlay ----

    static readonly Color Body = new("#f3e6d8"), Muted = new("#b8a490");
    readonly HBoxContainer _legend = new();

    static Label Text(string text, int size, Color color)
    {
        var l = new Label { Text = text, AutowrapMode = TextServer.AutowrapMode.WordSmart, CustomMinimumSize = new Vector2(300, 0) };
        l.AddThemeFontSizeOverride("font_size", size);
        l.AddThemeColorOverride("font_color", color);
        return l;
    }

    void BuildUi(CanvasLayer hud)
    {
        _ui.SetAnchorsPreset(Control.LayoutPreset.FullRect);
        _ui.MouseFilter = Control.MouseFilterEnum.Ignore;
        _ui.Visible = false;
        hud.AddChild(_ui);
        var top = _topPanel = new PanelContainer { Position = new Vector2(10, 100) };
        top.AddThemeStyleboxOverride("panel", Live.Panel());
        _ui.AddChild(top);
        var rows = new VBoxContainer();
        top.AddChild(rows);
        var head = new HBoxContainer();
        var title = Text("Mars", 22, new Color("#e8834a"));
        title.AutowrapMode = TextServer.AutowrapMode.Off;
        title.CustomMinimumSize = new Vector2(70, 0);
        head.AddChild(title);
        _legend.AddThemeConstantOverride("separation", 10);
        head.AddChild(_legend);
        var close = new Button { Text = "Close map (M)", FocusMode = Control.FocusModeEnum.None };
        close.Pressed += () => Show(false);
        head.AddChild(close);
        rows.AddChild(head);
        _locked.AddThemeColorOverride("font_color", new Color("#f0a030"));
        _locked.AutowrapMode = TextServer.AutowrapMode.WordSmart;
        _locked.CustomMinimumSize = new Vector2(520, 0);
        rows.AddChild(_locked);

        _sitePanel.Visible = false;
        _sitePanel.SetAnchorsPreset(Control.LayoutPreset.TopRight);
        _sitePanel.GrowHorizontal = Control.GrowDirection.Begin;
        _sitePanel.Position = new Vector2(-350, 100);
        _sitePanel.AddThemeStyleboxOverride("panel", Live.Panel());
        _siteRows.AddThemeConstantOverride("separation", 4);
        _sitePanel.AddChild(_siteRows);
        _ui.AddChild(_sitePanel);

        _footer.AddThemeColorOverride("font_color", Body);
        _footer.AddThemeStyleboxOverride("normal", Live.Panel());
        _footer.SetAnchorsPreset(Control.LayoutPreset.CenterBottom);
        _footer.GrowHorizontal = Control.GrowDirection.Both;
        _footer.GrowVertical = Control.GrowDirection.Begin;
        _footer.Position = new Vector2(0, -90);
        _footer.Text = "Elevation: NASA Mars Global Surveyor MOLA. Deposits differ every game.";
        _ui.AddChild(_footer);
    }

    void BuildLegend(JsonElement legend)
    {
        foreach (var c in _legend.GetChildren()) c.QueueFree();
        foreach (var l in legend.EnumerateArray())
        {
            var label = new Label { Text = $"● {l.GetProperty("name").GetString()}", TooltipText = l.GetProperty("hint").GetString(), MouseFilter = Control.MouseFilterEnum.Pass };
            label.AddThemeColorOverride("font_color", new Color(l.GetProperty("color").GetString()!));
            _legend.AddChild(label);
        }
    }
}
