using System;
using System.Collections.Generic;
using Godot;

namespace DowntownMars;

/// <summary>
/// The recent frame rate in Settings → Display (#391), as the web's ui/FpsPanel.tsx: a chart of the last couple of
/// minutes, one reading a second, and, when it has been low for a while, what to turn down (a button for each step).
/// </summary>
public partial class FpsPanel : VBoxContainer
{
    const float Top = 60, ChartW = 360, ChartH = 56;
    readonly Label _summary = new() { AutowrapMode = TextServer.AutowrapMode.WordSmart };
    readonly Label _advice = new() { AutowrapMode = TextServer.AutowrapMode.WordSmart };
    readonly HBoxContainer _buttons = new();
    readonly Button _furniture = new(), _graphics = new();
    readonly Chart _chart = new();

    /// <summary>The graphics level, as an index into Quality, and how to change it (Live applies and saves it).</summary>
    readonly Func<int> _getQuality;
    readonly Action<int> _setQuality;
    /// <summary>The furniture setting changed from here: apply it, and refresh the rows.</summary>
    readonly Action _furnitureChanged;

    public FpsPanel(Func<int> getQuality, Action<int> setQuality, Action furnitureChanged)
    {
        _getQuality = getQuality;
        _setQuality = setQuality;
        _furnitureChanged = furnitureChanged;
        AddThemeConstantOverride("separation", 4);
        AddChild(Text("Frame rate", 15, new Color("#f0e0d0")));
        _summary.AddThemeFontSizeOverride("font_size", 12);
        _summary.AddThemeColorOverride("font_color", new Color("#a88d7c"));
        AddChild(_summary);
        AddChild(_chart);
        _advice.AddThemeFontSizeOverride("font_size", 12);
        AddChild(_advice);
        _buttons.AddThemeConstantOverride("separation", 6);
        _furniture.Pressed += () =>
        {
            if (ViewSettings.LighterFurniture() is not { } lighter) return;
            ViewSettings.Furniture = lighter;
            ViewSettings.Save();
            _furnitureChanged();
        };
        _graphics.Pressed += () =>
        {
            var q = _getQuality();
            if (q > 0) _setQuality(q - 1);
            _furnitureChanged();
        };
        _buttons.AddChild(_furniture);
        _buttons.AddChild(_graphics);
        AddChild(_buttons);
        Refresh();
    }

    public override void _EnterTree()
    {
        Fps.Changed += Refresh;
        Refresh();
    }

    public override void _ExitTree() => Fps.Changed -= Refresh;

    static Label Text(string text, int size, Color color)
    {
        var l = new Label { Text = text };
        l.AddThemeFontSizeOverride("font_size", size);
        l.AddThemeColorOverride("font_color", color);
        return l;
    }

    static readonly string[] FurnitureNames = { "Simple shapes", "Detailed on foot", "Detailed everywhere" };

    public void Refresh()
    {
        var h = Fps.History;
        var span = Math.Min(h.Count, Fps.Seconds);
        var typical = span > 0 ? Fps.Recent(span) : null;
        _summary.Text = h.Count == 0 || typical == null
            ? "Measuring: it fills in while the game is drawing"
            : $"{h[^1]} fps now, {typical} typical over the last {span} seconds";
        _chart.QueueRedraw();
        var low = Fps.IsLow;
        var lighter = ViewSettings.LighterFurniture();
        var quality = _getQuality();
        _advice.Visible = _buttons.Visible = low;
        _furniture.Visible = lighter != null;
        if (lighter is { } l) _furniture.Text = $"Scale back furniture to “{FurnitureNames[(int)l]}”";
        _graphics.Visible = quality > 0;
        if (quality > 0) _graphics.Text = $"Lower graphics to {(Quality)(quality - 1)}";
        _advice.Text = $"It has been under {Fps.Low} fps for a while. " + (lighter != null || quality > 0 ? "To help, try:" : "Everything here is already as light as it goes; closing other programs may help.");
        _advice.AddThemeColorOverride("font_color", new Color("#f0e0d0"));
    }

    /// <summary>The chart: the readings, newest at the right, with the line where "low" starts.</summary>
    partial class Chart : Control
    {
        public Chart() => CustomMinimumSize = new Vector2(ChartW, ChartH);

        public override void _Draw()
        {
            DrawRect(new Rect2(0, 0, ChartW, ChartH), new Color(1, 1, 1, 0.04f));
            var lowY = ChartH - Fps.Low / Top * ChartH;
            DrawDashedLine(new Vector2(0, lowY), new Vector2(ChartW, lowY), new Color(1, 1, 1, 0.2f), 1, 4);
            var h = Fps.History;
            if (h.Count < 2) return;
            var pts = new List<Vector2>();
            for (var i = 0; i < h.Count; i++)
                pts.Add(new Vector2((i + Fps.HistorySeconds - h.Count) / (float)(Fps.HistorySeconds - 1) * ChartW, ChartH - Mathf.Min(1, h[i] / Top) * ChartH));
            DrawPolyline(pts.ToArray(), new Color("#e8a86b"), 1.5f);
        }
    }
}
