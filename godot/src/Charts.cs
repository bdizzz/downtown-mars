using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// Charts, as the web's: Trends (ui/TrendsPanel.tsx), one series up close over two days, ten days or
/// the whole game, as amounts or change per day, with every series below as a sparkline to pick; and
/// Flows (ui/FlowPanel.tsx), each resource's sources and uses as a river. The bridge works out the
/// numbers (src/bridge/charts.ts); this draws them. Refreshed every couple of seconds while open.
/// </summary>
public partial class Charts : Node
{
    readonly Action<object> _send;
    readonly PanelContainer _panel = new();
    readonly VBoxContainer _rows = new();
    string _tab = "trends", _key = "happiness", _range = "10d", _mode = "amount", _flowTab = "water";
    double _clock, _asked;

    public Action? Opened { get; set; }
    public bool Open => _panel.Visible;

    static readonly Color Title = new("#e8834a"), Body = new("#f3e6d8"), Muted = new("#b8a490");

    public Charts(CanvasLayer hud, Action<object> send)
    {
        _send = send;
        _panel.Visible = false;
        _panel.SetAnchorsPreset(Control.LayoutPreset.TopRight);
        _panel.GrowHorizontal = Control.GrowDirection.Begin;
        _panel.Position = new Vector2(-400, 100);
        _panel.AddThemeStyleboxOverride("panel", Live.Panel());
        hud.AddChild(_panel);
        var scroll = new ScrollContainer { CustomMinimumSize = new Vector2(370, 660), HorizontalScrollMode = ScrollContainer.ScrollMode.Disabled };
        _panel.AddChild(scroll);
        _rows.AddThemeConstantOverride("separation", 5);
        _rows.CustomMinimumSize = new Vector2(350, 0);
        scroll.AddChild(_rows);
    }

    public void Toggle(bool? open = null)
    {
        _panel.Visible = open ?? !_panel.Visible;
        if (!_panel.Visible) return;
        Opened?.Invoke();
        Ask();
    }

    public override void _Process(double delta)
    {
        _clock += delta;
        if (_panel.Visible && _clock - _asked > 2) Ask();
    }

    void Ask()
    {
        _asked = _clock;
        if (_tab == "trends") _send(new Dictionary<string, object> { ["type"] = "trends", ["key"] = _key, ["range"] = _range, ["mode"] = _mode });
        else _send(new Dictionary<string, object> { ["type"] = "flows", ["tab"] = _flowTab });
    }

    void Clear()
    {
        foreach (var c in _rows.GetChildren())
        {
            _rows.RemoveChild(c);
            c.QueueFree();
        }
        var head = new HBoxContainer();
        foreach (var (id, name) in new[] { ("trends", "Trends"), ("flows", "Flows") })
        {
            var b = new Button { Text = name, ToggleMode = true, ButtonPressed = _tab == id, FocusMode = Control.FocusModeEnum.None };
            b.Pressed += () =>
            {
                _tab = id;
                Ask();
            };
            head.AddChild(b);
        }
        head.AddChild(new Control { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill });
        var close = new Button { Text = "×", Flat = true, FocusMode = Control.FocusModeEnum.None };
        close.Pressed += () => Toggle(false);
        head.AddChild(close);
        _rows.AddChild(head);
    }

    static Label Text(string text, int size, Color color)
    {
        var l = new Label { Text = text, AutowrapMode = TextServer.AutowrapMode.WordSmart, CustomMinimumSize = new Vector2(340, 0) };
        l.AddThemeFontSizeOverride("font_size", size);
        l.AddThemeColorOverride("font_color", color);
        return l;
    }

    HBoxContainer Segmented(IEnumerable<(string id, string label)> items, string on, Action<string> pick)
    {
        var row = new HBoxContainer();
        foreach (var (id, label) in items)
        {
            var b = new Button { Text = label, ToggleMode = true, ButtonPressed = id == on, FocusMode = Control.FocusModeEnum.None };
            b.Pressed += () => pick(id);
            row.AddChild(b);
        }
        return row;
    }

    /// <summary>The bridge's trends: the chart up close, and every series as a row.</summary>
    public void SetTrends(JsonElement m)
    {
        if (_tab != "trends") return;
        Clear();
        _key = m.GetProperty("key").GetString()!;
        _mode = m.GetProperty("mode").GetString()!;
        _rows.AddChild(Segmented(m.GetProperty("ranges").EnumerateArray().Select(r => (r.GetProperty("id").GetString()!, r.GetProperty("label").GetString()!)), _range, id =>
        {
            _range = id;
            Ask();
        }));
        if (m.TryGetProperty("empty", out var empty))
        {
            _rows.AddChild(Text(empty.GetString()!, 13, Muted));
            return;
        }
        _rows.AddChild(Text(m.GetProperty("title").GetString()!, 18, Title));
        if (m.GetProperty("rates").GetBoolean())
            _rows.AddChild(Segmented(new[] { ("amount", "Amount"), ("rate", "Change per day") }, _mode, id =>
            {
                _mode = id;
                Ask();
            }));
        var chart = m.GetProperty("chart");
        _rows.AddChild(new LineChart(chart) { CustomMinimumSize = new Vector2(340, 180) });
        if (m.TryGetProperty("sum", out var sum) && sum.ValueKind == JsonValueKind.String) _rows.AddChild(Text(sum.GetString()!, 12, Muted));
        foreach (var g in m.GetProperty("groups").EnumerateArray())
        {
            _rows.AddChild(Text(g.GetProperty("name").GetString()!, 15, Body));
            foreach (var r in g.GetProperty("rows").EnumerateArray())
            {
                var key = r.GetProperty("key").GetString()!;
                var row = new Button { ToggleMode = true, ButtonPressed = key == _key, FocusMode = Control.FocusModeEnum.None, CustomMinimumSize = new Vector2(340, 28) };
                row.Pressed += () =>
                {
                    _key = key;
                    Ask();
                };
                var line = new HBoxContainer { MouseFilter = Control.MouseFilterEnum.Ignore };
                line.SetAnchorsPreset(Control.LayoutPreset.FullRect);
                line.AddThemeConstantOverride("separation", 6);
                row.AddChild(line);
                var name = new Label { Text = r.GetProperty("label").GetString(), CustomMinimumSize = new Vector2(110, 0), MouseFilter = Control.MouseFilterEnum.Ignore, VerticalAlignment = VerticalAlignment.Center };
                name.AddThemeFontSizeOverride("font_size", 13);
                line.AddChild(name);
                line.AddChild(new Sparkline(r.GetProperty("lines")) { CustomMinimumSize = new Vector2(100, 24), MouseFilter = Control.MouseFilterEnum.Ignore });
                var value = new Label { Text = r.GetProperty("value").GetString(), CustomMinimumSize = new Vector2(55, 0), HorizontalAlignment = HorizontalAlignment.Right, MouseFilter = Control.MouseFilterEnum.Ignore, VerticalAlignment = VerticalAlignment.Center };
                value.AddThemeFontSizeOverride("font_size", 13);
                line.AddChild(value);
                var delta = new Label { Text = r.GetProperty("delta").GetString(), CustomMinimumSize = new Vector2(55, 0), MouseFilter = Control.MouseFilterEnum.Ignore, VerticalAlignment = VerticalAlignment.Center };
                delta.AddThemeFontSizeOverride("font_size", 12);
                delta.AddThemeColorOverride("font_color", Muted);
                line.AddChild(delta);
                _rows.AddChild(row);
            }
        }
    }

    /// <summary>The bridge's flows: a tab's rivers.</summary>
    public void SetFlows(JsonElement m)
    {
        if (_tab != "flows") return;
        Clear();
        _flowTab = m.GetProperty("tab").GetString()!;
        _rows.AddChild(Segmented(m.GetProperty("tabs").EnumerateArray().Select(t => (t.GetProperty("id").GetString()!, t.GetProperty("name").GetString()!)), _flowTab, id =>
        {
            _flowTab = id;
            Ask();
        }));
        _rows.AddChild(Text(m.GetProperty("note").GetString()!, 12, Muted));
        if (m.TryGetProperty("recycled", out var rec)) _rows.AddChild(Text(rec.GetString()!, 13, Body));
        foreach (var r in m.GetProperty("rivers").EnumerateArray())
        {
            _rows.AddChild(Text(r.GetProperty("name").GetString()!, 16, Title));
            if (r.TryGetProperty("empty", out var empty))
            {
                _rows.AddChild(Text(empty.GetString()!, 12, Muted));
                continue;
            }
            _rows.AddChild(Text(r.GetProperty("summary").GetString()!, 12, Muted));
            var river = new River(r);
            river.CustomMinimumSize = new Vector2(340, river.Height);
            _rows.AddChild(river);
        }
    }

    // ---- drawing ----

    static Font Font => ThemeDB.FallbackFont;

    static string Num(double v) => Math.Abs(v) >= 10 || v == 0 ? Math.Round(v).ToString() : v.ToString("0.0");

    /// <summary>A tidy scale (ui/trends.ts niceScale): bounds rounded out to nice steps.</summary>
    static (double lo, double hi, double step) Nice(double lo, double hi, int ticks = 4)
    {
        if (hi - lo < 1e-9)
        {
            var pad = Math.Max(1, Math.Abs(hi) * 0.1);
            lo -= pad;
            hi += pad;
        }
        var raw = (hi - lo) / ticks;
        var mag = Math.Pow(10, Math.Floor(Math.Log10(raw)));
        var step = new[] { 1, 2, 2.5, 5, 10 }.Select(x => x * mag).FirstOrDefault(x => x >= raw, 10 * mag);
        return (Math.Floor(lo / step) * step, Math.Ceiling(hi / step) * step, step);
    }

    static void Dashed(Control c, Vector2[] pts, Color color, float width)
    {
        for (var i = 0; i + 1 < pts.Length; i++) c.DrawDashedLine(pts[i], pts[i + 1], color, width, 4);
    }

    /// <summary>The chart up close: axes, reference lines, the lines (the first with a soft fill), and its time span.</summary>
    partial class LineChart : Control
    {
        readonly List<(Color color, bool dashed, double[] values)> _lines = new();
        readonly List<(double at, string label)> _refs = new();
        readonly string _from, _to, _unit;
        readonly bool _whole;

        public LineChart(JsonElement chart)
        {
            foreach (var l in chart.GetProperty("lines").EnumerateArray())
                _lines.Add((new Color(l.GetProperty("color").GetString()!), l.GetProperty("dashed").GetBoolean(), l.GetProperty("values").EnumerateArray().Select(v => v.GetDouble()).ToArray()));
            foreach (var r in chart.GetProperty("refs").EnumerateArray()) _refs.Add((r.GetProperty("at").GetDouble(), r.GetProperty("label").GetString()!));
            _from = chart.GetProperty("from").GetString()!;
            _to = chart.GetProperty("to").GetString()!;
            _unit = chart.GetProperty("unit").GetString()!;
            _whole = chart.GetProperty("whole").GetBoolean();
        }

        public override void _Draw()
        {
            var all = _lines.SelectMany(l => l.values).ToList();
            var n = _lines.Count > 0 ? _lines[0].values.Length : 0;
            if (n < 2 || all.Count == 0)
            {
                DrawString(Font, new Vector2(4, 20), "Not enough history yet: it builds up an hour at a time.", HorizontalAlignment.Left, -1, 12, Muted);
                return;
            }
            double lo = all.Min(), hi = all.Max();
            var span = Math.Max(1, hi - lo);
            var refs = _refs.Where(r => r.at >= lo - span * 0.6 && r.at <= hi + span * 0.6).ToList();
            foreach (var r in refs)
            {
                lo = Math.Min(lo, r.at);
                hi = Math.Max(hi, r.at);
            }
            if (lo >= 0 && lo < span * 0.3) lo = 0;
            var s = Nice(lo, hi);
            float l = 40, r0 = Size.X - 8, t = 8, b = Size.Y - 22;
            float X(int i) => l + i / (float)(n - 1) * (r0 - l);
            float Y(double v) => (float)(b - (v - s.lo) / (s.hi - s.lo) * (b - t));
            var grid = new Color(1, 1, 1, 0.08f);
            for (var v = s.lo; v <= s.hi + s.step * 0.01; v += s.step)
            {
                DrawLine(new Vector2(l, Y(v)), new Vector2(r0, Y(v)), grid, 1);
                DrawString(Font, new Vector2(0, Y(v) + 4), (_whole ? Math.Round(v).ToString() : Num(v)) + (_unit == "%" ? "%" : ""), HorizontalAlignment.Right, l - 4, 10, Muted);
            }
            foreach (var r in refs)
            {
                DrawDashedLine(new Vector2(l, Y(r.at)), new Vector2(r0, Y(r.at)), new Color(1, 0.85f, 0.6f, 0.45f), 1, 3);
                DrawString(Font, new Vector2(l + 4, Y(r.at) - 3), r.label, HorizontalAlignment.Left, -1, 10, new Color(1, 0.85f, 0.6f, 0.7f));
            }
            // The first line gets a soft fill under it.
            var first = _lines[0];
            var fill = new List<Vector2> { new(X(0), b) };
            for (var i = 0; i < first.values.Length; i++) fill.Add(new Vector2(X(i), Y(first.values[i])));
            fill.Add(new Vector2(X(first.values.Length - 1), b));
            DrawColoredPolygon(fill.ToArray(), first.color with { A = 0.14f });
            foreach (var (color, dashed, values) in _lines)
            {
                var pts = values.Select((v, i) => new Vector2(X(i), Y(v))).ToArray();
                if (dashed) Dashed(this, pts, color, 1.5f);
                else DrawPolyline(pts, color, 2, true);
            }
            DrawString(Font, new Vector2(l, Size.Y - 4), _from, HorizontalAlignment.Left, -1, 10, Muted);
            DrawString(Font, new Vector2(l, Size.Y - 4), _to, HorizontalAlignment.Right, r0 - l, 10, Muted);
            if (_unit == "/day") DrawString(Font, new Vector2(l + 4, t + 10), "per day", HorizontalAlignment.Left, -1, 10, Muted);
        }
    }

    /// <summary>A few lines on a shared scale, no axes; the first with a soft fill.</summary>
    partial class Sparkline : Control
    {
        readonly List<(Color color, bool dashed, double[] values)> _lines = new();

        public Sparkline(JsonElement lines)
        {
            foreach (var l in lines.EnumerateArray())
                _lines.Add((new Color(l.GetProperty("color").GetString()!), l.GetProperty("dashed").GetBoolean(), l.GetProperty("values").EnumerateArray().Select(v => v.GetDouble()).ToArray()));
        }

        public override void _Draw()
        {
            var all = _lines.SelectMany(l => l.values).ToList();
            if (all.Count < 2) return;
            double lo = all.Min(), hi = all.Max();
            if (hi - lo < 1e-6)
            {
                lo -= 1;
                hi += 1;
            }
            const float pad = 2;
            Vector2 P(int i, int n, double v) => new(pad + i / (float)Math.Max(1, n - 1) * (Size.X - 2 * pad), (float)(Size.Y - pad - (v - lo) / (hi - lo) * (Size.Y - 2 * pad)));
            var first = _lines[0];
            if (first.values.Length >= 2)
            {
                var fill = first.values.Select((v, i) => P(i, first.values.Length, v)).ToList();
                fill.Add(new Vector2(fill[^1].X, Size.Y - pad));
                fill.Add(new Vector2(pad, Size.Y - pad));
                DrawColoredPolygon(fill.ToArray(), first.color with { A = 0.14f });
            }
            foreach (var (color, dashed, values) in _lines)
            {
                if (values.Length < 2) continue;
                var pts = values.Select((v, i) => P(i, values.Length, v)).ToArray();
                if (dashed) Dashed(this, pts, color, 1.2f);
                else DrawPolyline(pts, color, 1.4f, true);
            }
        }
    }

    /// <summary>A resource's river: sources on the left, uses on the right, ribbons through a bar in the middle.</summary>
    partial class River : Control
    {
        const float LabelW = 100, Bar = 6, Gap = 4, MaxH = 130;
        readonly List<(string label, double value, Color color)> _ins = new(), _outs = new();
        readonly float _scale, _mid;
        public float Height { get; }

        public River(JsonElement r)
        {
            foreach (var x in r.GetProperty("ins").EnumerateArray()) _ins.Add((x.GetProperty("label").GetString()!, x.GetProperty("value").GetDouble(), new Color(x.GetProperty("color").GetString()!)));
            foreach (var x in r.GetProperty("outs").EnumerateArray()) _outs.Add((x.GetProperty("label").GetString()!, x.GetProperty("value").GetDouble(), new Color(x.GetProperty("color").GetString()!)));
            double totalIn = _ins.Sum(x => x.value), totalOut = _outs.Sum(x => x.value);
            _scale = (float)(MaxH / Math.Max(Math.Max(totalIn, totalOut), 1e-6));
            _mid = (float)Math.Max(totalIn, totalOut) * _scale;
            Height = Math.Max(_mid, Math.Max(Stack(_ins).LastOrDefault().end, Stack(_outs).LastOrDefault().end)) + 6;
        }

        IEnumerable<(float y, float h, float end)> Stack(List<(string label, double value, Color color)> list)
        {
            var y = 0f;
            foreach (var x in list)
            {
                var h = Math.Max(1.5f, (float)x.value * _scale);
                yield return (y, h, y + h);
                y += h + Gap;
            }
        }

        void Ribbon(float x1, float y1, float x2, float y2, float h, Color color)
        {
            var top = new List<Vector2>();
            var bottom = new List<Vector2>();
            for (var i = 0; i <= 16; i++)
            {
                var t = i / 16f;
                var s = t * t * (3 - 2 * t);
                var x = Mathf.Lerp(x1, x2, t);
                top.Add(new Vector2(x, Mathf.Lerp(y1, y2, s)));
                bottom.Add(new Vector2(x, Mathf.Lerp(y1 + h, y2 + h, s)));
            }
            bottom.Reverse();
            DrawColoredPolygon(top.Concat(bottom).ToArray(), color with { A = 0.45f });
        }

        public override void _Draw()
        {
            var w = Size.X;
            float xL = LabelW, xM = w / 2 - Bar / 2, xR = w - LabelW - Bar;
            var left = Stack(_ins).ToList();
            var right = Stack(_outs).ToList();
            float offset = 0;
            for (var i = 0; i < left.Count; i++)
            {
                Ribbon(xL + Bar, left[i].y, xM, offset, left[i].h, _ins[i].color);
                offset += left[i].h;
            }
            offset = 0;
            for (var i = 0; i < right.Count; i++)
            {
                Ribbon(xM + Bar, offset, xR, right[i].y, right[i].h, _outs[i].color);
                offset += right[i].h;
            }
            DrawRect(new Rect2(xM, 0, Bar, _mid), new Color("#f0e0d0") with { A = 0.8f });
            for (var i = 0; i < left.Count; i++)
            {
                DrawRect(new Rect2(xL, left[i].y, Bar, left[i].h), _ins[i].color);
                DrawString(Font, new Vector2(0, left[i].y + left[i].h / 2 + 4), $"{_ins[i].label} {Num(_ins[i].value)}", HorizontalAlignment.Right, xL - 4, 10, Body);
            }
            for (var i = 0; i < right.Count; i++)
            {
                DrawRect(new Rect2(xR, right[i].y, Bar, right[i].h), _outs[i].color);
                DrawString(Font, new Vector2(xR + Bar + 4, right[i].y + right[i].h / 2 + 4), $"{_outs[i].label} {Num(_outs[i].value)}", HorizontalAlignment.Left, LabelW - 8, 10, Body);
            }
        }
    }
}
