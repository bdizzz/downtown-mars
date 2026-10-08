using System;
using System.Collections.Generic;
using System.Linq;
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
/// Settings, as the web's (ui/SettingsView.tsx), those that apply here: autosave each game day,
/// colour-blind overlays, the interface size, the graphics level, and the tutorial. Kept in
/// user://settings.cfg with the view.
/// </summary>
public partial class SettingsSheet : Sheet
{
    static readonly float[] Scales = { 0.85f, 1, 1.15f, 1.3f };
    readonly CheckBox _autosave = new() { Text = "Autosave every month", FocusMode = FocusModeEnum.None };
    readonly CheckBox _colorBlind = new() { Text = "Colour-blind friendly overlays (orange and blue)", FocusMode = FocusModeEnum.None };
    readonly CheckBox _tutorial = new() { Text = "Show the tutorial", FocusMode = FocusModeEnum.None };
    readonly OptionButton _scale = new() { FocusMode = FocusModeEnum.None };
    readonly OptionButton _graphics = new() { FocusMode = FocusModeEnum.None };
    bool _filling;

    /// <summary>Something changed: Live applies it (and tells the bridge what it needs to know).</summary>
    public Action? Changed { get; set; }
    public Func<int>? GetQuality { get; set; }
    public Action<int>? SetQuality { get; set; }

    public SettingsSheet() : base(460)
    {
        Title("Settings");
        foreach (var c in new[] { _autosave, _colorBlind, _tutorial }) Rows.AddChild(c);
        _autosave.Toggled += on => Set(() => ViewSettings.Autosave = on);
        _colorBlind.Toggled += on => Set(() => ViewSettings.ColorBlind = on);
        _tutorial.Toggled += on => Set(() => ViewSettings.TutorialHidden = !on);
        Row("Interface size", _scale);
        foreach (var s in Scales) _scale.AddItem($"{Mathf.RoundToInt(s * 100)}%");
        _scale.ItemSelected += i => Set(() => ViewSettings.UiScale = Scales[i]);
        Row("Graphics", _graphics);
        foreach (var q in Enum.GetNames<Quality>()) _graphics.AddItem(q);
        _graphics.ItemSelected += i =>
        {
            if (!_filling) SetQuality?.Invoke((int)i);
        };
        var back = new Button { Text = "Back", FocusMode = FocusModeEnum.None, SizeFlagsHorizontal = SizeFlags.ShrinkCenter };
        back.Pressed += Close;
        Rows.AddChild(back);
    }

    void Row(string label, Control control)
    {
        var row = new HBoxContainer();
        row.AddThemeConstantOverride("separation", 10);
        var l = Text(label, 15, new Color("#e0cfbd"));
        l.AutowrapMode = TextServer.AutowrapMode.Off;
        row.AddChild(l);
        row.AddChild(control);
        Rows.AddChild(row);
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
        _autosave.ButtonPressed = ViewSettings.Autosave;
        _colorBlind.ButtonPressed = ViewSettings.ColorBlind;
        _tutorial.ButtonPressed = !ViewSettings.TutorialHidden;
        _scale.Select(Math.Max(0, Array.IndexOf(Scales, ViewSettings.UiScale)));
        _graphics.Select(GetQuality?.Invoke() ?? 0);
        _filling = false;
        base.Open();
    }
}
