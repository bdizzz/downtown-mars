using Godot;

namespace DowntownMars;

/// <summary>The overview cameras, as the web's (view/cameras.ts): from above and off to one side, the hole sliced open from outside, and straight down the shaft.</summary>
public enum Overview { Iso, Cutaway, Top }

/// <summary>
/// The cameras, as in the web game, sharing one heading round the shaft. Iso: orbiting a point over the
/// hole (drag to turn; scroll sideways to turn and up or down to zoom, or pinch, with a wheel, trackpad or
/// Magic Mouse alike; WASD to pan, Q/E to turn). Cutaway: outside the hole looking in, the near half cut
/// away (drag or scroll sideways to turn, up and down to move up and down the hole, pinch to zoom).
/// Top: straight down the shaft (drag or scroll sideways to turn, up and down or pinch to zoom). First
/// person: on foot (Walker.cs), WASD, drag to look. Tab switches between first person and the overview.
/// The benchmark circles the camera once.
/// </summary>
public partial class CameraRig : Node3D
{
    readonly Camera3D _cam = new() { Fov = 50, Near = 0.1f, Far = 4000 };
    /// <summary>
    /// First person carries a headlamp, as the web's does: soft and warm, a little above and behind the
    /// eyes so near walls don't flare, no shadows. Off in Iso.
    /// </summary>
    readonly OmniLight3D _headlamp = new()
    {
        LightColor = new Color(1f, 0.9f, 0.78f),
        LightEnergy = 1.4f,
        OmniRange = 13,
        OmniAttenuation = 1.6f,
        Position = new Vector3(0, 0.4f, 0.6f),
        ShadowEnabled = false,
        LightSpecular = 0.3f,
        Visible = false,
    };

    bool _walking;
    /// <summary>The camera when not walking.</summary>
    public Overview Mode { get; private set; } = Overview.Iso;
    Meta _meta = new();
    // Cutaway: the height looked at, and how far out; Top: how high above the picked floor (or the surface).
    float _cutY, _cutOut = 70, _topHeight = 80;
    const float CutawayLift = 0.25f, Margin = 1.1f;
    /// <summary>
    /// First person on foot (Walker.cs), once there's a walking map: WASD walks, sliding along walls and
    /// furniture, through doorways, up and down stairs. Without a map (still coming, or none) it flies.
    /// </summary>
    public Walker? Walker { get; set; }
    /// <summary>Does a left drag turn the camera? Not while it paints corridors (a right drag still does).</summary>
    public bool LeftDragTurns { get; set; } = true;
    /// <summary>Do WASD and Q/E move the camera? Not while the build bar is open (they're room keys there).</summary>
    public bool KeysMove { get; set; } = true;
    /// <summary>Testing: seconds to walk straight ahead once on foot, as if W were held.</summary>
    public float StrollSeconds { get; set; }
    bool _onFoot;
    const float EyeHeight = 1.7f, WalkSpeed = 3f;
    // Iso.
    Vector3 _target;
    float _yaw = Mathf.Pi / 2, _pitch = 0.75f, _dist;
    // First person.
    Vector3 _pos;
    float _lookYaw, _lookPitch;
    // Benchmark.
    float _benchSeconds;
    double _benchClock;

    public string ModeName => _benchSeconds > 0 ? "benchmark" : _walking ? "first person" : Mode.ToString().ToLower();

    /// <summary>
    /// The cutaway's cut: the plane through the shaft's axis facing the camera (nx, 0, nz, 1): what's on
    /// the camera's side of it isn't drawn. Zero in the other cameras.
    /// </summary>
    public Vector4 CutPlane => !_walking && Mode == Overview.Cutaway ? new Vector4(Mathf.Cos(_yaw), 0, Mathf.Sin(_yaw), 1) : Vector4.Zero;

    /// <summary>The height the cutaway looks at, for which floors' lamps to light.</summary>
    public float CutawayY => _cutY;

    /// <summary>Heading round the shaft (radians), for what's built round the cut.</summary>
    public float Heading => _yaw;

    /// <summary>Switch the overview camera, fitting the new one to the hole.</summary>
    public void SetMode(Overview mode)
    {
        Mode = mode;
        _walking = false;
        Fit();
        Apply();
    }

    float Outer => _meta.Hole.ShaftRadiusM + _meta.Hole.UnlockedRings * 10;

    /// <summary>
    /// How far out Iso may zoom, as the web's (render3d/isoReach.ts): every ring the hole can have, open
    /// or not, with a tenth to spare, just inside the view.
    /// </summary>
    float IsoMax()
    {
        var rings = _meta.Hole.RingSlots.Length > 0 ? _meta.Hole.RingSlots.Length : 6;
        var radius = (_meta.Hole.ShaftRadiusM + rings * 10) * Margin;
        var aspect = IsInsideTree() ? GetViewport().GetVisibleRect().Size.Aspect() : 1.6f;
        return Mathf.Max(5, IsoFitDistance(radius, _pitch, _cam.Fov, aspect));
    }

    /// <summary>
    /// The least distance, orbiting the disc's centre `elev` radians up and looking at it, at which a disc of
    /// `radius` on the floor fits a view `fovDeg` tall: by halving, checking points round its rim.
    /// </summary>
    static float IsoFitDistance(float radius, float elev, float fovDeg, float aspect)
    {
        var tanV = Mathf.Tan(Mathf.DegToRad(fovDeg / 2));
        var tanH = tanV * aspect;
        bool Fits(float d)
        {
            float cx = d * Mathf.Cos(elev), cy = d * Mathf.Sin(elev);
            float fx = -cx / d, fy = -cy / d;
            float ux = -fy, uy = fx;
            for (var i = 0; i < 48; i++)
            {
                var a = i / 48f * Mathf.Tau;
                float px = radius * Mathf.Cos(a) - cx, py = -cy, pz = radius * Mathf.Sin(a);
                var ahead = px * fx + py * fy;
                if (ahead <= 0 || Mathf.Abs(pz) > tanH * ahead || Mathf.Abs(px * ux + py * uy) > tanV * ahead) return false;
            }
            return true;
        }
        float lo = radius * 0.1f, hi = radius * 100;
        for (var i = 0; i < 30; i++)
        {
            var mid = (lo + hi) / 2;
            if (Fits(mid)) hi = mid;
            else lo = mid;
        }
        return hi;
    }
    float Depth => (_meta.Hole.Floors + 1) * _meta.Hole.FloorHeightM + 3;
    float CutTop => _meta.Cut is int f ? (1 - f) * _meta.Hole.FloorHeightM - 3 : 0;

    /// <summary>As the web's fitCutaway and fitTop: the unlocked rings framed, with a little margin.</summary>
    void Fit()
    {
        var aspect = IsInsideTree() ? GetViewport().GetVisibleRect().Size.Aspect() : 1.6f;
        var tan = Mathf.Tan(Mathf.DegToRad(_cam.Fov / 2));
        _cutOut = Mathf.Clamp(Outer * Margin / (tan * aspect), 25, 300);
        _topHeight = Mathf.Clamp(Outer * Margin / (tan * Mathf.Min(1, aspect)), 20, 300);
        _cutY = _meta.Cut is int f ? -3 - f * _meta.Hole.FloorHeightM + 2 : -Mathf.Min(Depth, 20) / 2;
    }

    public CameraRig(Meta meta)
    {
        Frame(meta, true);
    }

    /// <summary>
    /// Frame the hole: Iso over the picked floor (or the surface); first person in the gallery tube of
    /// the picked floor (or floor 1). `walkToo` moves the walker as well (not when only the floor changes in Iso).
    /// </summary>
    public void Frame(Meta meta, bool walkToo)
    {
        _meta = meta;
        Fit();
        var h = meta.Hole;
        var outer = h.ShaftRadiusM + h.UnlockedRings * 10;
        // As the web game's Iso: over the picked floor (or the surface), a little past the middle, from 1.6 radii back.
        var floorY = meta.Cut is int f ? -3 - f * h.FloorHeightM : 0;
        _target = new Vector3(0, floorY, -outer * 0.12f);
        _dist = outer * 1.6f;
        if (walkToo)
        {
            // In the gallery tube (inside the shaft wall), at eye height, looking across the shaft.
            var walkFloor = meta.Cut ?? 1;
            _pos = new Vector3(0, -3 - walkFloor * h.FloorHeightM + 1.6f, h.ShaftRadiusM - 1.2f);
            _lookYaw = -Mathf.Pi / 2;
            _lookPitch = 0;
        }
        if (IsInsideTree()) Apply();
    }

    public bool Walking => _walking;

    public string Describe() => $"mode={ModeName} yaw={Mathf.RadToDeg(_yaw):0} pitch={Mathf.RadToDeg(_pitch):0} dist={_dist:0.0} cutY={_cutY:0.0} cutOut={_cutOut:0} top={_topHeight:0}";

    /// <summary>Back to this camera (after the map's).</summary>
    public void MakeCurrent() => _cam.Current = true;
    /// <summary>Walking on the ground (not flying): there's a map and the walker found its feet.</summary>
    public bool OnFoot => _walking && _onFoot;
    /// <summary>The floor the camera is on (floor 1 starts under the 3 m crust; floors are 4 m).</summary>
    public static int FloorAt(float y) => Mathf.FloorToInt((-y - 3) / 4) + 1;
    /// <summary>The walker's maps changed (a new layout): find its feet again when they come.</summary>
    public void Unground() => _onFoot = false;

    /// <summary>Stand here in first person, looking this way (radians about y: 0 looks along +x) and this far up.</summary>
    public void Stand(Vector3 at, float yaw, float pitch = 0)
    {
        _walking = true;
        _pos = at;
        _lookYaw = yaw;
        _lookPitch = pitch;
        Apply();
    }

    public void Walk(bool on)
    {
        _walking = on;
        Apply();
    }

    public override void _Ready()
    {
        AddChild(_cam);
        _cam.AddChild(_headlamp);
        _cam.Current = true;
        Apply();
    }

    /// <summary>Circle once for the benchmark: the Iso camera round the hole, or (walking) a turn on the spot.</summary>
    public void StartBench(float seconds, bool walking)
    {
        _benchSeconds = seconds;
        _walking = walking;
        Apply();
    }

    public override void _Process(double delta)
    {
        var dt = (float)delta;
        if (_benchSeconds > 0)
        {
            _benchClock += delta;
            // Hold still while it warms up, then once round.
            if (_benchClock > Bench.Warmup)
            {
                if (_walking) _lookYaw += Mathf.Tau / _benchSeconds * dt;
                else _yaw += Mathf.Tau / _benchSeconds * dt;
            }
            Apply();
            return;
        }
        // With the build bar open, letters pick rooms (as in the web), so they don't move the camera.
        bool Held(Key k) => KeysMove && Input.IsKeyPressed(k);
        var fwd = (Held(Key.W) ? 1 : 0) - (Held(Key.S) ? 1 : 0);
        // Testing: walk on by itself for a while (Live's --stroll).
        if (StrollSeconds > 0 && _onFoot)
        {
            StrollSeconds -= dt;
            fwd = 1;
        }
        var side = (Held(Key.D) ? 1 : 0) - (Held(Key.A) ? 1 : 0);
        var fast = Input.IsKeyPressed(Key.Shift) ? 3f : 1f;
        if (_walking)
        {
            var f = new Vector3(Mathf.Cos(_lookYaw), 0, Mathf.Sin(_lookYaw));
            var r = new Vector3(-f.Z, 0, f.X);
            if (Walker is Walker w && Walker.Has(FloorAt(_pos.Y)) && !_onFoot)
                _onFoot = w.Place(FloorAt(_pos.Y), new Vector2(_pos.X, _pos.Z));
            if (_onFoot && Walker is Walker walker)
            {
                // On foot: the walker decides where a step lands (and which floor).
                var step = (f * fwd + r * side) * WalkSpeed * (fast > 1 ? 2 : 1) * dt;
                walker.Step(new Vector2(step.X, step.Z));
                _pos = new Vector3(walker.At.X, walker.Height + EyeHeight, walker.At.Y);
            }
            else
            {
                var up = (Input.IsKeyPressed(Key.Space) ? 1 : 0) - (Input.IsKeyPressed(Key.C) ? 1 : 0);
                _pos += (f * fwd + r * side + Vector3.Up * up) * 4f * fast * dt;
            }
        }
        else
        {
            _yaw += ((Held(Key.E) ? 1 : 0) - (Held(Key.Q) ? 1 : 0)) * 1.2f * dt;
            if (Mode == Overview.Iso)
            {
                // Forward is the way the camera looks, flat on the ground.
                var f = new Vector3(-Mathf.Cos(_yaw), 0, -Mathf.Sin(_yaw));
                var r = new Vector3(-f.Z, 0, f.X);
                _target += (f * fwd + r * side) * Mathf.Max(10, _dist * 0.6f) * fast * dt;
            }
            // Cutaway: W and S go up and down the hole; A and D turn it.
            else if (Mode == Overview.Cutaway)
            {
                _cutY += fwd * 12 * fast * dt;
                _yaw += side * 1.2f * dt;
            }
            else _yaw += side * 1.2f * dt;
        }
        Apply();
    }

    public override void _UnhandledInput(InputEvent e)
    {
        if (e is InputEventKey { Pressed: true, Keycode: Key.Tab })
        {
            _walking = !_walking;
            _onFoot = false;
            Apply();
        }
        if (e is InputEventMouseMotion m && (m.ButtonMask & (LeftDragTurns ? MouseButtonMask.Left | MouseButtonMask.Right : MouseButtonMask.Right)) != 0)
        {
            if (_walking)
            {
                _lookYaw += m.Relative.X * 0.004f;
                _lookPitch = Mathf.Clamp(_lookPitch - m.Relative.Y * 0.004f, -1.4f, 1.4f);
            }
            else
            {
                // As the web's: sideways turns; up and down tilts Iso, moves the cutaway up and down the hole.
                _yaw += m.Relative.X * 0.005f;
                if (Mode == Overview.Iso) _pitch = Mathf.Clamp(_pitch + m.Relative.Y * 0.004f, 0.15f, 1.5f);
                else if (Mode == Overview.Cutaway) _cutY += m.Relative.Y * 0.15f;
            }
        }
        // Scrolling and pinching, from a wheel, a trackpad or a Magic Mouse alike (ScrollInput.cs), as the web's
        // Iso: sideways turns the hole, up and down zooms (Shift turns instead), a pinch zooms. Not in first person.
        // Cutaway: up and down moves up and down the hole; Top: zooms. As the web's.
        if (!_walking && ScrollInput.Read(e, out var scroll, out var zoom))
        {
            _yaw += scroll.X * 0.003f;
            if (ScrollInput.Shift(e)) _yaw += scroll.Y * 0.003f;
            else if (Mode == Overview.Iso) _dist *= Mathf.Exp(scroll.Y * 0.003f);
            else if (Mode == Overview.Cutaway) _cutY -= scroll.Y * 0.08f;
            else _topHeight *= Mathf.Exp(scroll.Y * 0.003f);
            _dist = Mathf.Clamp(_dist / zoom, 5, 800);
            _cutOut = Mathf.Clamp(_cutOut / zoom, 25, 300);
            _topHeight = Mathf.Clamp(_topHeight / zoom, 20, 300);
            Apply();
            GetViewport().SetInputAsHandled();
        }
    }

    void Apply()
    {
        _headlamp.Visible = _walking;
        if (_walking)
        {
            _cam.GlobalPosition = _pos;
            var look = new Vector3(Mathf.Cos(_lookYaw) * Mathf.Cos(_lookPitch), Mathf.Sin(_lookPitch), Mathf.Sin(_lookYaw) * Mathf.Cos(_lookPitch));
            _cam.LookAt(_pos + look, Vector3.Up);
            return;
        }
        var outward = new Vector3(Mathf.Cos(_yaw), 0, Mathf.Sin(_yaw));
        if (Mode == Overview.Cutaway)
        {
            // Out past the rings, a little above what it looks at, looking in at the shaft's axis.
            _cutY = Mathf.Clamp(_cutY, -Depth + EyeHeight, 12);
            _cam.GlobalPosition = outward * _cutOut + Vector3.Up * (_cutY + _cutOut * CutawayLift);
            _cam.LookAt(new Vector3(0, _cutY, 0), Vector3.Up);
            return;
        }
        if (Mode == Overview.Top)
        {
            // Straight down the shaft from above the picked floor (or the surface), turned by the heading.
            _cam.GlobalPosition = new Vector3(0, _topHeight + CutTop, 0);
            _cam.LookAt(new Vector3(0, -Depth, 0), outward);
            return;
        }
        _dist = Mathf.Min(_dist, IsoMax());
        var offset = new Vector3(Mathf.Cos(_yaw) * Mathf.Cos(_pitch), Mathf.Sin(_pitch), Mathf.Sin(_yaw) * Mathf.Cos(_pitch)) * _dist;
        _cam.GlobalPosition = _target + offset;
        _cam.LookAt(_target, Vector3.Up);
    }
}
