using System;
using Godot;

namespace DowntownMars;

/// <summary>
/// Scrolling and pinching, the same from every pointing device, in the browser's terms so the views
/// can follow the web game's rules: a scroll is (dx, dy) in pixels, as a wheel event's deltaX and
/// deltaY (dy above 0 scrolls down, as a wheel turned toward you); a pinch is a zoom factor (above 1
/// spreads, zooming in).
///
/// How they arrive in Godot on a Mac: a wheel mouse sends wheel clicks (mouse buttons WheelUp, Down,
/// Left and Right, with a factor for how far); a trackpad and the Magic Mouse scroll with phases, so
/// they arrive as pan gestures (two axes, smooth, a few hundredths of a point each); a trackpad's pinch
/// arrives as a magnify gesture. Elsewhere a trackpad may send wheel clicks; either way it ends up here.
/// </summary>
public static class ScrollInput
{
    /// <summary>Pixels a wheel click scrolls (a browser's line-mode notch, near enough).</summary>
    const float WheelPixels = 60;
    /// <summary>Godot scales a precise scroll's points by 0.03 into a pan gesture: back to pixels.</summary>
    const float PanPixels = 1 / 0.03f;

    /// <summary>A scroll or a pinch, if this event is one. Pinches come as zoom (dx and dy 0); scrolls as dx, dy (zoom 1).</summary>
    public static bool Read(InputEvent e, out Vector2 scroll, out float zoom)
    {
        scroll = Vector2.Zero;
        zoom = 1;
        switch (e)
        {
            case InputEventMouseButton { Pressed: true } b:
                // A wheel click; its factor says how far (precise wheels send fractions, fast spins more).
                var f = (b.Factor > 0 ? b.Factor : 1) * WheelPixels;
                switch (b.ButtonIndex)
                {
                    case MouseButton.WheelUp: scroll.Y = -f; return true;
                    case MouseButton.WheelDown: scroll.Y = f; return true;
                    case MouseButton.WheelLeft: scroll.X = -f; return true;
                    case MouseButton.WheelRight: scroll.X = f; return true;
                }
                return false;
            case InputEventPanGesture p:
                // Trackpad and Magic Mouse scrolling: already in the browser's direction (natural scrolling and all).
                if (Repeat(p.Delta.X, p.Delta.Y)) return false;
                scroll = p.Delta * PanPixels;
                return true;
            case InputEventMagnifyGesture m:
                if (Repeat(m.Factor, -1)) return false;
                zoom = m.Factor;
                return m.Factor > 0;
        }
        return false;
    }

    static (ulong frame, float a, float b) _last;

    /// <summary>
    /// Godot hands each gesture to the scene twice (two copies of the event in the same frame; wheel clicks
    /// come once). The copy is skipped: the same gesture again within the frame.
    /// </summary>
    static bool Repeat(float a, float b)
    {
        var frame = Engine.GetProcessFrames();
        var repeat = _last.frame == frame && _last.a == a && _last.b == b;
        _last = repeat ? default : (frame, a, b);
        return repeat;
    }

    /// <summary>Is Shift held for this event (scrolling up and down then turns, as in the web)?</summary>
    public static bool Shift(InputEvent e) => e is InputEventWithModifiers m && m.ShiftPressed;
}
