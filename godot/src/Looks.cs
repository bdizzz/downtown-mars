using System.Collections.Generic;
using Godot;

namespace DowntownMars;

/// <summary>
/// The hole's surfaces with the procedural shader (shaders/surfaces.gdshader), chosen by the web
/// game's material names: rooms ("room:&lt;colour&gt;:&lt;planned&gt;:&lt;faint&gt;:&lt;finish&gt;:&lt;grime&gt;", the floor laid in that finish),
/// rock, corridor and room finishes ("hall:&lt;finish&gt;…", "finish:&lt;finish&gt;:&lt;grime&gt;"), the gallery
/// tubes' floors, and the ground. Anything else is left to Dress.cs.
/// </summary>
static class Looks
{
    static Shader? _shader;
    static Shader Shader => _shader ??= GD.Load<Shader>("res://shaders/surfaces.gdshader");
    static readonly Dictionary<string, ShaderMaterial> Made = new();

    /// <summary>Let go of the shader and materials on the way out (statics would outlive the engine and show as leaks).</summary>
    public static void Release()
    {
        Made.Clear();
        _shader = null;
    }

    /// <summary>Finishes, as the web's FINISH_LOOK: their look in the shader, colour, roughness, metalness.</summary>
    static readonly Dictionary<string, (int look, string color, float rough, float metal)> Finishes = new()
    {
        ["rock"] = (1, "#7a4f3c", 0.95f, 0),
        ["marscrete"] = (3, "#9c8f84", 0.9f, 0),
        ["brick"] = (4, "#9c5438", 0.85f, 0),
        ["metal"] = (5, "#8d9299", 0.32f, 0.6f),
        // The fine finishes (PLAN-M15), in their base step's look until the shader has their own (T-035).
        ["rock_fine"] = (1, "#86584a", 0.55f, 0),
        ["brick_fine"] = (4, "#a65a3b", 0.8f, 0),
        ["metal_fine"] = (5, "#9aa0a8", 0.28f, 0.65f),
    };

    /// <summary>How much a room's colour tints its floor, as the web's FLOOR_TINT.</summary>
    const float FloorTint = 0.4f;

    /// <summary>The surface for a web material, or null to leave it to Dress.cs. Transparent ones (blueprints, x-ray) are never ours.</summary>
    public static Material? For(string name, Color color, float roughness, float metallic, bool transparent)
    {
        if (transparent) return null;
        if (Made.TryGetValue($"{name}|{color.ToHtml()}", out var hit)) return hit;
        var parts = name.Split(':');
        ShaderMaterial? m = null;
        switch (parts[0])
        {
            case "room" when parts.Length >= 6 && parts[2] == "false" && parts[3] == "false" && Finishes.TryGetValue(parts[4], out var floor):
                m = Make(0, color, 0.75f, 0);
                m.SetShaderParameter("floor_look", floor.look);
                m.SetShaderParameter("floor_color", new Color(floor.color));
                m.SetShaderParameter("floor_tint", FloorTint);
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
