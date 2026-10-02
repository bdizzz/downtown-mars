using System.Collections.Generic;
using Godot;

namespace DowntownMars;

/// <summary>
/// The hole's surfaces with the procedural shader (shaders/surfaces.gdshader), chosen by the web
/// game's material names: rooms ("room:&lt;colour&gt;:&lt;planned&gt;:&lt;faint&gt;:&lt;floor kind&gt;:&lt;grime&gt;"),
/// rock, corridor and room finishes ("hall:&lt;finish&gt;…", "finish:&lt;finish&gt;:&lt;grime&gt;"), the gallery
/// tubes' floors, and the ground. Anything else is left to Dress.cs.
/// </summary>
static class Looks
{
    static readonly Shader Shader = GD.Load<Shader>("res://shaders/surfaces.gdshader");
    static readonly Dictionary<string, ShaderMaterial> Made = new();

    /// <summary>Floors by kind, as the web's FLOOR_LOOK (surfaces.ts): colour, how much the room's colour tints it, roughness, metalness.</summary>
    static readonly Dictionary<string, (int kind, string color, float tint, float rough, float metal)> Floors = new()
    {
        ["planks"] = (0, "#9a6a44", 0.2f, 0.55f, 0),
        ["tiles"] = (1, "#d8d2c8", 0.25f, 0.4f, 0),
        ["plate"] = (2, "#8d9299", 0.2f, 0.42f, 0.45f),
        ["paving"] = (3, "#a89484", 0.2f, 0.78f, 0),
        ["concrete"] = (4, "#9c8f84", 0.2f, 0.82f, 0),
    };

    /// <summary>Finishes, as the web's FINISH_LOOK: their look in the shader, colour, roughness, metalness.</summary>
    static readonly Dictionary<string, (int look, string color, float rough, float metal)> Finishes = new()
    {
        ["rock"] = (1, "#7a4f3c", 0.95f, 0),
        ["marscrete"] = (3, "#9c8f84", 0.9f, 0),
        ["brick"] = (4, "#9c5438", 0.85f, 0),
        ["metal"] = (5, "#8d9299", 0.32f, 0.6f),
    };

    /// <summary>The surface for a web material, or null to leave it to Dress.cs. Transparent ones (blueprints, x-ray) are never ours.</summary>
    public static Material? For(string name, Color color, float roughness, float metallic, bool transparent)
    {
        if (transparent) return null;
        if (Made.TryGetValue($"{name}|{color.ToHtml()}", out var hit)) return hit;
        var parts = name.Split(':');
        ShaderMaterial? m = null;
        switch (parts[0])
        {
            case "room" when parts.Length >= 6 && parts[2] == "false" && parts[3] == "false" && Floors.TryGetValue(parts[4], out var floor):
                m = Make(0, color, 0.75f, 0);
                m.SetShaderParameter("floor_kind", floor.kind);
                m.SetShaderParameter("floor_color", new Color(floor.color));
                m.SetShaderParameter("floor_tint", floor.tint);
                m.SetShaderParameter("floor_roughness", floor.rough);
                m.SetShaderParameter("floor_metallic", floor.metal);
                m.SetShaderParameter("grime", float.TryParse(parts[5], out var g) ? g : 0);
                break;
            case "rock" when parts.Length > 1 && parts[1] == "ground":
                m = Make(2, color, 0.95f, 0);
                break;
            case "rock":
                m = Make(1, color, 0.95f, 0);
                break;
            case "hall" when parts.Length > 1 && Finishes.TryGetValue(parts[1], out var hall):
                m = Make(hall.look, color, hall.rough, hall.metal);
                break;
            case "finish" when parts.Length > 1 && Finishes.TryGetValue(parts[1], out var finish):
                m = Make(finish.look, new Color(finish.color), finish.rough, finish.metal);
                m.SetShaderParameter("grime", parts.Length > 2 && float.TryParse(parts[2], out var fg) ? fg : 0);
                break;
            case "tube" when parts.Length > 1 && parts[1] == "slab":
                m = Make(3, color, 0.85f, 0);
                break;
            // The tubes' ribs and rims, and the header over each: bolted metal panels.
            case "tube" when parts.Length > 1 && (parts[1] == "rib" || parts[1] == "header"):
                m = Make(5, color, 0.45f, parts[1] == "rib" ? 0.5f : 0.2f);
                break;
        }
        if (m != null) Made[$"{name}|{color.ToHtml()}"] = m;
        return m;
    }

    static ShaderMaterial Make(int look, Color color, float roughness, float metallic)
    {
        var m = new ShaderMaterial { Shader = Shader };
        m.SetShaderParameter("look", look);
        m.SetShaderParameter("albedo", color);
        m.SetShaderParameter("roughness", roughness);
        m.SetShaderParameter("metallic", metallic);
        return m;
    }
}
