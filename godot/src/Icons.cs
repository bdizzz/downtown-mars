using System.Collections.Generic;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// The game's icon set (view/icons.ts), as the web's: the bridge sends each as an SVG drawn in white
/// when the viewer connects, and they're rasterized here once and tinted where they're used. Icons
/// asked for before they arrive fill in when they do.
/// </summary>
public static class Icons
{
    /// <summary>Rasterized at this many pixels per unit of the 16-unit grid, so they stay crisp scaled up.</summary>
    const float Scale = 3;
    static readonly Dictionary<string, Texture2D> Textures = new();
    static readonly List<(TextureRect rect, string id)> Waiting = new();
    static readonly List<System.Action> Ready = new();

    /// <summary>The bridge's "icons" message: id → SVG.</summary>
    public static void Set(JsonElement msg)
    {
        foreach (var p in msg.GetProperty("icons").EnumerateObject())
        {
            var img = new Image();
            if (img.LoadSvgFromString(p.Value.GetString()!, Scale) == Error.Ok) Textures[p.Name] = ImageTexture.CreateFromImage(img);
        }
        foreach (var (rect, id) in Waiting)
            if (GodotObject.IsInstanceValid(rect)) rect.Texture = Get(id);
        Waiting.Clear();
        foreach (var a in Ready) a();
        Ready.Clear();
    }

    /// <summary>Run this once the icons are in (now, if they are): for icons set on buttons.</summary>
    public static void WhenReady(System.Action a)
    {
        if (Textures.Count > 0) a();
        else Ready.Add(a);
    }

    public static Texture2D? Get(string id) => Textures.TryGetValue(id, out var t) ? t : null;

    /// <summary>An icon at `size` px, tinted.</summary>
    public static TextureRect Rect(string id, int size, Color tint)
    {
        var rect = new TextureRect
        {
            ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
            StretchMode = TextureRect.StretchModeEnum.KeepAspectCentered,
            CustomMinimumSize = new Vector2(size, size),
            SizeFlagsVertical = Control.SizeFlags.ShrinkCenter,
            MouseFilter = Control.MouseFilterEnum.Ignore,
            Modulate = tint,
        };
        Show(rect, id);
        return rect;
    }

    /// <summary>Show another icon in a rect made by Rect.</summary>
    public static void Show(TextureRect rect, string id)
    {
        rect.Texture = Get(id);
        if (rect.Texture == null) Waiting.Add((rect, id));
    }
}
