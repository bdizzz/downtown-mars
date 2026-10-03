using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// The plan view, as the web's (render2d/plan.ts): one floor seen from above, drawn flat, always centred
/// on the shaft; scroll or pinch to zoom, drag or scroll sideways to turn. It paints what the web's own
/// drawing recorded (the bridge's plan.ts): fills and strokes of polygons, circles and rects, and each
/// room's icon and name kept upright. Over it, the build ghost and the selected room's outline, from the
/// same messages the 3D view uses, laid flat.
/// </summary>
public partial class PlanView : Control
{
    /// <summary>A shape's points, whether it closes, and (for fills) whether it triangulates: worked out once.</summary>
    record Shape(Vector2[] Points, bool Closed, bool Fillable);
    record Op(bool Fill, Color Color, float Width, Shape[] Shapes, bool Stripes);
    record Marker(Vector2 At, string? Text, Color TextColor, Op[] Glyph);

    static readonly Color Background = new("#1a0d0a"), Caption = new("#d8c0ae");
    const int CircleSteps = 32;
    const float FitShare = 0.9f, MinZoom = 0.3f, MaxZoom = 5, LabelPx = 12, MinLabelPx = 10;
    const int ProgressPx = 14;

    Op[] _ops = Array.Empty<Op>();
    /// <summary>Over the rooms: the overlay's tints; each room under construction's progress; the drill's caption.</summary>
    Op[] _field = Array.Empty<Op>();
    (Vector2 at, string text)[] _progress = Array.Empty<(Vector2, string)>();
    string? _dug;
    Marker[] _markers = Array.Empty<Marker>();
    float _px = 7, _outer = 40;
    int _floor = 1;
    bool _fitted;
    public float Zoom { get; private set; } = 1;
    public float Turn { get; private set; }

    /// <summary>What to lay over the plan: triangles (a build ghost or corridor strip) and line pairs (an outline), in world space.</summary>
    public Func<(Vector3[] tris, bool ok)>? Ghost { get; set; }
    public Func<Vector3[]>? Outline { get; set; }

    public PlanView()
    {
        SetAnchorsPreset(LayoutPreset.FullRect);
        MouseFilter = MouseFilterEnum.Ignore;
        Visible = false;
    }

    public void Refit() => _fitted = false;

    static Shape[] Shapes(JsonElement s) => s.EnumerateArray().Select(sh =>
    {
        var kind = sh[0].GetString();
        var n = sh.EnumerateArray().Skip(1).Select(x => x.GetSingle()).ToArray();
        switch (kind)
        {
            case "P":
            case "L":
                var pts = new Vector2[n.Length / 2];
                for (var i = 0; i < pts.Length; i++) pts[i] = new Vector2(n[i * 2], n[i * 2 + 1]);
                return new Shape(pts, kind == "P", pts.Length >= 3 && Geometry2D.TriangulatePolygon(pts).Length > 0);
            case "C":
                return new Shape(Ellipse(n[0], n[1], n[2], n[2]), true, true);
            case "E":
                return new Shape(Ellipse(n[0], n[1], n[2], n[3]), true, true);
            default:
                return new Shape(new[] { new Vector2(n[0], n[1]), new Vector2(n[0] + n[2], n[1]), new Vector2(n[0] + n[2], n[1] + n[3]), new Vector2(n[0], n[1] + n[3]) }, true, true);
        }
    }).ToArray();

    static Vector2[] Ellipse(float x, float y, float rx, float ry)
    {
        var steps = Math.Clamp((int)(Math.Max(rx, ry) / 3), 12, 96);
        var pts = new Vector2[steps];
        for (var i = 0; i < steps; i++) pts[i] = new Vector2(x + rx * MathF.Cos(MathF.Tau * i / steps), y + ry * MathF.Sin(MathF.Tau * i / steps));
        return pts;
    }

    static Op[] Ops(JsonElement ops) => ops.EnumerateArray().Select(o => new Op(
        o.GetProperty("f").GetInt32() == 1,
        new Color(o.GetProperty("c").GetString()!) with { A = o.GetProperty("a").GetSingle() },
        o.GetProperty("w").GetSingle(),
        Shapes(o.GetProperty("s")),
        o.TryGetProperty("stripes", out _))).ToArray();

    /// <summary>The bridge's plan of a floor.</summary>
    public void Set(JsonElement m)
    {
        _px = m.GetProperty("px").GetSingle();
        _outer = m.GetProperty("outer").GetSingle();
        var floor = m.GetProperty("floor").GetInt32();
        if (floor != _floor)
        {
            _field = Array.Empty<Op>();
            _progress = Array.Empty<(Vector2, string)>();
            _dug = null;
        }
        _floor = floor;
        _ops = Ops(m.GetProperty("ops"));
        _markers = m.GetProperty("markers").EnumerateArray().Select(k => new Marker(
            new Vector2(k.GetProperty("x").GetSingle(), k.GetProperty("y").GetSingle()),
            k.GetProperty("text").ValueKind == JsonValueKind.String ? k.GetProperty("text").GetString() : null,
            new Color(k.GetProperty("textColor").GetString()!),
            Ops(k.GetProperty("glyph")))).ToArray();
        QueueRedraw();
    }

    /// <summary>The bridge's overlay and progress for the floor shown.</summary>
    public void SetField(JsonElement m)
    {
        if (m.GetProperty("floor").GetInt32() != _floor) return;
        _field = Ops(m.GetProperty("ops"));
        _progress = m.GetProperty("progress").EnumerateArray()
            .Select(p => (new Vector2(p.GetProperty("x").GetSingle(), p.GetProperty("y").GetSingle()), p.GetProperty("text").GetString()!)).ToArray();
        _dug = m.GetProperty("dug").ValueKind == JsonValueKind.String ? m.GetProperty("dug").GetString() : null;
        QueueRedraw();
    }

    // ---- where things are ----

    Vector2 Centre => Size / 2;

    /// <summary>Plan px (world metres × px, x and z) to the screen.</summary>
    Vector2 ToScreen(Vector2 p) => Centre + p.Rotated(Turn) * Zoom;

    /// <summary>A screen point to world x and z (metres).</summary>
    public Vector2 ToWorld(Vector2 screen) => ((screen - Centre) / Zoom).Rotated(-Turn) / _px;

    public void ZoomBy(float factor)
    {
        Zoom = Math.Clamp(Zoom * factor, MinZoom, MaxZoom);
        QueueRedraw();
    }

    public void TurnBy(float radians)
    {
        Turn += radians;
        QueueRedraw();
    }

    object? _ghostSeen, _outlineSeen;

    public override void _Process(double delta)
    {
        if (!Visible) return;
        // Over it: the ghost and the outline change as the pointer moves; redraw only then.
        var ghost = Ghost?.Invoke().tris;
        var outline = Outline?.Invoke();
        if (ReferenceEquals(ghost, _ghostSeen) && ReferenceEquals(outline, _outlineSeen)) return;
        _ghostSeen = ghost;
        _outlineSeen = outline;
        QueueRedraw();
    }

    // ---- drawing ----

    /// <summary>One op, in plan px (the canvas transform places, turns and scales it).</summary>
    void Paint(Op op, float scale)
    {
        foreach (var shape in op.Shapes)
        {
            var pts = shape.Points;
            if (pts.Length < 2) continue;
            if (op.Fill)
            {
                if (!shape.Fillable) continue;
                DrawColoredPolygon(pts, op.Stripes ? new Color("#e0a03a") with { A = 0.45f } : op.Color);
            }
            else
            {
                if (shape.Closed) pts = pts.Append(pts[0]).ToArray();
                // At least a pixel wide on screen.
                DrawPolyline(pts, op.Color, Math.Max(1 / scale, op.Width), true);
            }
        }
    }

    public override void _Draw()
    {
        DrawRect(new Rect2(Vector2.Zero, Size), Background);
        if (!_fitted && Size.X > 0 && _outer > 0)
        {
            Zoom = Math.Clamp(Math.Min(Size.X, Size.Y) * FitShare / (_outer * _px * 2), MinZoom, MaxZoom);
            _fitted = true;
        }
        DrawSetTransform(Centre, Turn, new Vector2(Zoom, Zoom));
        foreach (var op in _ops) Paint(op, Zoom);
        foreach (var op in _field) Paint(op, Zoom);
        DrawSetTransformMatrix(Transform2D.Identity);
        // Each room's icon and name, upright as the plan turns; names never smaller than MinLabelPx.
        var font = ThemeDB.FallbackFont;
        var label = (int)Math.Max(MinLabelPx, LabelPx * Zoom);
        foreach (var m in _markers)
        {
            var at = ToScreen(m.At);
            DrawSetTransform(at, 0, new Vector2(Zoom, Zoom));
            foreach (var op in m.Glyph) Paint(op, Zoom);
            DrawSetTransformMatrix(Transform2D.Identity);
            if (m.Text == null) continue;
            var width = font.GetStringSize(m.Text, HorizontalAlignment.Left, -1, label).X;
            DrawString(font, at + new Vector2(-width / 2, -3 * Zoom), m.Text, HorizontalAlignment.Left, -1, label, m.TextColor);
        }
        // "45%" on each room under construction, white on a dark outline, as the web's.
        foreach (var (p, text) in _progress)
        {
            var at = ToScreen(p);
            var width = font.GetStringSize(text, HorizontalAlignment.Left, -1, ProgressPx).X;
            var pos = at + new Vector2(-width / 2, ProgressPx / 2f);
            DrawStringOutline(font, pos, text, HorizontalAlignment.Left, -1, ProgressPx, 6, new Color("#1a0f0d"));
            DrawString(font, pos, text, HorizontalAlignment.Left, -1, ProgressPx, Colors.White);
        }
        // The build ghost (or corridor strip) and the selected room's outline, laid flat.
        Vector2 Flat(Vector3 w) => ToScreen(new Vector2(w.X, w.Z) * _px);
        if (Ghost?.Invoke() is var (tris, ok) && tris.Length >= 3)
        {
            var color = (ok ? new Color("#7fd67f") : new Color("#e0503a")) with { A = 0.35f };
            for (var i = 0; i + 2 < tris.Length; i += 3)
            {
                var tri = new[] { Flat(tris[i]), Flat(tris[i + 1]), Flat(tris[i + 2]) };
                // Walls stand on edge from above: only the floor's triangles have area here.
                if (Mathf.Abs((tri[1] - tri[0]).Cross(tri[2] - tri[0])) > 0.5f) DrawColoredPolygon(tri, color);
            }
        }
        if (Outline?.Invoke() is { Length: >= 2 } lines)
            for (var i = 0; i + 1 < lines.Length; i += 2) DrawLine(Flat(lines[i]), Flat(lines[i + 1]), new Color("#ffffff"), 2.5f, true);
        DrawString(font, new Vector2(12, Size.Y - 100), _dug != null ? $"Floor {_floor} · {_dug}" : $"Floor {_floor}", HorizontalAlignment.Left, -1, 15, Caption);
    }
}
