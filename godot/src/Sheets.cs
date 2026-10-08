using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>A sheet over the game: the screen dimmed, a panel in the middle; a click outside or Esc closes it.</summary>
public partial class Sheet : Control
{
    protected readonly VBoxContainer Rows = new();

    public Sheet(float width)
    {
        SetAnchorsPreset(LayoutPreset.FullRect);
        MouseFilter = MouseFilterEnum.Stop;
        Visible = false;
        var dim = new ColorRect { Color = new Color(0, 0, 0, 0.45f) };
        dim.SetAnchorsPreset(LayoutPreset.FullRect);
        dim.GuiInput += e =>
        {
            if (e is InputEventMouseButton { Pressed: true }) Close();
        };
        AddChild(dim);
        var center = new CenterContainer { MouseFilter = MouseFilterEnum.Ignore };
        center.SetAnchorsPreset(LayoutPreset.FullRect);
        AddChild(center);
        var panel = new PanelContainer { CustomMinimumSize = new Vector2(width, 0) };
        // Opaque: it may sit over the menu.
        var style = Live.Panel();
        style.BgColor = style.BgColor with { A = 0.97f };
        panel.AddThemeStyleboxOverride("panel", style);
        center.AddChild(panel);
        Rows.AddThemeConstantOverride("separation", 8);
        panel.AddChild(Rows);
    }

    public virtual void Open() => Visible = true;
    public void Close() => Visible = false;

    public override void _GuiInput(InputEvent e)
    {
        if (e is InputEventKey { Pressed: true, Keycode: Key.Escape })
        {
            Close();
            AcceptEvent();
        }
    }

    public override void _UnhandledKeyInput(InputEvent e)
    {
        if (Visible && e is InputEventKey { Pressed: true, Keycode: Key.Escape })
        {
            Close();
            GetViewport().SetInputAsHandled();
        }
    }

    protected Label Title(string text)
    {
        var l = new Label { Text = text };
        l.AddThemeFontSizeOverride("font_size", 22);
        l.AddThemeColorOverride("font_color", new Color("#e8834a"));
        Rows.AddChild(l);
        return l;
    }

    protected static Label Text(string text, int size, Color color)
    {
        var l = new Label { Text = text, AutowrapMode = TextServer.AutowrapMode.WordSmart };
        l.AddThemeFontSizeOverride("font_size", size);
        l.AddThemeColorOverride("font_color", color);
        return l;
    }
}

/// <summary>
/// The controls, as the web's Help (? or F1, or from the menu): the general keys and mouse, adjusted
/// to this viewer's, and each room's build key (from the palette).
/// </summary>
public partial class HelpSheet : Sheet
{
    static readonly (string key, string what)[] General =
    {
        ("B", "Build: categories along the bottom, each popping up its rooms; a room's key picks it while Build is open"),
        ("R", "Rotate the room you're placing"),
        ("Z", "Corridor tool: click a border, or drag a chain along borders and confirm it; Shift fills in"),
        ("X", "Demolish tool: click a room (half its cost back)"),
        ("⌘Z / Ctrl+Z", "Undo your last placement"),
        ("Esc / right-click", "Put down the tool, close a panel, or open the menu"),
        ("Space", "Pause / resume"),
        ("1 2 3", "1×, 2×, 4×"),
        ("↑ ↓", "The floor up / down (Home: every floor)"),
        ("Tab", "First person and back"),
        ("WASD", "First person: walk; Iso: pan"),
        ("Drag / scroll sideways", "Turn the view"),
        ("Scroll / pinch", "Zoom (in the cutaway, scroll moves along the hole)"),
        ("O  C  M  N  P", "Office, Charts, Map, Network, Colony"),
        ("[ ]", "Previous / next hole"),
        ("L", "Labels on or off"),
        ("F2", "Graphics level"),
        ("F12", "Screenshot"),
        ("? / F1", "This help"),
    };

    readonly GridContainer _keys = new() { Columns = 2 };
    readonly GridContainer _rooms = new() { Columns = 2 };

    /// <summary>The rooms with build keys: (key, name), from the palette.</summary>
    public Func<IEnumerable<(string key, string name)>>? RoomKeys { get; set; }

    public HelpSheet() : base(760)
    {
        Title("Controls");
        var cols = new HBoxContainer();
        cols.AddThemeConstantOverride("separation", 28);
        Rows.AddChild(cols);
        _keys.AddThemeConstantOverride("h_separation", 12);
        _keys.AddThemeConstantOverride("v_separation", 4);
        _rooms.AddThemeConstantOverride("h_separation", 12);
        _rooms.AddThemeConstantOverride("v_separation", 4);
        cols.AddChild(_keys);
        cols.AddChild(_rooms);
        foreach (var (key, what) in General) Pair(_keys, key, what, 380);
        var ok = new Button { Text = "Got it", FocusMode = FocusModeEnum.None, SizeFlagsHorizontal = SizeFlags.ShrinkCenter };
        ok.Pressed += Close;
        Rows.AddChild(ok);
    }

    static void Pair(GridContainer grid, string key, string what, float width)
    {
        var k = Text(key, 13, new Color("#f3e6d8"));
        k.AutowrapMode = TextServer.AutowrapMode.Off;
        var w = Text(what, 13, new Color("#c9b29c"));
        w.CustomMinimumSize = new Vector2(width, 0);
        grid.AddChild(k);
        grid.AddChild(w);
    }

    public override void Open()
    {
        foreach (var c in _rooms.GetChildren()) c.QueueFree();
        foreach (var (key, name) in (RoomKeys?.Invoke() ?? Enumerable.Empty<(string, string)>()).OrderBy(r => r.key)) Pair(_rooms, key, name, 160);
        base.Open();
    }
}

/// <summary>
/// Settings, as the web's (ui/SettingsView.tsx) and from the same table (data/settings.json): its
/// sections as tabs, each setting a row with its name, a one-line hint and its control, those that
/// apply here (autosave each game day, the tutorial, the graphics level, interface size, colour-blind
/// overlays, and the keys). Kept in user://settings.cfg with the view. Every control takes the
/// keyboard: Tab and the arrows move, Enter and Space act, Ctrl+Tab changes section.
/// </summary>
public partial class SettingsSheet : Sheet
{
    readonly TabContainer _tabs = new() { CustomMinimumSize = new Vector2(0, 300) };
    /// <summary>Each row's control, and how to fill it from the settings when the sheet opens.</summary>
    readonly List<Action> _fill = new();
    readonly List<Control> _first = new();
    bool _filling;

    /// <summary>Something changed: Live applies it (and tells the bridge what it needs to know).</summary>
    public Action? Changed { get; set; }
    public Func<int>? GetQuality { get; set; }
    public Action<int>? SetQuality { get; set; }
    /// <summary>The keys (Help).</summary>
    public Action? KeysPressed { get; set; }

    public SettingsSheet() : base(560)
    {
        Title("Settings");
        Rows.AddChild(_tabs);
        using var doc = JsonDocument.Parse(System.IO.File.ReadAllText(ProjectSettings.GlobalizePath("res://") + "../data/settings.json"));
        var rows = doc.RootElement.GetProperty("settings").EnumerateArray()
            .Where(r => !r.TryGetProperty("only", out var only) || only.GetString() == "godot")
            .Select(r => r.Clone())
            .ToList();
        foreach (var section in doc.RootElement.GetProperty("sections").EnumerateArray())
        {
            var id = section.GetProperty("id").GetString();
            var mine = rows.Where(r => r.GetProperty("section").GetString() == id).ToList();
            var list = new VBoxContainer { Name = section.GetProperty("name").GetString()! };
            list.AddThemeConstantOverride("separation", 4);
            Control? first = null;
            foreach (var r in mine)
                if (Make(r) is Control c)
                {
                    first ??= c;
                    list.AddChild(RowOf(r, c));
                }
            if (first == null) continue;
            _tabs.AddChild(list);
            _first.Add(first);
        }
        _tabs.TabChanged += t => _first[(int)t].CallDeferred(Control.MethodName.GrabFocus);
        var back = new Button { Text = "Back", SizeFlagsHorizontal = SizeFlags.ShrinkBegin };
        back.Pressed += Close;
        Rows.AddChild(back);
    }

    /// <summary>A row's control, bound to its setting (a new row in the table gets a case here).</summary>
    Control? Make(JsonElement r)
    {
        var id = r.GetProperty("id").GetString();
        switch (id)
        {
            case "autosave": return Toggle(() => ViewSettings.Autosave, on => ViewSettings.Autosave = on);
            case "tutorial": return Toggle(() => !ViewSettings.TutorialHidden, on => ViewSettings.TutorialHidden = !on);
            case "colorBlind": return Toggle(() => ViewSettings.ColorBlind, on => ViewSettings.ColorBlind = on);
            case "uiScale":
            {
                var scales = r.GetProperty("options").EnumerateArray().Select(o => (value: o.GetProperty("value").GetSingle(), name: o.GetProperty("name").GetString()!)).ToArray();
                var pick = new OptionButton();
                foreach (var s in scales) pick.AddItem(s.name);
                pick.ItemSelected += i => Set(() => ViewSettings.UiScale = scales[i].value);
                _fill.Add(() => pick.Select(Math.Max(0, Array.FindIndex(scales, s => Mathf.IsEqualApprox(s.value, ViewSettings.UiScale)))));
                return pick;
            }
            case "graphics.quality":
            {
                var pick = new OptionButton();
                foreach (var q in Enum.GetNames<Quality>()) pick.AddItem(q);
                pick.ItemSelected += i =>
                {
                    if (!_filling) SetQuality?.Invoke((int)i);
                };
                _fill.Add(() => pick.Select(GetQuality?.Invoke() ?? 0));
                return pick;
            }
            case "keys":
            {
                var b = new Button { Text = "Show" };
                b.Pressed += () => KeysPressed?.Invoke();
                return b;
            }
            default:
                return null;
        }
    }

    CheckButton Toggle(Func<bool> get, Action<bool> set)
    {
        var c = new CheckButton();
        c.Toggled += on => Set(() => set(on));
        _fill.Add(() => c.ButtonPressed = get());
        return c;
    }

    /// <summary>Name and hint on the left, the control on the right.</summary>
    static Control RowOf(JsonElement r, Control control)
    {
        var row = new HBoxContainer();
        row.AddThemeConstantOverride("separation", 12);
        var text = new VBoxContainer { SizeFlagsHorizontal = SizeFlags.ExpandFill };
        text.AddThemeConstantOverride("separation", 0);
        text.AddChild(Text(r.GetProperty("name").GetString()!, 15, new Color("#f0e0d0")));
        text.AddChild(Text(r.GetProperty("hint").GetString()!, 12, new Color("#a88d7c")));
        row.AddChild(text);
        control.SizeFlagsVertical = SizeFlags.ShrinkCenter;
        control.TooltipText = r.GetProperty("hint").GetString();
        row.AddChild(control);
        return row;
    }

    void Set(Action change)
    {
        if (_filling) return;
        change();
        ViewSettings.Save();
        Changed?.Invoke();
    }

    public override void Open()
    {
        _filling = true;
        foreach (var f in _fill) f();
        _filling = false;
        base.Open();
        _first[_tabs.CurrentTab].CallDeferred(Control.MethodName.GrabFocus);
    }
}
