using System;
using Godot;

namespace DowntownMars;

/// <summary>
/// Over the game when the frame rate has been very low for a while (#391), as the web's ui/SlowCard.tsx: one
/// click to the lowest graphics level and simple furniture, so the player needn't open Settings (which still
/// has the finer choices and the chart). Dismissed for the rest of the run; after a click the readings start over.
/// </summary>
public partial class SlowCard : PanelContainer
{
    bool _dismissed, _slow;

    /// <summary>Lighten the graphics: Live sets the level to Low and applies it.</summary>
    public Action? Lighten { get; set; }

    public SlowCard()
    {
        Visible = false;
        SetAnchorsPreset(LayoutPreset.CenterBottom);
        GrowHorizontal = GrowDirection.Both;
        GrowVertical = GrowDirection.Begin;
        OffsetTop = OffsetBottom = -110;
        AddThemeStyleboxOverride("panel", Live.Panel());
        var row = new HBoxContainer();
        row.AddThemeConstantOverride("separation", 10);
        AddChild(row);
        var label = new Label { Text = $"The game is running slowly (under {Fps.VeryLow} fps). Lighter graphics and simple furniture should help." };
        label.AddThemeFontSizeOverride("font_size", 13);
        row.AddChild(label);
        var lighten = new Button { Text = "Lighten graphics", FocusMode = FocusModeEnum.None, TooltipText = "Sets the Low graphics level and simple furniture shapes; you can change either in Settings → Display" };
        lighten.Pressed += () =>
        {
            Lighten?.Invoke();
            Fps.Reset();
        };
        row.AddChild(lighten);
        var later = new Button { Text = "✕", Flat = true, FocusMode = FocusModeEnum.None, TooltipText = "Not now" };
        later.Pressed += () =>
        {
            _dismissed = true;
            Visible = false;
        };
        row.AddChild(later);
        Fps.Changed += () => _slow = Fps.IsVeryLow;
    }

    /// <summary>Called each frame: shown when it's been very low, in a running game (not behind a menu or sheet), unless there's nothing lighter to offer.</summary>
    public void Update(bool inGame, bool alreadyLightest) => Visible = inGame && _slow && !_dismissed && !alreadyLightest;
}
