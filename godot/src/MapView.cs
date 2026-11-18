using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// The map of Mars, as the web's (ui/MapScreen.tsx and Globe.tsx): a globe wearing the planet's real colour
/// (data/mars-relief.jpg, the web's own) on ground raised by MOLA's heights (public/map/height.png), sharper tiles
/// (public/map/tiles/) laid over the part in view as you zoom in, a thin atmosphere on the limb, the deposits you
/// know of, the IAU's names, your holes, convoys, routes with their rovers, and colonists moving. Drag to turn, wheel
/// to zoom; the pointer's place shows at the bottom; a click picks a site, whose report (from the
/// bridge's network.ts) says what's there and whether a hole can be founded, with the button to send
/// a convoy. Drawn on its own render layer with its own camera, far from the hole.
/// </summary>
public partial class MapView : Node3D
{
    const float R = 10, MarsKm = 3389.5f;
    /// <summary>The names, as the web's GLOBE.names: how big on screen (px) a feature must be to be named, and the most at once.</summary>
    const float NameMinPx = 40;
    const int NameMost = 30;
    const uint Layer = 1 << 10;
    const int TexW = 4096, TexH = 2048;
    /// <summary>
    /// The relief, as the web's GLOBE.relief: the heights exaggerated tenfold (a radius is 3,396 km, so Olympus
    /// Mons' 21 km would be a 0.6% bump), and the height map's range in metres (its 0 and 255, as build-map.py writes it).
    /// </summary>
    const float Exaggerate = 10, HeightMin = -8500, HeightMax = 21500, RadiusM = 3396190;
    /// <summary>The tiles, as the web's GLOBE.tiles: degrees each, laid on within 2.7 radii, up to 80 kept, a few read from disk a frame.</summary>
    const int TileDeg = 15, TileRows = 180 / TileDeg, TileCols = 360 / TileDeg, TileKeep = 80, TileLoadsPerFrame = 3;
    const float TileWithin = 2.7f;
    /// <summary>The base sphere's grid: a tile's square is exactly 16 × 16 of its cells, so a tile's corners sit on its vertices.</summary>
    const int SphereW = 384, SphereH = 192, TileSeg = 16;
    /// <summary>The atmosphere, as the web's GLOBE.atmosphere: its thickness (radii), dust low down and ice haze up high, the band's brightness and the veil's.</summary>
    const float AirThickness = 0.025f, AirGlow = 1.05f, AirVeil = 0.35f;
    static readonly Color AirDust = new("#e6c3a0"), AirHigh = new("#d8e6f4");
    /// <summary>Where the sun sits seen from the camera (as the web's, which turns the globe under a fixed camera and sun).</summary>
    static readonly Vector3 SunFromCamera = new Vector3(-3, 2, 4).Normalized();

    readonly Action<object> _send;
    readonly Camera3D _cam = new() { Fov = 40, CullMask = Layer, Current = false };
    readonly MeshInstance3D _globe = new() { Layers = Layer };
    readonly Node3D _marks = new();
    readonly MeshInstance3D _lines = new() { Layers = Layer, CastShadow = GeometryInstance3D.ShadowCastingSetting.Off };
    readonly MeshInstance3D _pick = new() { Layers = Layer, Visible = false };
    readonly ShaderMaterial _globeMaterial = new();
    readonly DirectionalLight3D _sun = new() { LightEnergy = 1.1f, LightCullMask = Layer, ShadowEnabled = false };
    readonly ShaderMaterial _haze = new(), _veil = new();
    Shader _globeShader = null!;
    /// <summary>The deposits, painted on a clear planet-sized layer the base sphere and every tile wear over their colour.</summary>
    ImageTexture? _overlay;
    /// <summary>The heights (public/map/height.png, 1440 × 720, 8-bit), for the shader and for lifting the marks and pointing.</summary>
    Image _height = null!;
    ImageTexture _heightTex = null!;
    readonly Dictionary<string, MeshInstance3D> _tiles = new();
    readonly List<string> _tileOrder = new();
    float _yaw, _pitch = 0.3f, _dist = 34;
    /// <summary>How close the camera comes, in radii (as the web's: 1.16, was 1.25), now there's relief and tiles to see.</summary>
    const float MinDistance = 1.16f;
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
    /// <summary>Where the polar caps start (degrees of latitude, data/mars-map.json): no holes from there (T-073).</summary>
    float _capNorth = 80, _capSouth = 83;
    const string IceCap = "Ice cap: can't dig here";
    bool OnIceCap(float lat) => lat >= _capNorth || lat <= -_capSouth;
    int _ew, _eh;
    readonly List<(string name, float lat, float lon, string kind)> _features = new();
    /// <summary>Site traits (#430, data/sites.json): name and where, tried in order, the first match wins (sim/sites.ts traitAt).</summary>
    readonly List<(string name, float? absLatMin, float? absLatMax, string? near, float nearDeg)> _traits = new();
    /// <summary>The holes' sites and their own traits (from the bridge's map): near one, a place shows that hole's (siteTraitFor).</summary>
    List<(float lat, float lon, string? trait)> _holeTraits = new();
    float _holeSiteDeg;
    List<(string kind, float lat, float lon, float r)> _deposits = new();
    readonly Dictionary<string, string> _depositNames = new();

    public bool Open => _ui.Visible;
    public string Describe() => $"yaw={Mathf.RadToDeg(_yaw):0} dist={_dist:0.0} tiles={TilesShown} names={_namePool.Count(l => l.Visible)} at={LatLon(_cam.Position).lat:0},{LatLon(_cam.Position).lon:0}";
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
        // The sun turns with the camera, as the web's stays put while the globe turns under it.
        AddChild(_sun);

        LoadData();
        _globe.Mesh = Patch(90, -90, 0, 360, SphereW, SphereH, false);
        _globe.ExtraCullMargin = R * Lift(HeightMax);
        _globeShader = GD.Load<Shader>("res://shaders/globe.gdshader");
        _globeMaterial.Shader = _globeShader;
        Relief(_globeMaterial, _reliefImage, 0);
        _globe.MaterialOverride = _globeMaterial;
        BuildAir();
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
        using (var doc = JsonDocument.Parse(System.IO.File.ReadAllText(root + "mars-map.json")))
        {
            var caps = doc.RootElement.GetProperty("caps");
            _capNorth = caps.GetProperty("north").GetSingle();
            _capSouth = caps.GetProperty("south").GetSingle();
        }
        using (var doc = JsonDocument.Parse(System.IO.File.ReadAllText(root + "mars-features.json")))
            foreach (var f in doc.RootElement.GetProperty("features").EnumerateArray())
                _features.Add((f.GetProperty("name").GetString()!, f.GetProperty("lat").GetSingle(), f.GetProperty("lon").GetSingle(), f.GetProperty("kind").GetString()!));
        using (var doc = JsonDocument.Parse(System.IO.File.ReadAllText(root + "sites.json")))
            foreach (var t in doc.RootElement.GetProperty("traits").EnumerateArray())
            {
                var w = t.GetProperty("where");
                float? Num(string k) => w.TryGetProperty(k, out var v) ? v.GetSingle() : null;
                _traits.Add((t.GetProperty("name").GetString()!, Num("absLatMin"), Num("absLatMax"), w.TryGetProperty("near", out var n) ? n.GetString() : null, Num("nearDeg") ?? 0));
            }
        _reliefImage = ImageTexture.CreateFromImage(Relief());
        _height = Image.LoadFromFile(ProjectSettings.GlobalizePath("res://") + "../public/map/height.png");
        _height.Convert(Image.Format.L8);
        _heightTex = ImageTexture.CreateFromImage(_height);
        // The IAU's names (#499, data/mars-names.json, the web's), biggest first.
        using (var doc = JsonDocument.Parse(System.IO.File.ReadAllText(root + "mars-names.json")))
            foreach (var f in doc.RootElement.GetProperty("names").EnumerateArray())
            {
                var kind = f.GetProperty("kind").GetString();
                _names.Add((f.GetProperty("name").GetString()!, kind is "terra" or "planitia" or "planum" or "vastitas" or "palus",
                    f.GetProperty("km").GetSingle(), f.GetProperty("lat").GetSingle(), f.GetProperty("lon").GetSingle()));
            }
    }

    readonly List<(string name, bool region, float km, float lat, float lon)> _names = new();
    readonly Control _nameLayer = new() { MouseFilter = Control.MouseFilterEnum.Ignore };
    readonly List<Label> _namePool = new();

    /// <summary>
    /// The names, as the web's: flat labels over the globe, the biggest features that would be at least 40 px
    /// across at this zoom and face the camera, at most 30, none overlapping, the big regions in spaced capitals.
    /// </summary>
    void UpdateNames()
    {
        var size = GetViewport().GetVisibleRect().Size;
        var focal = size.Y / 2 / MathF.Tan(Mathf.DegToRad(_cam.Fov / 2));
        var height = _dist / R - 1;
        var toward = _cam.Position.Normalized();
        var boxes = new List<Rect2>();
        var n = 0;
        foreach (var f in _names)
        {
            if (n >= NameMost) break;
            if (f.km / 2 / MarsKm * focal / height < NameMinPx) break;
            if (At(f.lat, f.lon, 1).Dot(toward) < 0.25f) continue;
            var at = _cam.UnprojectPosition(GlobalPosition + Ground(f.lat, f.lon, 0.004f));
            if (at.X < 0 || at.Y < 0 || at.X > size.X || at.Y > size.Y) continue;
            var bw = f.name.Length * (f.region ? 9 : 7) + 10;
            var box = new Rect2(at.X - bw / 2f, at.Y - 9, bw, 18);
            if (boxes.Any(b => b.Intersects(box))) continue;
            boxes.Add(box);
            if (n == _namePool.Count)
            {
                var made = new Label { MouseFilter = Control.MouseFilterEnum.Ignore };
                made.AddThemeConstantOverride("outline_size", 4);
                made.AddThemeColorOverride("font_outline_color", new Color(0.08f, 0.04f, 0.03f, 0.75f));
                made.AddThemeColorOverride("font_shadow_color", new Color(0.08f, 0.04f, 0.03f, 0.85f));
                made.AddThemeConstantOverride("shadow_offset_y", 1);
                _nameLayer.AddChild(made);
                _namePool.Add(made);
            }
            var label = _namePool[n++];
            label.Text = f.region ? string.Join(" ", f.name.ToUpperInvariant().ToCharArray()) : f.name;
            label.AddThemeFontSizeOverride("font_size", f.region ? 12 : 11);
            label.AddThemeColorOverride("font_color", f.region ? new Color(1f, 0.925f, 0.84f, 0.86f) : new Color("#f6efe6"));
            label.ResetSize();
            label.Position = at - label.Size / 2;
            label.Visible = true;
        }
        for (var i = n; i < _namePool.Count; i++) _namePool[i].Visible = false;
    }

    float ElevationAt(float lat, float lon)
    {
        var y = Math.Clamp((int)MathF.Floor(90 - lat), 0, _eh - 1);
        var x = ((int)MathF.Floor(Wrap(lon)) % _ew + _ew) % _ew;
        return _elevation[y * _ew + x];
    }

    static float Wrap(float lon) => ((lon % 360) + 360) % 360;

    /// <summary>
    /// The planet's picture (data/mars-relief.jpg, 4096 × 2048: its real colour from USGS's Viking mosaic, shaded
    /// by MOLA's relief, #499, made by scripts/build-map.py; the web's own), as big as the texture.
    /// </summary>
    Image Relief()
    {
        var img = Image.LoadFromFile(ProjectSettings.GlobalizePath("res://") + "../data/mars-relief.jpg");
        img.Resize(TexW, TexH, Image.Interpolation.Cubic);
        img.Convert(Image.Format.Rgba8);
        return img;
    }

    ImageTexture _reliefImage = null!;

    /// <summary>A layer's material: its colour, the heights and the deposits' overlay, and how far over the ground it sits.</summary>
    void Relief(ShaderMaterial m, Texture2D albedo, float lift)
    {
        m.SetShaderParameter("albedo_tex", albedo);
        m.SetShaderParameter("height_tex", _heightTex);
        m.SetShaderParameter("overlay_tex", _overlay);
        m.SetShaderParameter("radius", R);
        m.SetShaderParameter("relief_scale", (HeightMax - HeightMin) / RadiusM * Exaggerate);
        m.SetShaderParameter("relief_zero", -HeightMin / (HeightMax - HeightMin));
        m.SetShaderParameter("relief_on", 1f);
        m.SetShaderParameter("height_px", new Vector2(1f / _height.GetWidth(), 1f / _height.GetHeight()));
        m.SetShaderParameter("lift", lift);
    }

    /// <summary>How far a height (metres) raises the ground, in radii, exaggerated as the shader does.</summary>
    static float Lift(float m) => m / RadiusM * Exaggerate;

    /// <summary>The height map's metres at a place (nearest pixel, as the web's pointing reads it).</summary>
    float HeightAt(float lat, float lon)
    {
        int w = _height.GetWidth(), h = _height.GetHeight();
        var x = Math.Clamp((int)(Wrap(lon) / 360 * w), 0, w - 1);
        var y = Math.Clamp((int)((90 - lat) / 180 * h), 0, h - 1);
        return HeightMin + _height.GetPixel(x, y).R * (HeightMax - HeightMin);
    }

    /// <summary>A point on the raised ground, a little above it (in radii), for the marks, lines and names.</summary>
    Vector3 Ground(float lat, float lon, float above) => At(lat, lon, R * (1 + above + Lift(HeightAt(lat, lon))));

    Vector3 Ground(Vector3 dir, float above)
    {
        var (lat, lon) = LatLon(dir);
        return Ground(lat, lon, above);
    }

    /// <summary>The deposits (as the web's ellipses, wider toward the poles), on the clear overlay over the planet.</summary>
    void Paint(JsonElement deposits)
    {
        var img = Image.CreateEmpty(TexW, TexH, false, Image.Format.Rgba8);
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
                    // Over whatever's painted there already, as the web's did on the planet's own colour.
                    var under = img.GetPixel(x, y);
                    var a = edge ? 0.9f : 0.33f;
                    var outA = a + under.A * (1 - a);
                    var rgb = (new Vector3(color.R, color.G, color.B) * a + new Vector3(under.R, under.G, under.B) * under.A * (1 - a)) / outA;
                    img.SetPixel(x, y, new Color(rgb.X, rgb.Y, rgb.Z, outA));
                }
        }
        img.GenerateMipmaps();
        if (_overlay == null)
        {
            _overlay = ImageTexture.CreateFromImage(img);
            _globeMaterial.SetShaderParameter("overlay_tex", _overlay);
            foreach (var t in _tiles.Values) ((ShaderMaterial)t.MaterialOverride).SetShaderParameter("overlay_tex", _overlay);
        }
        else _overlay.Update(img);
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

    /// <summary>
    /// A patch of sphere from one latitude to another (north first) and one longitude to another (east of the
    /// first), on a grid of w × h cells. UV2 is the whole planet's (for the heights and the overlay); UV is the
    /// same, or the patch's own square for a tile.
    /// </summary>
    static ArrayMesh Patch(float lat0, float lat1, float lon0, float lon1, int w, int h, bool ownUv)
    {
        var verts = new List<Vector3>();
        var norms = new List<Vector3>();
        var uvs = new List<Vector2>();
        var uv2s = new List<Vector2>();
        for (var j = 0; j <= h; j++)
            for (var i = 0; i <= w; i++)
            {
                float lat = lat0 + (lat1 - lat0) * j / h, lon = lon0 + (lon1 - lon0) * i / w;
                var p = At(lat, lon);
                verts.Add(p);
                norms.Add(p.Normalized());
                var whole = new Vector2(lon / 360, (90 - lat) / 180);
                uv2s.Add(whole);
                uvs.Add(ownUv ? new Vector2((float)i / w, (float)j / h) : whole);
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
        arrays[(int)Mesh.ArrayType.TexUV2] = uv2s.ToArray();
        arrays[(int)Mesh.ArrayType.Index] = index.ToArray();
        var mesh = new ArrayMesh();
        mesh.AddSurfaceFromArrays(Mesh.PrimitiveType.Triangles, arrays);
        return mesh;
    }

    // ---- the atmosphere ----

    /// <summary>The air, as the web's: a thin band of haze hugging the limb, and a faint veil of dust over the disc's edge.</summary>
    void BuildAir()
    {
        void Air(ShaderMaterial m, string shader, float r)
        {
            m.Shader = GD.Load<Shader>(shader);
            m.SetShaderParameter("dust", AirDust);
            m.SetShaderParameter("high", AirHigh);
            AddChild(new MeshInstance3D
            {
                Mesh = new SphereMesh { Radius = r, Height = r * 2, RadialSegments = 96, Rings = 48 },
                MaterialOverride = m,
                Layers = Layer,
                CastShadow = GeometryInstance3D.ShadowCastingSetting.Off,
            });
        }
        Air(_haze, "res://shaders/globe_haze.gdshader", R * (1 + AirThickness));
        _haze.SetShaderParameter("edge", MathF.Sqrt(1 - 1 / ((1 + AirThickness) * (1 + AirThickness))));
        _haze.SetShaderParameter("glow", AirGlow);
        Air(_veil, "res://shaders/globe_veil.gdshader", R * 1.003f);
        _veil.SetShaderParameter("strength", AirVeil);
    }

    // ---- the tiles ----

    /// <summary>
    /// The tiles (public/map/tiles/<row>_<col>.jpg, 15° squares at 32 px a degree, from the north and from 0°E), as
    /// the web's: once the camera is within 2.7 radii, those facing it within what can be seen from there are laid
    /// over the base sphere, a hair above it; the 80 most recent are kept.
    /// </summary>
    void UpdateTiles()
    {
        var want = new HashSet<string>();
        if (_dist < R * TileWithin)
        {
            var toward = _cam.Position.Normalized();
            var reach = MathF.Acos(Math.Min(1, R / _dist)) + 0.25f;
            for (var row = 0; row < TileRows; row++)
                for (var col = 0; col < TileCols; col++)
                    if (At(90 - (row + 0.5f) * TileDeg, (col + 0.5f) * TileDeg, 1).AngleTo(toward) < reach + 0.19f) want.Add($"{row}_{col}");
        }
        foreach (var (key, tile) in _tiles) tile.Visible = want.Contains(key);
        var loads = 0;
        foreach (var key in want)
        {
            if (_tiles.ContainsKey(key)) continue;
            if (loads++ >= TileLoadsPerFrame) break;
            var path = ProjectSettings.GlobalizePath("res://") + $"../public/map/tiles/{key}.jpg";
            if (!System.IO.File.Exists(path)) continue;
            var img = Image.LoadFromFile(path);
            img.GenerateMipmaps();
            var parts = key.Split('_');
            int row = int.Parse(parts[0]), col = int.Parse(parts[1]);
            var m = new ShaderMaterial { Shader = _globeShader };
            Relief(m, ImageTexture.CreateFromImage(img), 0.0006f);
            var mesh = new MeshInstance3D
            {
                Mesh = Patch(90 - row * TileDeg, 90 - (row + 1) * TileDeg, col * TileDeg, (col + 1) * TileDeg, TileSeg, TileSeg, true),
                MaterialOverride = m,
                Layers = Layer,
                ExtraCullMargin = R * Lift(HeightMax),
                CastShadow = GeometryInstance3D.ShadowCastingSetting.Off,
            };
            AddChild(mesh);
            _tiles[key] = mesh;
            _tileOrder.Add(key);
            // Keep the most recent; let the oldest out of view go.
            while (_tileOrder.Count > TileKeep)
            {
                var old = _tileOrder.Find(k => !want.Contains(k));
                if (old == null) break;
                _tileOrder.Remove(old);
                _tiles[old].QueueFree();
                _tiles.Remove(old);
            }
        }
    }

    /// <summary>How many tiles are laid on now (for test runs).</summary>
    public int TilesShown => _tiles.Values.Count(t => t.Visible);

    // ---- open and close ----

    /// <summary>Waiting to face the hole in view once the bridge says where it is.</summary>
    bool _faceHome;

    public void Show(bool on, (float lat, float lon)? focus = null)
    {
        _faceHome = on && focus == null;
        Visible = on;
        _ui.Visible = on;
        _nameLayer.Visible = on;
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
        UpdateTiles();
        UpdateNames();
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
        var sun = _cam.Basis * SunFromCamera;
        _sun.Basis = Basis.LookingAt(-sun, Mathf.Abs(sun.Y) > 0.99f ? Vector3.Forward : Vector3.Up);
        _haze.SetShaderParameter("sun_dir", sun);
        _veil.SetShaderParameter("sun_dir", sun);
    }

    /// <summary>
    /// Where on the globe a screen point is, or null off it. The ground is raised, so the ray meets a sphere at
    /// the height found where it last met, a few times over (as the web's).
    /// </summary>
    (float lat, float lon)? GlobeAt(Vector2 screen)
    {
        var from = _cam.ProjectRayOrigin(screen) - GlobalPosition;
        var dir = _cam.ProjectRayNormal(screen);
        var radius = R;
        Vector3? hit = null;
        for (var i = 0; i < 4; i++)
        {
            var b = from.Dot(dir);
            var c = from.LengthSquared() - radius * radius;
            var disc = b * b - c;
            if (disc < 0) break;
            var t = -b - MathF.Sqrt(disc);
            if (t < 0) break;
            hit = from + dir * t;
            var (la, lo) = LatLon(hit.Value);
            radius = R * (1 + Lift(HeightAt(la, lo)));
        }
        return hit is Vector3 h ? LatLon(h) : null;
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
            _dist = Math.Clamp(_dist / zoom, R * MinDistance, R * 5);
            Apply();
        }
        if (e is InputEventMouseButton { ButtonIndex: MouseButton.Left } mb)
        {
            if (mb.Pressed) _press = mb.Position;
            else if (_press is Vector2 p && p.DistanceTo(mb.Position) < 5 && GlobeAt(mb.Position) is var (lat, lon))
            {
                // The caps refuse a hole; the footer under the pointer already says so.
                if (!OnIceCap(lat)) PickSite(lat, lon);
                _press = null;
            }
        }
    }

    public void PickSite(float lat, float lon)
    {
        _site = (lat, lon);
        _pick.Position = Ground(lat, lon, 0.003f);
        _pick.Basis = Basis.LookingAt(-_pick.Position.Normalized(), Mathf.Abs(lat) > 80 ? Vector3.Forward : Vector3.Up) * new Basis(Vector3.Right, Mathf.Pi / 2);
        _pick.Visible = true;
        _send(new Dictionary<string, object> { ["type"] = "site", ["lat"] = lat, ["lon"] = lon });
    }

    /// <summary>The place under the pointer: where, how high, what's near, and what's in the ground.</summary>
    void Readout(Vector2 screen)
    {
        if (GlobeAt(screen) is not var (lat, lon))
        {
            _footer.Text = "Colour: USGS Viking mosaic. Elevation: NASA MGS MOLA. Names: IAU. Deposits differ every game.";
            return;
        }
        var near = _features.Select(f => (f.name, km: Km(lat, lon, f.lat, f.lon))).MinBy(f => f.km);
        var here = _deposits.Where(d => Degrees(lat, lon, d.lat, d.lon) <= d.r).Select(d => _depositNames.GetValueOrDefault(d.kind, d.kind).ToLower()).Distinct().ToList();
        var trait = OnIceCap(lat) ? null : TraitAt(lat, lon);
        _footer.Text = $"{Math.Abs(lat):0.0}°{(lat >= 0 ? "N" : "S")} {lon:0.0}°E · {ElevationAt(lat, lon):#,0} m · {(near.km < 600 ? near.name : $"{near.km:#,0} km from {near.name}")}{(here.Count > 0 ? " · " + string.Join(", ", here) : "")}{(trait != null ? $" · {trait.ToLower()} site" : "")}{(OnIceCap(lat) ? " · " + IceCap : "")}";
    }

    /// <summary>A place's trait name, as the web's siteTraitFor: a hole's own near one, else the first trait whose where matches, else none.</summary>
    string? TraitAt(float lat, float lon)
    {
        foreach (var h in _holeTraits)
            if (Degrees(lat, lon, h.lat, h.lon) < _holeSiteDeg) return h.trait;
        var a = Math.Abs(lat);
        foreach (var t in _traits)
        {
            if (t.absLatMin is float min && a < min) continue;
            if (t.absLatMax is float max && a > max) continue;
            if (t.near != null && !_features.Any(f => f.kind == t.near && Degrees(lat, lon, f.lat, f.lon) <= t.nearDeg)) continue;
            return t.name;
        }
        return null;
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
        _holeTraits = m.GetProperty("holes").EnumerateArray()
            .Select(h => (h.GetProperty("lat").GetSingle(), h.GetProperty("lon").GetSingle(), h.TryGetProperty("trait", out var t) && t.ValueKind == JsonValueKind.String ? t.GetString() : null)).ToList();
        _holeSiteDeg = m.TryGetProperty("holeSiteDeg", out var hd) ? hd.GetSingle() : 0;
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
                im.SurfaceAddVertex(Ground(pa.Slerp(pb, (float)i / steps), 0.004f));
                im.SurfaceSetColor(color);
                im.SurfaceAddVertex(Ground(pa.Slerp(pb, (float)(i + 1) / steps), 0.004f));
            }
        }
        (float lat, float lon) Place(JsonElement p) => (p.GetProperty("lat").GetSingle(), p.GetProperty("lon").GetSingle());
        Vector3 Along((float lat, float lon) a, (float lat, float lon) b, float t) => Ground(At(a.lat, a.lon, 1).Slerp(At(b.lat, b.lon, 1), t), 0.006f);

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
            Tag(Ground(b.lat, b.lon, 0.02f), c.GetProperty("label").GetString()!, new Color("#ffffff"));
        }
        foreach (var mg in m.GetProperty("migrations").EnumerateArray())
            Dot(Along(Place(mg.GetProperty("from")), Place(mg.GetProperty("to")), mg.GetProperty("at").GetSingle()), new Color("#b48ad8"), 0.07f);
        foreach (var h in m.GetProperty("holes").EnumerateArray())
        {
            float hl = h.GetProperty("lat").GetSingle(), hn = h.GetProperty("lon").GetSingle();
            var p = Ground(hl, hn, 0.004f);
            var here = h.GetProperty("here").GetBoolean();
            Dot(p, here ? new Color("#e07a3f") : new Color("#f6efe6"), 0.14f);
            Tag(Ground(hl, hn, 0.03f), h.GetProperty("name").GetString()!, here ? new Color("#ffd8b8") : new Color("#ffffff"), 52);
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
            // The same size on screen however close (as at the camera's starting distance), now the camera comes in to 1.16 radii.
            Text = text, Position = at, Layers = Layer, FontSize = size, PixelSize = 0.004f / 24, FixedSize = true, OutlineSize = 10,
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
        // The site's trait (#430), as the web's map: what it eases and what it stresses.
        _siteRows.AddChild(Text("The site", 15, Body));
        if (s.TryGetProperty("trait", out var trait) && trait.ValueKind == JsonValueKind.Object)
        {
            _siteRows.AddChild(Text($"{trait.GetProperty("name").GetString()}. {trait.GetProperty("blurb").GetString()}", 12, Body));
            _siteRows.AddChild(Text($"▲ {trait.GetProperty("eases").GetString()}", 12, new Color("#9fcf86")));
            _siteRows.AddChild(Text($"▼ {trait.GetProperty("stresses").GetString()}", 12, new Color("#e0a060")));
        }
        else _siteRows.AddChild(Text("An ordinary site: nothing eased, nothing stressed.", 12, Muted));
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
        // The names lie under the HUD and the map's panels, as the web's sit on the globe.
        _nameLayer.SetAnchorsPreset(Control.LayoutPreset.FullRect);
        _nameLayer.Visible = false;
        hud.AddChild(_nameLayer);
        hud.MoveChild(_nameLayer, 0);
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
        _footer.Text = "Colour: USGS Viking mosaic. Elevation: NASA MGS MOLA. Names: IAU. Deposits differ every game.";
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
