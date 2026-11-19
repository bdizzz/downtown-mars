using System;
using System.Linq;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// The card a new game opens with, as the web's (ui/Welcome.tsx): who you are and why the colony goes
/// underground, and the difficulty picker (F-014, T-124): easy, normal or hard with a line on each, and
/// normal's veteran start. The bridge sends it (view/welcome.ts) for a new game, not a loaded one; the
/// game waits behind it (Live pauses and resumes), and the button tells the bridge it's been read and
/// what was picked. A failed hole's card (T-162) is drawn by the same class, without the picker.
/// (The web's guided tutorial isn't in the viewer yet, so neither is its tick box.)
/// </summary>
public partial class Welcome : Control
{
    readonly Label _title = new() { AutowrapMode = TextServer.AutowrapMode.WordSmart };
    readonly RichTextLabel _body = new() { BbcodeEnabled = true, FitContent = true, ScrollActive = false, SelectionEnabled = false };
    readonly Button _go = new();
    readonly VBoxContainer _picker = new() { Visible = false };
    readonly Label _pickerLabel = new();
    readonly HBoxContainer _levels = new();
    readonly ButtonGroup _group = new();
    readonly Label _hint = new() { AutowrapMode = TextServer.AutowrapMode.WordSmart, CustomMinimumSize = new Vector2(0, 44) };
    readonly CheckBox _veteran = new();
    readonly Label _veteranNote = new() { AutowrapMode = TextServer.AutowrapMode.WordSmart };
    readonly System.Collections.Generic.List<(string id, string hint, bool veteran)> _levelInfo = new();

    /// <summary>The level picked (null on a card without the picker).</summary>
    public string? Level { get; private set; }
    /// <summary>Normal's veteran start: the bare landing kit.</summary>
    public bool Veteran => _veteran.Visible && _veteran.ButtonPressed;

    /// <summary>Opened (true) and read (false).</summary>
    public Action<bool>? Shown { get; set; }

    public Welcome()
    {
        SetAnchorsPreset(LayoutPreset.FullRect);
        MouseFilter = MouseFilterEnum.Stop;
        Visible = false;
        var dim = new ColorRect { Color = new Color(0, 0, 0, 0.6f) };
        dim.SetAnchorsPreset(LayoutPreset.FullRect);
        AddChild(dim);
        var center = new CenterContainer();
        center.SetAnchorsPreset(LayoutPreset.FullRect);
        AddChild(center);
        var panel = new PanelContainer { CustomMinimumSize = new Vector2(580, 0) };
        panel.AddThemeStyleboxOverride("panel", Live.Panel());
        center.AddChild(panel);
        var rows = new VBoxContainer();
        rows.AddThemeConstantOverride("separation", 12);
        panel.AddChild(rows);
        _title.AddThemeFontSizeOverride("font_size", 25);
        _title.AddThemeColorOverride("font_color", new Color("#e8834a"));
        rows.AddChild(_title);
        _body.AddThemeFontSizeOverride("normal_font_size", 17);
        _body.AddThemeFontSizeOverride("bold_font_size", 17);
        _body.AddThemeConstantOverride("paragraph_separation", 10);
        rows.AddChild(_body);
        _picker.AddThemeConstantOverride("separation", 6);
        _pickerLabel.AddThemeFontSizeOverride("font_size", 13);
        _pickerLabel.AddThemeColorOverride("font_color", new Color("#b8a490"));
        _picker.AddChild(_pickerLabel);
        _levels.AddThemeConstantOverride("separation", 6);
        _picker.AddChild(_levels);
        _hint.AddThemeFontSizeOverride("font_size", 14);
        _hint.AddThemeColorOverride("font_color", new Color("#c9b29c"));
        _picker.AddChild(_hint);
        _veteran.AddThemeFontSizeOverride("font_size", 15);
        _picker.AddChild(_veteran);
        _veteranNote.AddThemeFontSizeOverride("font_size", 12);
        _veteranNote.AddThemeColorOverride("font_color", new Color("#b8a490"));
        _picker.AddChild(_veteranNote);
        rows.AddChild(_picker);
        _go.CustomMinimumSize = new Vector2(0, 40);
        _go.AddThemeFontSizeOverride("font_size", 17);
        _go.Pressed += Close;
        rows.AddChild(_go);
    }

    /// <summary>The bridge's "welcome": a title, paragraphs as runs (every other one bold), the button.</summary>
    public void Set(JsonElement msg)
    {
        _title.Text = msg.GetProperty("title").GetString();
        _body.Text = string.Join("\n", msg.GetProperty("paragraphs").EnumerateArray().Select(p =>
            string.Concat(p.EnumerateArray().Select((r, i) => i % 2 == 1 ? $"[b]{Escape(r.GetString()!)}[/b]" : Escape(r.GetString()!)))));
        _go.Text = msg.GetProperty("button").GetString();
        SetPicker(msg);
        if (Visible) return;
        Visible = true;
        _go.GrabFocus();
        Shown?.Invoke(true);
    }

    /// <summary>The welcome card's "difficulty": the levels as toggle buttons, the picked one's line, normal's veteran start.</summary>
    void SetPicker(JsonElement msg)
    {
        if (!msg.TryGetProperty("difficulty", out var d))
        {
            _picker.Visible = false;
            Level = null;
            return;
        }
        // Sent again to every viewer that connects: keep what's been picked so far.
        if (_picker.Visible) return;
        _picker.Visible = true;
        _pickerLabel.Text = d.GetProperty("label").GetString()!.ToUpperInvariant();
        _veteran.Text = d.GetProperty("veteran").GetString();
        _veteranNote.Text = d.GetProperty("veteranNote").GetString();
        foreach (var c in _levels.GetChildren()) c.QueueFree();
        _levelInfo.Clear();
        foreach (var l in d.GetProperty("levels").EnumerateArray())
        {
            var id = l.GetProperty("id").GetString()!;
            _levelInfo.Add((id, l.GetProperty("hint").GetString()!, l.GetProperty("veteran").GetBoolean()));
            var b = new Button { Text = l.GetProperty("name").GetString(), ToggleMode = true, ButtonGroup = _group, SizeFlagsHorizontal = SizeFlags.ExpandFill, CustomMinimumSize = new Vector2(0, 34) };
            b.AddThemeFontSizeOverride("font_size", 16);
            b.AddThemeColorOverride("font_pressed_color", new Color("#e8834a"));
            b.AddThemeColorOverride("font_hover_pressed_color", new Color("#e8834a"));
            b.Pressed += () => Pick(id);
            _levels.AddChild(b);
        }
        Pick(d.GetProperty("picked").GetString()!);
    }

    void Pick(string id)
    {
        Level = id;
        var i = _levelInfo.FindIndex(l => l.id == id);
        if (i < 0) return;
        if (_levels.GetChildCount() > i) ((Button)_levels.GetChild(i)).SetPressedNoSignal(true);
        _hint.Text = _levelInfo[i].hint;
        _veteran.Visible = _veteranNote.Visible = _levelInfo[i].veteran;
        _veteran.ButtonPressed = false;
    }

    static string Escape(string s) => s.Replace("[", "[lb]");

    void Close()
    {
        if (!Visible) return;
        Visible = false;
        Shown?.Invoke(false);
        // The next new game's card starts the picker afresh.
        _picker.Visible = false;
    }
}
