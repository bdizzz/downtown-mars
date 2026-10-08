using System;
using System.Linq;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// The tutorial, as the web's (ui/Tutorial.tsx, its goals worked out by the bridge's tutorial.ts): the
/// deputy's card at the bottom right, saying what to do next and how, with a dot per goal; it shrinks
/// to a pill (–), and Hide puts it away (Settings brings it back). ‹ and › (or a dot) pick the step
/// shown; the bridge keeps it, and moves on when its goal is met. What the goal points at pulses
/// (Live, from Highlight).
/// </summary>
public partial class Tutorial : PanelContainer
{
    readonly Label _face = new(), _name = new(), _intro = new(), _say = new(), _hint = new();
    readonly HBoxContainer _dots = new();
    readonly Button _prev = new() { Text = "‹", Flat = true, FocusMode = FocusModeEnum.None, TooltipText = "Previous step" };
    readonly Button _next = new() { Text = "›", Flat = true, FocusMode = FocusModeEnum.None, TooltipText = "Next step" };
    readonly Button _hide = new() { Text = "Hide tutorial", Flat = true, FocusMode = FocusModeEnum.None };
    readonly Button _pill = new() { FocusMode = FocusModeEnum.None, Visible = false };
    readonly VBoxContainer _rows = new();
    bool _small;
    int _total, _at = -1;

    /// <summary>What the current goal points at: "room:&lt;id&gt;", "hud:&lt;button&gt;", "overlay:&lt;type&gt;" or "tool:corridors"; null with none.</summary>
    public string? Highlight { get; private set; }
    /// <summary>Hide pressed.</summary>
    public Action? Dismissed { get; set; }
    /// <summary>A step picked (‹, › or a dot): the goal's index, which may run past either end (the bridge wraps it).</summary>
    public Action<int>? Stepped { get; set; }

    static Label Style(Label l, int size, Color color)
    {
        l.AddThemeFontSizeOverride("font_size", size);
        l.AddThemeColorOverride("font_color", color);
        l.AutowrapMode = TextServer.AutowrapMode.WordSmart;
        return l;
    }

    public Tutorial(CanvasLayer hud)
    {
        AddThemeStyleboxOverride("panel", Live.Panel());
        SetAnchorsPreset(LayoutPreset.BottomRight);
        GrowHorizontal = GrowDirection.Begin;
        GrowVertical = GrowDirection.Begin;
        Position = new Vector2(-400, -190);
        CustomMinimumSize = new Vector2(380, 0);
        Visible = false;
        hud.AddChild(this);
        AddChild(_rows);
        _rows.AddThemeConstantOverride("separation", 6);
        var who = new HBoxContainer();
        who.AddThemeConstantOverride("separation", 8);
        _rows.AddChild(who);
        Style(_face, 14, new Color("#1a0f0d")).AutowrapMode = TextServer.AutowrapMode.Off;
        _face.HorizontalAlignment = HorizontalAlignment.Center;
        _face.VerticalAlignment = VerticalAlignment.Center;
        _face.CustomMinimumSize = new Vector2(34, 34);
        _face.AddThemeStyleboxOverride("normal", new StyleBoxFlat { BgColor = new Color("#e8a070"), CornerRadiusTopLeft = 17, CornerRadiusTopRight = 17, CornerRadiusBottomLeft = 17, CornerRadiusBottomRight = 17 });
        who.AddChild(_face);
        Style(_name, 15, new Color("#f3e6d8")).AutowrapMode = TextServer.AutowrapMode.Off;
        _name.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        _name.VerticalAlignment = VerticalAlignment.Center;
        who.AddChild(_name);
        var shrink = new Button { Text = "–", Flat = true, FocusMode = FocusModeEnum.None, TooltipText = "Minimize" };
        shrink.Pressed += () => SetSmall(true);
        who.AddChild(shrink);
        _rows.AddChild(Style(_intro, 14, new Color("#e0cfbd")));
        _rows.AddChild(Style(_say, 16, new Color("#f3e6d8")));
        _rows.AddChild(Style(_hint, 13, new Color("#a8927e")));
        var steps = new HBoxContainer();
        steps.AddThemeConstantOverride("separation", 6);
        _rows.AddChild(steps);
        foreach (var b in new[] { _prev, _next })
        {
            b.AddThemeFontSizeOverride("font_size", 20);
            b.AddThemeColorOverride("font_color", new Color("#c9b29c"));
        }
        _prev.Pressed += () => Stepped?.Invoke(_at - 1);
        _next.Pressed += () => Stepped?.Invoke(_at + 1);
        steps.AddChild(_prev);
        _dots.AddThemeConstantOverride("separation", 4);
        _dots.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        _dots.Alignment = BoxContainer.AlignmentMode.Center;
        steps.AddChild(_dots);
        steps.AddChild(_next);
        _hide.AddThemeFontSizeOverride("font_size", 13);
        _hide.AddThemeColorOverride("font_color", new Color("#c9b29c"));
        _hide.SizeFlagsHorizontal = SizeFlags.ShrinkEnd;
        _hide.Pressed += () => Dismissed?.Invoke();
        _rows.AddChild(_hide);

        _pill.SetAnchorsPreset(LayoutPreset.BottomRight);
        _pill.GrowHorizontal = GrowDirection.Begin;
        _pill.GrowVertical = GrowDirection.Begin;
        _pill.Position = new Vector2(-190, -150);
        _pill.Pressed += () => SetSmall(false);
        hud.AddChild(_pill);
    }

    void SetSmall(bool small)
    {
        _small = small;
        Refresh();
    }

    bool _shown;

    /// <summary>On or off (the setting); with it on and a message in, the card (or its pill) shows.</summary>
    public void Show(bool on)
    {
        _shown = on;
        Refresh();
    }

    bool _have;

    void Refresh()
    {
        Visible = _shown && _have && !_small;
        _pill.Visible = _shown && _have && _small;
        if (!_shown) Highlight = null;
    }

    /// <summary>The bridge's "tutorial" message.</summary>
    public void Set(JsonElement m)
    {
        _have = true;
        var name = m.GetProperty("name").GetString()!;
        _face.Text = string.Concat(name.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(p => p[0]));
        _name.Text = $"{name} · deputy";
        _intro.Visible = m.GetProperty("intro").ValueKind == JsonValueKind.String;
        if (_intro.Visible) _intro.Text = m.GetProperty("intro").GetString();
        var goal = m.GetProperty("goal");
        var has = goal.ValueKind == JsonValueKind.Object;
        var shownDone = has && goal.GetProperty("done").GetBoolean();
        _say.Text = has ? (shownDone ? "✓ " : "") + goal.GetProperty("text").GetString() : m.GetProperty("outro").GetString();
        _hint.Visible = has;
        if (has) _hint.Text = goal.GetProperty("hint").GetString();
        Highlight = has && !shownDone ? goal.GetProperty("highlight").GetString() : null;
        _at = m.GetProperty("at").GetInt32();
        _prev.Visible = _next.Visible = has;
        _hide.Text = has ? "Hide tutorial" : "Close";
        var states = m.GetProperty("states").EnumerateArray().Select(x => x.GetString()).ToArray();
        _total = states.Length;
        if (_dots.GetChildCount() != states.Length)
        {
            foreach (var c in _dots.GetChildren()) c.QueueFree();
            for (var i = 0; i < states.Length; i++)
            {
                // A dot, in a taller box so it's easy to click.
                var hit = new Control { CustomMinimumSize = new Vector2(18, 14), MouseFilter = MouseFilterEnum.Stop, MouseDefaultCursorShape = CursorShape.PointingHand };
                hit.AddChild(new ColorRect { MouseFilter = MouseFilterEnum.Ignore });
                var at = i;
                hit.GuiInput += e =>
                {
                    if (e is InputEventMouseButton { Pressed: true, ButtonIndex: MouseButton.Left }) Stepped?.Invoke(at);
                };
                _dots.AddChild(hit);
            }
        }
        for (var i = 0; i < states.Length; i++)
        {
            var hit = (Control)_dots.GetChild(i);
            var dot = (ColorRect)hit.GetChild(0);
            var now = i == _at;
            // The step shown stands taller than the rest.
            dot.Size = new Vector2(18, now ? 9 : 5);
            dot.Position = new Vector2(0, now ? 2.5f : 4.5f);
            dot.Color = states[i] == "done" ? new Color("#9fd28a") : now ? new Color("#e8834a") : new Color(1, 1, 1, 0.15f);
            hit.TooltipText = $"Step {i + 1}" + (states[i] == "done" ? ", done" : "");
        }
        _pill.Text = $"Tutorial · {m.GetProperty("done").GetInt32()}/{_total}";
        Refresh();
    }
}
