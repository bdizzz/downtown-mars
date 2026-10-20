using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// Show me (F-018): the rooms behind a problem and the homes feeling it, and the floor of the one to look
/// at first (null: none in the rings). From the bridge's spots (bridge/why.ts FloorSpot).
/// </summary>
public record ShowSpot(int[] Rooms, int[] Homes, int Focus, int? Floor)
{
    /// <summary>A spot from the bridge, or null for none.</summary>
    public static ShowSpot? Parse(JsonElement e)
    {
        if (e.ValueKind != JsonValueKind.Object) return null;
        var floor = e.TryGetProperty("floor", out var f) && f.ValueKind == JsonValueKind.Number ? f.GetInt32() : (int?)null;
        return new ShowSpot(
            e.GetProperty("rooms").EnumerateArray().Select(x => x.GetInt32()).ToArray(),
            e.GetProperty("homes").EnumerateArray().Select(x => x.GetInt32()).ToArray(),
            e.GetProperty("focus").GetInt32(),
            floor);
    }

    /// <summary>As the bridge takes it back (for the plan's tints).</summary>
    public Dictionary<string, object> ToMessage() => new() { ["rooms"] = Rooms, ["homes"] = Homes, ["focus"] = Focus };
}

/// <summary>
/// The "Why?" panel, as the web's (ui/WhyPanel.tsx, its words from view/whyPanel.ts through the bridge's
/// why.ts): what's hurting health and happiness, biggest first, each with its fix and a Show me that lights
/// up the rooms behind it and the homes feeling it (red and amber outlines; tints on the plan) and goes to
/// their floor; under Happiness, the unhappiest homes, a click away; and a link to Trends. Opened by
/// clicking Health or Happiness on the bar. It takes its turn on the right with the office and the rest.
/// </summary>
public partial class WhyPanel : Node
{
    readonly PanelContainer _panel = new();
    readonly VBoxContainer _rows = new();
    JsonElement? _msg;
    string _tab = "health";
    string _key = "";

    /// <summary>Show me on (a cause's id and its spot) or off (null, null).</summary>
    public Action<string?, ShowSpot?>? Show { get; set; }
    /// <summary>The cause Show me is on, or null (Live keeps it).</summary>
    public string? Shown { get; set; }
    /// <summary>A home picked from the unhappiest: select it.</summary>
    public Action<int>? SelectRoom { get; set; }
    /// <summary>The link to Trends: "health" or "happiness".</summary>
    public Action<string>? Trend { get; set; }
    /// <summary>Opened: the others on the right close.</summary>
    public Action? Opened { get; set; }

    public bool Open => _panel.Visible;

    static readonly Color Title = new("#e8834a"), Body = new("#f3e6d8"), Muted = new("#b8a490"), Bad = new("#ff8a6c"), Good = new("#9fd28a");

    public WhyPanel(CanvasLayer hud)
    {
        _panel.Visible = false;
        _panel.SetAnchorsPreset(Control.LayoutPreset.TopRight);
        _panel.GrowHorizontal = Control.GrowDirection.Begin;
        _panel.Position = new Vector2(-400, 100);
        _panel.SetMeta("under_top", true);
        _panel.AddThemeStyleboxOverride("panel", Live.Panel());
        hud.AddChild(_panel);
        var scroll = new ScrollContainer { CustomMinimumSize = new Vector2(370, 640), HorizontalScrollMode = ScrollContainer.ScrollMode.Disabled };
        _panel.AddChild(scroll);
        _rows.AddThemeConstantOverride("separation", 6);
        _rows.CustomMinimumSize = new Vector2(350, 0);
        scroll.AddChild(_rows);
    }

    /// <summary>Open on a tab ("health" or "happiness"), or close (null). Show me lasts while it's open (Live sees to it).</summary>
    public void Toggle(string? tab)
    {
        var open = tab != null;
        if (tab != null) _tab = tab;
        _panel.Visible = open;
        _key = "";
        if (!open) return;
        Opened?.Invoke();
        Refresh();
    }

    static Label Text(string text, int size, Color color)
    {
        var l = new Label { Text = text, AutowrapMode = TextServer.AutowrapMode.WordSmart, CustomMinimumSize = new Vector2(330, 0) };
        l.AddThemeFontSizeOverride("font_size", size);
        l.AddThemeColorOverride("font_color", color);
        return l;
    }

    static Button Small(string text, string tip = "")
    {
        var b = new Button { Text = text, TooltipText = tip, FocusMode = Control.FocusModeEnum.None, SizeFlagsHorizontal = Control.SizeFlags.ShrinkBegin };
        b.AddThemeFontSizeOverride("font_size", 12);
        return b;
    }

    /// <summary>The bridge's "why" message.</summary>
    public void Set(JsonElement msg)
    {
        _msg = msg.Clone();
        if (Open) Refresh();
    }

    /// <summary>Show me changed elsewhere (Live): redraw the buttons.</summary>
    public void Restyle()
    {
        _key = "";
        if (Open) Refresh();
    }

    void Refresh()
    {
        if (_msg is not JsonElement m) return;
        var key = $"{_tab}:{Shown}:{m.GetRawText()}";
        if (key == _key) return;
        _key = key;
        foreach (var c in _rows.GetChildren())
        {
            _rows.RemoveChild(c);
            c.QueueFree();
        }
        var head = new HBoxContainer();
        var title = Text("Why?", 20, Title);
        title.CustomMinimumSize = Vector2.Zero;
        title.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        head.AddChild(title);
        var close = new Button { Text = "×", Flat = true, FocusMode = Control.FocusModeEnum.None };
        close.Pressed += () => Toggle(null);
        head.AddChild(close);
        _rows.AddChild(head);

        var tabs = new HBoxContainer();
        foreach (var (id, name) in new[] { ("health", "Health"), ("happiness", "Happiness") })
        {
            var b = new Button { Text = name, ToggleMode = true, ButtonPressed = _tab == id, FocusMode = Control.FocusModeEnum.None };
            b.Pressed += () =>
            {
                _tab = id;
                Refresh();
            };
            tabs.AddChild(b);
        }
        _rows.AddChild(tabs);

        var section = m.GetProperty(_tab);
        _rows.AddChild(Text(section.GetProperty("headline").GetString()!, 16, Body));
        _rows.AddChild(Text(section.GetProperty("note").GetString()!, 12, Muted));
        var items = section.GetProperty("items");
        if (items.GetArrayLength() == 0) _rows.AddChild(Text("Nothing to fix.", 13, Muted));
        foreach (var item in items.EnumerateArray())
        {
            var bad = item.GetProperty("bad").GetBoolean();
            _rows.AddChild(Text($"{item.GetProperty("amount").GetString()}  {item.GetProperty("text").GetString()}", 14, bad ? Bad : Good));
            if (item.TryGetProperty("from", out var from)) _rows.AddChild(Text(from.GetString()!, 12, Muted));
            if (item.TryGetProperty("fix", out var fix)) _rows.AddChild(Text($"Fix: {fix.GetString()}", 13, Body));
            if (ShowSpot.Parse(item.GetProperty("spot")) is { } spot)
            {
                var id = item.GetProperty("id").GetString()!;
                var on = Shown == id;
                var b = Small(on ? "Showing" : "Show me", "Light up the rooms behind it (red) and the homes feeling it (amber), on their floor");
                b.ToggleMode = true;
                b.ButtonPressed = on;
                b.Pressed += () => Show?.Invoke(on ? null : id, on ? null : spot);
                _rows.AddChild(b);
            }
        }

        var worst = m.GetProperty("worst");
        if (_tab == "happiness" && worst.GetArrayLength() > 0)
        {
            _rows.AddChild(Text("Unhappiest homes", 16, Body));
            foreach (var w in worst.EnumerateArray())
            {
                var room = w.GetProperty("roomId").GetInt32();
                var b = new Button
                {
                    Text = $"{w.GetProperty("happiness").GetInt32()}  {w.GetProperty("name").GetString()}\n{w.GetProperty("text").GetString()}",
                    Alignment = HorizontalAlignment.Left,
                    AutowrapMode = TextServer.AutowrapMode.WordSmart,
                    CustomMinimumSize = new Vector2(330, 0),
                    FocusMode = Control.FocusModeEnum.None,
                    TooltipText = "Select it, to see what makes up its noise, comfort and wellbeing",
                };
                b.AddThemeFontSizeOverride("font_size", 13);
                b.Pressed += () => SelectRoom?.Invoke(room);
                _rows.AddChild(b);
            }
        }

        var trend = Small($"{(_tab == "health" ? "Health" : "Happiness")} over time, by cause →");
        var tab = _tab;
        trend.Pressed += () => Trend?.Invoke(tab);
        _rows.AddChild(trend);
    }
}

/// <summary>
/// The deputy's one-time tip, as the web's (ui/TipCard.tsx, view/tips.ts through the bridge's why.ts): the
/// first time a problem shows up, what's behind it and how to fix it, with Show me. Got it puts it away for
/// good (the save remembers); No more tips turns them off (Settings → Tips). It sits where the tutorial's
/// card does, over it while it's up.
/// </summary>
public partial class TipCard : PanelContainer
{
    readonly Label _name = new(), _say = new(), _hint = new();
    readonly Button _show = new() { Text = "Show me", ToggleMode = true, FocusMode = FocusModeEnum.None };
    string? _id;
    ShowSpot? _spot;
    bool _have, _on = true, _away;

    /// <summary>Show me on (the tip's id, as "tip:&lt;id&gt;", and its spot) or off (null, null).</summary>
    public Action<string?, ShowSpot?>? OnShow { get; set; }
    /// <summary>Got it: the tip's id, to send as "seeTip".</summary>
    public Action<string>? Seen { get; set; }
    /// <summary>No more tips.</summary>
    public Action? Off { get; set; }
    /// <summary>Whether a tip is up (the tutorial's card steps aside for it).</summary>
    public bool Up => Visible;
    /// <summary>The tip's Show me id, or null.</summary>
    public string? ShowId => _id == null ? null : $"tip:{_id}";

    static Label Style(Label l, int size, Color color)
    {
        l.AddThemeFontSizeOverride("font_size", size);
        l.AddThemeColorOverride("font_color", color);
        l.AutowrapMode = TextServer.AutowrapMode.WordSmart;
        return l;
    }

    public TipCard(CanvasLayer hud)
    {
        AddThemeStyleboxOverride("panel", Live.Panel());
        SetAnchorsPreset(LayoutPreset.BottomRight);
        GrowHorizontal = GrowDirection.Begin;
        GrowVertical = GrowDirection.Begin;
        Position = new Vector2(-400, -190);
        CustomMinimumSize = new Vector2(380, 0);
        Visible = false;
        hud.AddChild(this);
        var rows = new VBoxContainer();
        rows.AddThemeConstantOverride("separation", 6);
        AddChild(rows);
        rows.AddChild(Style(_name, 15, new Color("#f3e6d8")));
        rows.AddChild(Style(_say, 16, new Color("#f3e6d8")));
        rows.AddChild(Style(_hint, 13, new Color("#a8927e")));
        var buttons = new HBoxContainer();
        buttons.AddThemeConstantOverride("separation", 6);
        rows.AddChild(buttons);
        _show.TooltipText = "Light up who's making it (red) and who's feeling it (amber)";
        _show.Pressed += () =>
        {
            if (_id == null) return;
            OnShow?.Invoke(_show.ButtonPressed ? ShowId : null, _show.ButtonPressed ? _spot : null);
        };
        buttons.AddChild(_show);
        var seen = new Button { Text = "Got it", FocusMode = FocusModeEnum.None };
        seen.Pressed += () =>
        {
            if (_id != null) Seen?.Invoke(_id);
        };
        buttons.AddChild(seen);
        var off = new Button { Text = "No more tips", Flat = true, FocusMode = FocusModeEnum.None, TooltipText = "Settings → Tips turns them back on", SizeFlagsHorizontal = SizeFlags.ShrinkEnd };
        off.AddThemeFontSizeOverride("font_size", 13);
        off.AddThemeColorOverride("font_color", new Color("#c9b29c"));
        off.Pressed += () => Off?.Invoke();
        rows.AddChild(off);
    }

    /// <summary>The setting: tips on or off.</summary>
    public void SetOn(bool on)
    {
        _on = on;
        Refresh();
    }

    /// <summary>Out of the way in first person, as the tutorial's card.</summary>
    public bool Away
    {
        get => _away;
        set
        {
            _away = value;
            Refresh();
        }
    }

    /// <summary>Show me went off elsewhere: the button follows.</summary>
    public void ShowOff() => _show.ButtonPressed = false;

    void Refresh() => Visible = _have && _on && !_away;

    /// <summary>The bridge's "tip" message: the tip due, or none.</summary>
    public void Set(JsonElement m)
    {
        var tip = m.GetProperty("tip");
        _have = tip.ValueKind == JsonValueKind.Object;
        if (_have)
        {
            var id = tip.GetProperty("id").GetString()!;
            if (id != _id) _show.ButtonPressed = false;
            _id = id;
            _name.Text = $"{tip.GetProperty("name").GetString()} · deputy";
            _say.Text = tip.GetProperty("text").GetString();
            _hint.Text = tip.GetProperty("hint").GetString();
            _spot = ShowSpot.Parse(tip.GetProperty("spot"));
            _show.Visible = _spot != null;
        }
        else
        {
            _id = null;
            _spot = null;
            _show.ButtonPressed = false;
        }
        Refresh();
    }
}
