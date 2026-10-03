using System;
using System.Collections.Generic;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// The game menu, as the web's: save to a slot, load the autosave or a slot, a new game, import or
/// export a save file (the web's format, so saves move between the two), quit. Saves are the bridge's
/// files (src/bridge/saves.ts). The game pauses while it's open.
/// </summary>
public partial class GameMenu : Control
{
    readonly Action<object> _send;
    readonly VBoxContainer _rows = new();
    readonly Label _folder = new();
    readonly FileDialog _import = new() { FileMode = FileDialog.FileModeEnum.OpenFile, Access = FileDialog.AccessEnum.Filesystem, Filters = new[] { "*.json ; Downtown Mars saves" }, Title = "Import a save file", UseNativeDialog = true };
    readonly FileDialog _export = new() { FileMode = FileDialog.FileModeEnum.SaveFile, Access = FileDialog.AccessEnum.Filesystem, Filters = new[] { "*.json ; Downtown Mars saves" }, Title = "Export the game", UseNativeDialog = true };
    readonly ConfirmationDialog _confirmNew = new() { Title = "New game?", DialogText = "Start a new colony? The current game is lost unless it's saved.", OkButtonText = "New game" };
    List<(string slot, string label, string? text)> _slots = new();
    string? _exportPath;
    int _id = 2_000_000;

    /// <summary>Opened and closed (Live pauses and resumes the game).</summary>
    public Action<bool>? Shown { get; set; }
    public Action<string>? Toast { get; set; }
    /// <summary>Settings and Help, opened over the menu.</summary>
    public Action? SettingsPressed { get; set; }
    public Action? HelpPressed { get; set; }

    public GameMenu(Action<object> send)
    {
        _send = send;
        SetAnchorsPreset(LayoutPreset.FullRect);
        MouseFilter = MouseFilterEnum.Stop;
        Visible = false;
        var dim = new ColorRect { Color = new Color(0, 0, 0, 0.45f) };
        dim.SetAnchorsPreset(LayoutPreset.FullRect);
        AddChild(dim);
        var center = new CenterContainer();
        center.SetAnchorsPreset(LayoutPreset.FullRect);
        AddChild(center);
        var panel = new PanelContainer { CustomMinimumSize = new Vector2(460, 0) };
        panel.AddThemeStyleboxOverride("panel", Live.Panel());
        center.AddChild(panel);
        _rows.AddThemeConstantOverride("separation", 6);
        panel.AddChild(_rows);
        AddChild(_import);
        AddChild(_export);
        AddChild(_confirmNew);
        _import.FileSelected += path =>
        {
            try
            {
                _send(new Dictionary<string, object> { ["type"] = "load", ["id"] = _id++, ["data"] = System.IO.File.ReadAllText(path) });
                Close();
            }
            catch (Exception e) { Toast?.Invoke($"Couldn't read it: {e.Message}"); }
        };
        _export.FileSelected += path =>
        {
            _exportPath = path;
            _send(new Dictionary<string, object> { ["type"] = "save", ["id"] = _id++ });
        };
        _confirmNew.Confirmed += () =>
        {
            _send(new Dictionary<string, object> { ["type"] = "newGame", ["id"] = _id++ });
            Close();
        };
        Build();
    }

    public void Open()
    {
        Visible = true;
        _send(new Dictionary<string, object> { ["type"] = "saves" });
        Shown?.Invoke(true);
    }

    public void Close()
    {
        if (!Visible) return;
        Visible = false;
        Shown?.Invoke(false);
    }

    /// <summary>The bridge's slots: each with its description, or null when empty.</summary>
    public void SetSaves(JsonElement msg)
    {
        _slots = new();
        foreach (var s in msg.GetProperty("slots").EnumerateArray())
            _slots.Add((s.GetProperty("slot").GetString()!, s.GetProperty("label").GetString()!, s.GetProperty("text").ValueKind == JsonValueKind.String ? s.GetProperty("text").GetString() : null));
        _folder.Text = $"Saves are kept in {msg.GetProperty("folder").GetString()}";
        Build();
    }

    /// <summary>The bridge's "saved" (asked for by Export): write the save where the player chose.</summary>
    public void Saved(JsonElement msg)
    {
        if (_exportPath == null) return;
        try
        {
            System.IO.File.WriteAllText(_exportPath, msg.GetProperty("data").GetString());
            Toast?.Invoke($"Exported to {System.IO.Path.GetFileName(_exportPath)}");
        }
        catch (Exception e) { Toast?.Invoke($"Couldn't write it: {e.Message}"); }
        _exportPath = null;
    }

    void Build()
    {
        foreach (var c in _rows.GetChildren())
        {
            _rows.RemoveChild(c);
            if (c != _folder) c.QueueFree();
        }
        var title = new Label { Text = "Downtown Mars", HorizontalAlignment = HorizontalAlignment.Center };
        title.AddThemeFontSizeOverride("font_size", 26);
        title.AddThemeColorOverride("font_color", new Color("#e8834a"));
        _rows.AddChild(title);
        Add("Resume", Close);
        Heading("Save");
        foreach (var (slot, label, text) in _slots)
        {
            if (slot == "autosave") continue;
            var s = slot;
            Add($"{label}: {text ?? "empty"}", () => _send(new Dictionary<string, object> { ["type"] = "saveSlot", ["slot"] = s }));
        }
        Heading("Load");
        foreach (var (slot, label, text) in _slots)
        {
            var s = slot;
            Add($"{label}: {text ?? "empty"}", () =>
            {
                _send(new Dictionary<string, object> { ["type"] = "loadSlot", ["slot"] = s });
                Close();
            }, text == null);
        }
        Heading("");
        Add("New game", () => _confirmNew.PopupCentered());
        Add("Import a save file…", () => _import.PopupCentered(new Vector2I(800, 500)));
        Add("Export the game to a file…", () =>
        {
            _export.CurrentFile = "downtown-mars.json";
            _export.PopupCentered(new Vector2I(800, 500));
        });
        Add("Settings…", () => SettingsPressed?.Invoke());
        Add("Controls (?)", () => HelpPressed?.Invoke());
        Add("Quit", () => GetTree().Quit());
        _folder.AddThemeFontSizeOverride("font_size", 12);
        _folder.AddThemeColorOverride("font_color", new Color("#b8a490"));
        _folder.AutowrapMode = TextServer.AutowrapMode.WordSmart;
        _rows.AddChild(_folder);
    }

    void Heading(string text)
    {
        var l = new Label { Text = text };
        l.AddThemeColorOverride("font_color", new Color("#c9b29c"));
        _rows.AddChild(l);
    }

    void Add(string text, Action pressed, bool disabled = false)
    {
        var b = new Button { Text = text, Disabled = disabled, FocusMode = FocusModeEnum.None, Alignment = HorizontalAlignment.Left };
        b.Pressed += pressed;
        _rows.AddChild(b);
    }
}
