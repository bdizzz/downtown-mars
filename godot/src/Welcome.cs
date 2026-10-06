using System;
using System.Linq;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// The card a new game opens with, as the web's (ui/Welcome.tsx): who you are and why the colony goes
/// underground. The bridge sends it (view/welcome.ts) for a new game, not a loaded one; the game waits
/// behind it (Live pauses and resumes), and the button tells the bridge it's been read.
/// </summary>
public partial class Welcome : Control
{
    readonly Label _title = new() { AutowrapMode = TextServer.AutowrapMode.WordSmart };
    readonly RichTextLabel _body = new() { BbcodeEnabled = true, FitContent = true, ScrollActive = false, SelectionEnabled = false };
    readonly Button _go = new();

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
        var panel = new PanelContainer { CustomMinimumSize = new Vector2(520, 0) };
        panel.AddThemeStyleboxOverride("panel", Live.Panel());
        center.AddChild(panel);
        var rows = new VBoxContainer();
        rows.AddThemeConstantOverride("separation", 12);
        panel.AddChild(rows);
        _title.AddThemeFontSizeOverride("font_size", 22);
        _title.AddThemeColorOverride("font_color", new Color("#e8834a"));
        rows.AddChild(_title);
        _body.AddThemeFontSizeOverride("normal_font_size", 15);
        _body.AddThemeFontSizeOverride("bold_font_size", 15);
        _body.AddThemeConstantOverride("paragraph_separation", 10);
        rows.AddChild(_body);
        _go.CustomMinimumSize = new Vector2(0, 36);
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
        if (Visible) return;
        Visible = true;
        _go.GrabFocus();
        Shown?.Invoke(true);
    }

    static string Escape(string s) => s.Replace("[", "[lb]");

    void Close()
    {
        if (!Visible) return;
        Visible = false;
        Shown?.Invoke(false);
    }
}
