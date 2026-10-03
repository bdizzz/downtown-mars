using Godot;

namespace DowntownMars;

/// <summary>
/// The view chosen, kept with the graphics level in user://settings.cfg, as the web keeps its View3d:
/// the overview camera, whether walls between the camera and the rooms are lowered, and whether rooms
/// show in their category's colour or in what they're built from; the plan, and the overlay on it.
/// </summary>
public static class ViewSettings
{
    const string File = "user://settings.cfg";

    public static Overview Camera { get; set; } = Overview.Iso;
    public static bool WallsDown { get; set; }
    public static bool RoomColors { get; set; } = true;
    /// <summary>The plan view (2D) instead of a 3D camera.</summary>
    public static bool Plan { get; set; }
    /// <summary>The overlay: noise, smell, health, comfort, airQuality, happiness or condition; null for none.</summary>
    public static string? Overlay { get; set; }

    public static void Load()
    {
        var cfg = new ConfigFile();
        if (cfg.Load(File) != Error.Ok) return;
        Camera = (Overview)(int)cfg.GetValue("view", "camera", (int)Overview.Iso);
        WallsDown = (bool)cfg.GetValue("view", "walls_down", false);
        RoomColors = (bool)cfg.GetValue("view", "room_colors", true);
        Plan = (bool)cfg.GetValue("view", "plan", false);
        var overlay = (string)cfg.GetValue("view", "overlay", "");
        Overlay = overlay == "" ? null : overlay;
    }

    /// <summary>A test run (a screenshot or a benchmark): nothing it changes is kept.</summary>
    public static bool ReadOnly { get; set; }

    public static void Save()
    {
        if (ReadOnly) return;
        var cfg = new ConfigFile();
        cfg.Load(File);
        cfg.SetValue("view", "camera", (int)Camera);
        cfg.SetValue("view", "walls_down", WallsDown);
        cfg.SetValue("view", "room_colors", RoomColors);
        cfg.SetValue("view", "plan", Plan);
        cfg.SetValue("view", "overlay", Overlay ?? "");
        cfg.Save(File);
    }
}
