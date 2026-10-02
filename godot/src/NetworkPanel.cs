using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// The network, as the web's panel (ui/NetworkPanel.tsx): every hole with its people and rovers, how
/// their cultures sit (now, and where they're heading), how each sees the others, who's on the move,
/// and the trade routes, with a form to start one from the hole in view. From the bridge's network.ts.
/// </summary>
public partial class NetworkPanel : Node
{
    readonly Action<object> _send;
    readonly PanelContainer _panel = new();
    readonly VBoxContainer _rows = new();
    double _clock, _asked;
    int _to = -1, _amount = 20;
    string _resource = "metal";
    int _id = 4_000_000;

    public Action? Opened { get; set; }
    public bool Open => _panel.Visible;
    static readonly Color Title = new("#e8834a"), Body = new("#f3e6d8"), Muted = new("#b8a490");

    public NetworkPanel(CanvasLayer hud, Action<object> send)
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

    void Ask()
    {
        _asked = _clock;
        _send(new Dictionary<string, object> { ["type"] = "network" });
    }

    public override void _Process(double delta)
    {
        _clock += delta;
        if (_panel.Visible && _clock - _asked > 1.5) Ask();
    }

    static Label Text(string text, int size, Color color)
    {
        var l = new Label { Text = text, AutowrapMode = TextServer.AutowrapMode.WordSmart, CustomMinimumSize = new Vector2(340, 0) };
        l.AddThemeFontSizeOverride("font_size", size);
        l.AddThemeColorOverride("font_color", color);
        return l;
    }

    public void Set(JsonElement m)
    {
        foreach (var c in _rows.GetChildren())
        {
            _rows.RemoveChild(c);
            c.QueueFree();
        }
        var head = new HBoxContainer();
        var title = Text("Network", 20, Title);
        title.CustomMinimumSize = Vector2.Zero;
        title.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        head.AddChild(title);
        var close = new Button { Text = "×", Flat = true, FocusMode = Control.FocusModeEnum.None };
        close.Pressed += () => Toggle(false);
        head.AddChild(close);
        _rows.AddChild(head);

        foreach (var h in m.GetProperty("holes").EnumerateArray())
        {
            var here = h.GetProperty("here").GetBoolean();
            _rows.AddChild(Text($"● {h.GetProperty("name").GetString()}{(here ? "  (in view)" : "")}   ·   {h.GetProperty("people").GetInt32()} people   ·   rovers {h.GetProperty("rovers").GetString()}", 14, new Color(h.GetProperty("color").GetString()!)));
        }

        _rows.AddChild(Text("Culture   ● now  ○ heading", 15, Body));
        foreach (var a in m.GetProperty("axes").EnumerateArray())
            _rows.AddChild(new Axis(a) { CustomMinimumSize = new Vector2(340, 34) });

        var opinions = m.GetProperty("opinions");
        if (opinions.GetArrayLength() > 0)
        {
            _rows.AddChild(Text("Opinion", 15, Body));
            foreach (var o in opinions.EnumerateArray())
            {
                var v = o.GetProperty("opinion").GetDouble();
                _rows.AddChild(Text($"{o.GetProperty("text").GetString()}: {o.GetProperty("tier").GetString()}", 13, v >= 0 ? new Color("#9fd28a") : new Color("#f0a030")));
            }
        }
        var moving = m.GetProperty("moving");
        if (moving.GetArrayLength() > 0)
        {
            _rows.AddChild(Text("On the move", 15, Body));
            foreach (var t in moving.EnumerateArray()) _rows.AddChild(Text(t.GetString()!, 12, Muted));
        }

        _rows.AddChild(Text("Routes", 15, Body));
        var routes = m.GetProperty("routes");
        if (routes.GetArrayLength() == 0) _rows.AddChild(Text("No routes yet.", 12, Muted));
        foreach (var r in routes.EnumerateArray())
        {
            var row = new HBoxContainer();
            var words = new VBoxContainer { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
            var t1 = Text(r.GetProperty("title").GetString()!, 13, r.GetProperty("idle").GetBoolean() ? Muted : Body);
            t1.CustomMinimumSize = new Vector2(300, 0);
            var t2 = Text(r.GetProperty("detail").GetString()!, 12, Muted);
            t2.CustomMinimumSize = new Vector2(300, 0);
            words.AddChild(t1);
            words.AddChild(t2);
            if (r.GetProperty("trip").ValueKind == JsonValueKind.Number)
                words.AddChild(new ProgressBar { Value = r.GetProperty("trip").GetDouble() * 100, ShowPercentage = false, CustomMinimumSize = new Vector2(280, 6), Modulate = r.GetProperty("outbound").GetBoolean() ? new Color("#6fb3c9") : new Color("#9aa7ab") });
            row.AddChild(words);
            var id = r.GetProperty("id").GetInt32();
            var end = new Button { Text = "×", TooltipText = "End this route", FocusMode = Control.FocusModeEnum.None };
            end.Pressed += () => _send(new Dictionary<string, object> { ["type"] = "route", ["id"] = _id++, ["action"] = new Dictionary<string, object> { ["kind"] = "remove", ["routeId"] = id } });
            row.AddChild(end);
            _rows.AddChild(row);
        }

        var form = m.GetProperty("form");
        // Read now: the message is gone by the time a button is pressed.
        var fromId = form.GetProperty("fromId").GetInt32();
        _rows.AddChild(Text($"New route from {form.GetProperty("from").GetString()}   ·   {form.GetProperty("busy").GetString()}", 15, Body));
        var targets = form.GetProperty("targets").EnumerateArray().Select(t => (id: t.GetProperty("id").GetInt32(), name: t.GetProperty("name").GetString()!)).ToList();
        if (targets.Count > 0)
        {
            if (!targets.Any(t => t.id == _to)) _to = targets[0].id;
            var to = new OptionButton { FocusMode = Control.FocusModeEnum.None };
            foreach (var t in targets) to.AddItem($"To {t.name}", t.id);
            to.Select(targets.FindIndex(t => t.id == _to));
            to.ItemSelected += i => _to = (int)to.GetItemId((int)i);
            _rows.AddChild(to);
            var resources = form.GetProperty("resources").EnumerateArray().Select(x => (id: x.GetProperty("id").GetString()!, name: x.GetProperty("name").GetString()!)).ToList();
            var carry = new OptionButton { FocusMode = Control.FocusModeEnum.None };
            for (var i = 0; i < resources.Count; i++) carry.AddItem($"Carry {resources[i].name}", i);
            var at = resources.FindIndex(x => x.id == _resource);
            if (at < 0 && resources.Count > 0) _resource = resources[at = 0].id;
            if (at >= 0) carry.Select(at);
            carry.ItemSelected += i => _resource = resources[(int)i].id;
            _rows.AddChild(carry);
            var steps = form.GetProperty("steps").EnumerateArray().Select(x => x.GetInt32()).ToList();
            var per = new OptionButton { FocusMode = Control.FocusModeEnum.None };
            foreach (var n in steps) per.AddItem($"{n} per trip", n);
            per.Select(Math.Max(0, steps.IndexOf(_amount)));
            per.ItemSelected += i => _amount = steps[(int)i];
            _rows.AddChild(per);
            var start = new Button { Text = "Start route", FocusMode = Control.FocusModeEnum.None };
            start.Pressed += () => _send(new Dictionary<string, object>
            {
                ["type"] = "route", ["id"] = _id++,
                ["action"] = new Dictionary<string, object> { ["kind"] = "add", ["fromHoleId"] = fromId, ["toHoleId"] = _to, ["resource"] = _resource, ["amountPerTrip"] = _amount },
            });
            _rows.AddChild(start);
        }
        if (form.GetProperty("hint").ValueKind == JsonValueKind.String) _rows.AddChild(Text(form.GetProperty("hint").GetString()!, 12, Muted));
    }

    /// <summary>One culture axis: its two ends, and each hole as a dot now and a ring where it's heading.</summary>
    partial class Axis : Control
    {
        readonly string _left, _right;
        readonly List<(Color color, float now, float target)> _holes = new();

        public Axis(JsonElement a)
        {
            _left = a.GetProperty("left").GetString()!;
            _right = a.GetProperty("right").GetString()!;
            foreach (var h in a.GetProperty("holes").EnumerateArray())
                _holes.Add((new Color(h.GetProperty("color").GetString()!), h.GetProperty("now").GetSingle(), h.GetProperty("target").GetSingle()));
        }

        public override void _Draw()
        {
            var font = ThemeDB.FallbackFont;
            DrawString(font, new Vector2(0, 12), _left, HorizontalAlignment.Left, -1, 11, Muted);
            DrawString(font, new Vector2(0, 12), _right, HorizontalAlignment.Right, Size.X, 11, Muted);
            float x0 = 8, x1 = Size.X - 8, y = 24;
            DrawLine(new Vector2(x0, y), new Vector2(x1, y), new Color(1, 1, 1, 0.2f), 2);
            foreach (var (color, now, target) in _holes)
            {
                DrawArc(new Vector2(Mathf.Lerp(x0, x1, (target + 1) / 2), y), 5, 0, Mathf.Tau, 16, color, 1.5f);
                DrawCircle(new Vector2(Mathf.Lerp(x0, x1, (now + 1) / 2), y), 4, color);
            }
        }
    }
}
