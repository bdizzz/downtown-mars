using Godot;

namespace DowntownMars;

/// <summary>
/// Two cameras, as in the web game. Iso: orbiting a point over the hole (drag to turn, wheel to zoom,
/// WASD to pan, Q/E to turn). First person: walking height on floor 1 (WASD to move, drag to look,
/// Space/C up and down, Shift faster; no collision in the experiment). Tab switches. The benchmark
/// circles the Iso camera once.
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

    public string ModeName => _benchSeconds > 0 ? "benchmark" : _walking ? "first person" : "iso";

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
            // Forward is the way the camera looks, flat on the ground.
            var f = new Vector3(-Mathf.Cos(_yaw), 0, -Mathf.Sin(_yaw));
            var r = new Vector3(-f.Z, 0, f.X);
            _target += (f * fwd + r * side) * Mathf.Max(10, _dist * 0.6f) * fast * dt;
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
                _yaw += m.Relative.X * 0.005f;
                _pitch = Mathf.Clamp(_pitch + m.Relative.Y * 0.004f, 0.15f, 1.5f);
            }
        }
        if (e is InputEventMouseButton { Pressed: true } b && !_walking)
        {
            if (b.ButtonIndex == MouseButton.WheelUp) _dist *= 0.9f;
            if (b.ButtonIndex == MouseButton.WheelDown) _dist *= 1.1f;
            _dist = Mathf.Clamp(_dist, 5, 800);
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
        var offset = new Vector3(Mathf.Cos(_yaw) * Mathf.Cos(_pitch), Mathf.Sin(_pitch), Mathf.Sin(_yaw) * Mathf.Cos(_pitch)) * _dist;
        _cam.GlobalPosition = _target + offset;
        _cam.LookAt(_target, Vector3.Up);
    }
}
