using System;
using Godot;

namespace DowntownMars;

/// <summary>
/// A game day shown as a month (T-021), as the web's src/view/months.ts: "Month 9", "Year 3, month 9".
/// Most text comes ready-made from the bridge; this is for what Godot words itself (the clock, event timers).
/// </summary>
public static class Months
{
    const int AYear = 12;

    /// <summary>The game's date for a day count (1, 2, …): "Month 9", "Year 3, month 9", or "Year 1" on the dot.</summary>
    public static string Label(int day)
    {
        int y = day / AYear, m = day % AYear;
        if (y == 0) return $"Month {m}";
        return m == 0 ? $"Year {y}" : $"Year {y}, month {m}";
    }

    static string Plural(int n, string one) => $"{n} {one}{(n == 1 ? "" : "s")}";

    /// <summary>A span of game days: "2.5 months" (one decimal under a year), "3 years 4 months" from a year up.</summary>
    public static string Span(float days)
    {
        if (days >= AYear)
        {
            var total = Mathf.RoundToInt(days);
            int y = total / AYear, m = total % AYear;
            return m == 0 ? Plural(y, "year") : $"{Plural(y, "year")} {Plural(m, "month")}";
        }
        var n = MathF.Round(days * 10) / 10;
        return $"{n:0.#} {(n == 1 ? "month" : "months")}";
    }
}

/// <summary>The HUD's sun/moon dial beside the clock, as the web's (ui/SunDial.tsx): a disc carrying the sun and the moon turns once a sol behind a half-round window.</summary>
public partial class SunDial : Control
{
    static readonly Color DaySky = new("#d98a5c"), NightSky = new("#2b2140"), Sun = new("#ffe7a8"), Moon = new("#e8e2d4"), Horizon = new("#a88d7c");
    float _dayFraction = 0.5f;

    public SunDial()
    {
        CustomMinimumSize = new Vector2(30, 18);
        SizeFlagsVertical = SizeFlags.ShrinkCenter;
        MouseFilter = MouseFilterEnum.Ignore;
    }

    /// <summary>0 at midnight, 0.5 at noon.</summary>
    public float DayFraction
    {
        set
        {
            if (Mathf.IsEqualApprox(value, _dayFraction)) return;
            _dayFraction = value;
            QueueRedraw();
        }
    }

    public override void _Draw()
    {
        const float r = 14;
        var c = new Vector2(Size.X / 2, Size.Y - 1);
        var day = _dayFraction > 0.25f && _dayFraction < 0.75f;
        var sky = day ? DaySky : NightSky;
        // The window: the top half of the disc.
        DrawPolygon(HalfDisc(c, r), new[] { sky });
        // Noon puts the sun at the top; 06:00 has it rising on the left.
        var a = (_dayFraction - 0.5f) * Mathf.Tau;
        var up = new Vector2(Mathf.Sin(a), -Mathf.Cos(a));
        var sun = c + up * r * 0.6f;
        var moon = c - up * r * 0.6f;
        if (sun.Y < c.Y) DrawCircle(sun, 3.8f, Sun);
        if (moon.Y < c.Y)
        {
            DrawCircle(moon, 3.6f, Moon);
            DrawCircle(moon + new Vector2(1.7f, -0.9f), 2.9f, sky);
        }
        // Whatever pokes below the horizon is covered by the bar behind it.
        DrawLine(new Vector2(c.X - r - 1, c.Y), new Vector2(c.X + r + 1, c.Y), Horizon, 1);
    }

    static Vector2[] HalfDisc(Vector2 c, float r)
    {
        var pts = new Vector2[17];
        for (var i = 0; i <= 16; i++)
        {
            var t = Mathf.Pi + Mathf.Pi * i / 16;
            pts[i] = c + new Vector2(Mathf.Cos(t), Mathf.Sin(t)) * r;
        }
        return pts;
    }
}
