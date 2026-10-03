using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// The colony panels, as the web's, in tabs: People (life stages, births and what holds them back,
/// school, care and meals, the departed, who's moving on next), Construction (the queue, with how far
/// along and when, to move a job to the front or cancel it) and Maintenance (overall condition, what
/// each crew is repairing, and the queue, worst first). From the bridge's colony.ts. A room's name
/// opens its panel.
/// </summary>
public partial class ColonyPanel : Node
{
    readonly Action<object> _send;
    readonly PanelContainer _panel = new();
    readonly VBoxContainer _rows = new();
    string _tab = "people";
    double _clock, _asked;
    int _id = 5_000_000;

    public Action? Opened { get; set; }
    /// <summary>A room's name was clicked: show it.</summary>
    public Action<int>? ShowRoom { get; set; }
    public bool Open => _panel.Visible;
    static readonly Color Title = new("#e8834a"), Body = new("#f3e6d8"), Muted = new("#b8a490"), Warn = new("#f0a030"), Good = new("#9fd28a");

    public ColonyPanel(CanvasLayer hud, Action<object> send)
    {
        _send = send;
        _panel.Visible = false;
        _panel.SetAnchorsPreset(Control.LayoutPreset.TopRight);
        _panel.GrowHorizontal = Control.GrowDirection.Begin;
        _panel.Position = new Vector2(-400, 100);
        // Kept just under the top bar, however tall it wraps (Live).
        _panel.SetMeta("under_top", true);
        _panel.AddThemeStyleboxOverride("panel", Live.Panel());
        hud.AddChild(_panel);
        var scroll = new ScrollContainer { CustomMinimumSize = new Vector2(370, 640), HorizontalScrollMode = ScrollContainer.ScrollMode.Disabled };
        _panel.AddChild(scroll);
        _rows.AddThemeConstantOverride("separation", 5);
        _rows.CustomMinimumSize = new Vector2(350, 0);
        scroll.AddChild(_rows);
    }

    public void Toggle(bool? open = null, string? tab = null)
    {
        if (tab != null) _tab = tab;
        _panel.Visible = open ?? !_panel.Visible;
        if (!_panel.Visible) return;
        Opened?.Invoke();
        Ask();
    }

    void Ask()
    {
        _asked = _clock;
        _send(new Dictionary<string, object> { ["type"] = "colony", ["tab"] = _tab });
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

    void Start(string title)
    {
        foreach (var c in _rows.GetChildren())
        {
            _rows.RemoveChild(c);
            c.QueueFree();
        }
        var head = new HBoxContainer();
        foreach (var (id, name) in new[] { ("people", "People"), ("construction", "Construction"), ("maintenance", "Maintenance") })
        {
            var b = new Button { Text = name, ToggleMode = true, ButtonPressed = id == _tab, FocusMode = Control.FocusModeEnum.None };
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
        _rows.AddChild(Text(title, 20, Title));
    }

    /// <summary>A label at a set width (in a row).</summary>
    static Label Sized(Label l, float width)
    {
        l.CustomMinimumSize = new Vector2(width, 0);
        return l;
    }

    /// <summary>A room's name as a link to its panel.</summary>
    Button Link(JsonElement room)
    {
        var id = room.GetProperty("id").GetInt32();
        var b = new Button { Text = room.GetProperty("name").GetString(), Flat = true, FocusMode = Control.FocusModeEnum.None, Alignment = HorizontalAlignment.Left, TooltipText = "Show it" };
        b.AddThemeColorOverride("font_color", new Color("#ffd8b8"));
        b.Pressed += () => ShowRoom?.Invoke(id);
        return b;
    }

    /// <summary>A bar: a share of its width filled in a colour, with an optional second share (repair under way) over it.</summary>
    static Control Bar(float share, Color color, float? over = null)
    {
        var back = new ColorRect { Color = new Color(1, 1, 1, 0.1f), CustomMinimumSize = new Vector2(340, 6) };
        back.AddChild(new ColorRect { Color = color, Size = new Vector2(340 * Math.Clamp(share, 0, 1), 6) });
        if (over is float o) back.AddChild(new ColorRect { Color = new Color(1, 1, 1, 0.45f), Size = new Vector2(340 * Math.Clamp(o, 0, 1), 2), Position = new Vector2(0, 4) });
        return back;
    }

    public void SetPeople(JsonElement m)
    {
        if (_tab != "people") return;
        Start("People");
        var st = m.GetProperty("stages");
        int child = st.GetProperty("child").GetInt32(), adult = st.GetProperty("adult").GetInt32(), elder = st.GetProperty("elder").GetInt32();
        float total = Math.Max(1, child + adult + elder);
        var stages = new HBoxContainer { CustomMinimumSize = new Vector2(340, 10) };
        stages.AddThemeConstantOverride("separation", 0);
        foreach (var (n, c) in new[] { (child, new Color("#9fd28a")), (adult, new Color("#6fb3c9")), (elder, new Color("#c9a456")) })
            if (n > 0) stages.AddChild(new ColorRect { Color = c, CustomMinimumSize = new Vector2(340 * n / total, 10) });
        _rows.AddChild(stages);
        _rows.AddChild(Text($"{child} {(child == 1 ? "child" : "children")}   ·   {adult} {(adult == 1 ? "adult" : "adults")}   ·   {elder} {(elder == 1 ? "elder" : "elders")}", 13, Body));
        var r = m.GetProperty("report");
        _rows.AddChild(Text(r.GetProperty("work").GetString()!, 12, Muted));
        if (r.GetProperty("leaving").ValueKind == JsonValueKind.String) _rows.AddChild(Text(r.GetProperty("leaving").GetString()!, 13, Warn));
        _rows.AddChild(Text("Births", 15, Body));
        var births = r.GetProperty("births");
        _rows.AddChild(Text(births.GetProperty("text").GetString()!, 13, births.GetProperty("ok").GetBoolean() ? Body : Warn));
        foreach (var c in r.GetProperty("checks").EnumerateArray())
        {
            var ok = c[0].GetBoolean();
            _rows.AddChild(Text($"{(ok ? "✓" : "✗")} {c[1].GetString()}", 12, ok ? Good : Muted));
        }
        _rows.AddChild(Text(r.GetProperty("born").GetString()!, 12, Muted));
        _rows.AddChild(Text("School, care and meals", 15, Body));
        foreach (var c in r.GetProperty("care").EnumerateArray()) _rows.AddChild(Text($"{c.GetProperty("label").GetString()}: {c.GetProperty("text").GetString()}", 13, Body));
        _rows.AddChild(Text("The departed", 15, Body));
        _rows.AddChild(Text(r.GetProperty("departed").GetString()!, 13, Body));
        if (r.GetProperty("grief").ValueKind == JsonValueKind.String) _rows.AddChild(Text(r.GetProperty("grief").GetString()!, 13, Warn));
        _rows.AddChild(Text("Coming up", 15, Body));
        foreach (var u in r.GetProperty("upcoming").EnumerateArray()) _rows.AddChild(Text(u.GetString()!, 13, Body));
    }

    public void SetConstruction(JsonElement m)
    {
        if (_tab != "construction") return;
        Start("Construction");
        _rows.AddChild(Text($"Bandwidth: {m.GetProperty("bandwidth").GetString()}", 13, Body));
        _rows.AddChild(Text("One job at a time, in order. Construction offices add bandwidth; staff them well.", 12, Muted));
        var jobs = m.GetProperty("jobs");
        if (jobs.GetArrayLength() == 0) _rows.AddChild(Text("Nothing in the queue.", 12, Muted));
        foreach (var j in jobs.EnumerateArray())
        {
            var id = j.GetProperty("id").GetInt32();
            var row = new HBoxContainer();
            if (j.GetProperty("room").ValueKind == JsonValueKind.Object) row.AddChild(Link(j.GetProperty("room")));
            else row.AddChild(Sized(Text(j.GetProperty("label").GetString()!, 13, Body), 150));
            var note = Text($"{j.GetProperty("note").GetString()} {j.GetProperty("when").GetString()}".Trim(), 12, Muted);
            note.CustomMinimumSize = new Vector2(110, 0);
            note.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            row.AddChild(note);
            if (!j.GetProperty("first").GetBoolean())
            {
                var up = new Button { Text = "⤒", TooltipText = "Priority construction: move it to the front", FocusMode = Control.FocusModeEnum.None };
                up.Pressed += () => Command("prioritize", id);
                row.AddChild(up);
            }
            var cancel = new Button { Text = "✕", TooltipText = "Cancel it, with a full refund", FocusMode = Control.FocusModeEnum.None };
            cancel.Pressed += () => Command("cancelJob", id);
            row.AddChild(cancel);
            _rows.AddChild(row);
            _rows.AddChild(Bar(j.GetProperty("progress").GetSingle(), new Color("#c9a456")));
        }
    }

    void Command(string type, int jobId)
    {
        _send(new Dictionary<string, object> { ["type"] = "command", ["id"] = _id++, ["command"] = new Dictionary<string, object> { ["type"] = type, ["jobId"] = jobId } });
        Ask();
    }

    public void SetMaintenance(JsonElement m)
    {
        if (_tab != "maintenance") return;
        Start("Maintenance");
        _rows.AddChild(Text($"Overall condition: {m.GetProperty("overallText").GetString()}", 13, Body));
        _rows.AddChild(Bar(m.GetProperty("overall").GetSingle(), new Color(m.GetProperty("overallColor").GetString()!)));
        _rows.AddChild(Text("Rooms wear down. Below 50% they get people down, below 30% they slow, and at 0% they stop. Each maintenance room repairs one room at a time, worst first; cleaning services take only homes and other rooms people share.", 12, Muted));
        _rows.AddChild(Text("At work", 15, Body));
        var lanes = m.GetProperty("lanes");
        if (lanes.GetArrayLength() == 0) _rows.AddChild(Text("No maintenance rooms yet: build one (Build → Services).", 12, Muted));
        foreach (var l in lanes.EnumerateArray())
        {
            var row = new HBoxContainer();
            row.AddChild(Sized(Text(l.GetProperty("icon").GetString()!, 14, Body), 22));
            row.AddChild(Link(l.GetProperty("by")));
            if (l.GetProperty("idle").ValueKind == JsonValueKind.String) row.AddChild(Sized(Text(l.GetProperty("idle").GetString()!, 12, Muted), 120));
            _rows.AddChild(row);
            if (l.GetProperty("target").ValueKind != JsonValueKind.Object) continue;
            var on = new HBoxContainer();
            on.AddChild(new Control { CustomMinimumSize = new Vector2(22, 0) });
            on.AddChild(Link(l.GetProperty("target")));
            on.AddChild(Sized(Text(l.GetProperty("done").GetString()!, 12, Muted), 90));
            _rows.AddChild(on);
            _rows.AddChild(Bar(l.GetProperty("condition").GetSingle(), new Color(l.GetProperty("color").GetString()!), l.GetProperty("progress").ValueKind == JsonValueKind.Number ? l.GetProperty("progress").GetSingle() : null));
        }
        _rows.AddChild(Text("Queue", 15, Body));
        var queue = m.GetProperty("queue");
        if (queue.GetArrayLength() == 0) _rows.AddChild(Text("Nothing waiting: every room is above 60%.", 12, Muted));
        foreach (var q in queue.EnumerateArray())
        {
            var row = new HBoxContainer();
            row.AddChild(Link(q.GetProperty("room")));
            row.AddChild(Sized(Text(q.GetProperty("text").GetString()!, 12, Muted), 120));
            _rows.AddChild(row);
            _rows.AddChild(Bar(q.GetProperty("condition").GetSingle(), new Color(q.GetProperty("color").GetString()!), q.GetProperty("progress").ValueKind == JsonValueKind.Number ? q.GetProperty("progress").GetSingle() : null));
        }
    }
}
