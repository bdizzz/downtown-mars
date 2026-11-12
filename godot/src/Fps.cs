using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// The frame rate, kept for Settings and the slow-game card (#391), as the web's view/fps.ts: Live reports
/// every frame, this makes one reading a second and keeps the last couple of minutes. A gap of more than a
/// second between frames (a stall while loading, the window dragged) isn't slowness: that second is dropped.
/// The numbers (history, the stretch the middle is taken over, the two limits) are in data/settings.json
/// ("fps"), shared with the web.
/// </summary>
public static class Fps
{
    public static readonly int HistorySeconds, Seconds, Low, VeryLow;

    static Fps()
    {
        using var doc = JsonDocument.Parse(System.IO.File.ReadAllText(ProjectSettings.GlobalizePath("res://") + "../data/settings.json"));
        var fps = doc.RootElement.GetProperty("fps");
        HistorySeconds = fps.GetProperty("history").GetInt32();
        Seconds = fps.GetProperty("seconds").GetInt32();
        Low = fps.GetProperty("low").GetInt32();
        VeryLow = fps.GetProperty("veryLow").GetInt32();
    }

    const double GapMs = 1000;
    static readonly List<int> _history = new();
    static double _bucketStart = double.NaN, _lastFrame = double.NaN;
    static int _frames;

    /// <summary>A new reading came in (or the history was cleared).</summary>
    public static event Action? Changed;

    /// <summary>One reading a second, oldest first.</summary>
    public static IReadOnlyList<int> History => _history;

    /// <summary>Call once a frame with the time in milliseconds.</summary>
    public static void Record(double nowMs)
    {
        if (!double.IsNaN(_lastFrame) && nowMs - _lastFrame > GapMs)
        {
            _bucketStart = nowMs;
            _frames = 0;
        }
        _lastFrame = nowMs;
        if (double.IsNaN(_bucketStart))
        {
            _bucketStart = nowMs;
            _frames = 0;
            return;
        }
        _frames++;
        var elapsed = nowMs - _bucketStart;
        if (elapsed < 1000) return;
        _history.Add((int)Math.Round(_frames * 1000 / elapsed));
        if (_history.Count > HistorySeconds) _history.RemoveRange(0, _history.Count - HistorySeconds);
        _bucketStart = nowMs;
        _frames = 0;
        Changed?.Invoke();
    }

    /// <summary>Forget everything (after the player lightens the graphics: the readings start over).</summary>
    public static void Reset()
    {
        _history.Clear();
        _bucketStart = _lastFrame = double.NaN;
        _frames = 0;
        Changed?.Invoke();
    }

    /// <summary>The middle of the last `Seconds` readings, or null with fewer than that.</summary>
    public static int? Recent(int seconds = -1)
    {
        if (seconds < 0) seconds = Seconds;
        if (_history.Count < seconds || seconds == 0) return null;
        var last = _history.Skip(_history.Count - seconds).OrderBy(v => v).ToArray();
        return last[last.Length / 2];
    }

    /// <summary>Consistently low: the middle of the last stretch is under Low (Settings advises).</summary>
    public static bool IsLow => Recent() is { } r && r < Low;

    /// <summary>Very low: under VeryLow (the game offers one click to lighter graphics).</summary>
    public static bool IsVeryLow => Recent() is { } r && r < VeryLow;
}
