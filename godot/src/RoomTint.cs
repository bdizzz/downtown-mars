using System.Collections.Generic;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// Rooms in trouble, as the web's (view/roomTrouble.ts troubleOf, stage3d showTrouble): a room slowed
/// (short of staff, low morale, the weather, an ordinance, worn) has an amber outline and a caution sign
/// over its label; one short of what it runs on (or broken) red; one paused grey. A room standing by
/// because its output's full or stocked shows nothing. The outlines are tinted on the GPU: each outline
/// vertex carries its room, and the edge shader looks its colour up in a small texture (a pixel per
/// room) held as the global <c>room_tint</c>; the hovered room is the global <c>hover_room</c>.
/// </summary>
public static class RoomTint
{
    const int Width = 256, Height = 64;
    static readonly Color Warn = new("#f0a030"), Bad = new("#e0503a"), Idle = new("#9a9a9a");

    static Image? _image;
    static ImageTexture? _texture;
    static string _key = "";
    static int _hover = -1;

    static void Ensure()
    {
        if (_texture != null) return;
        _image = Image.CreateEmpty(Width, Height, false, Image.Format.Rgba8);
        _texture = ImageTexture.CreateFromImage(_image);
        RenderingServer.GlobalShaderParameterSet("room_tint", _texture);
        RenderingServer.GlobalShaderParameterSet("hover_room", -1f);
    }

    /// <summary>"ok", "warn", "bad" or "idle" for a room's status (its limit, if any).</summary>
    public static string Level(JsonElement status)
    {
        if (!status.TryGetProperty("limit", out var l) || l.ValueKind != JsonValueKind.String) return "ok";
        var limit = l.GetString()!;
        if (limit == "paused") return "idle";
        if (limit is "kit" or "standby" || limit.StartsWith("full:") || limit.StartsWith("stocked:")) return "ok";
        if (limit is "staff" or "morale" or "storm" or "ordinance" or "worn") return "warn";
        return "bad";
    }

    /// <summary>From the snapshot's room statuses: the outlines' colours; returns the rooms to badge (slowed or short).</summary>
    public static HashSet<int>? Update(JsonElement roomStatus)
    {
        Ensure();
        var levels = new List<(int id, string level)>();
        foreach (var p in roomStatus.EnumerateObject())
        {
            if (!int.TryParse(p.Name, out var id) || id < 0 || id >= Width * Height) continue;
            var level = Level(p.Value);
            if (level != "ok") levels.Add((id, level));
        }
        var key = string.Join(",", levels);
        if (key == _key) return null;
        _key = key;
        _image!.Fill(new Color(0, 0, 0, 0));
        var badged = new HashSet<int>();
        foreach (var (id, level) in levels)
        {
            _image.SetPixel(id % Width, id / Width, level switch { "warn" => Warn, "bad" => Bad, _ => Idle });
            if (level != "idle") badged.Add(id);
        }
        _texture!.Update(_image);
        return badged;
    }

    /// <summary>The room under the pointer, outlined in the hover colour (none: -1).</summary>
    public static void Hover(int room)
    {
        Ensure();
        if (room == _hover) return;
        _hover = room;
        RenderingServer.GlobalShaderParameterSet("hover_room", (float)room);
    }
}
