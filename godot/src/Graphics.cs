using Godot;

namespace DowntownMars;

/// <summary>
/// Graphics presets: what the lighting may cost. Low has no global illumination, haze or lamp
/// shadows; Medium adds ambient occlusion and a couple of lamp shadows; High (the default) adds
/// SDFGI and the haze; Ultra adds screen-space indirect light, more lamp shadows and lamps lit on
/// more floors. Kept in user://settings.cfg. See docs/PLAN-GODOT.md for what each costs.
/// </summary>
public enum Quality { Low, Medium, High, Ultra }

public static class Graphics
{
    const string File = "user://settings.cfg";

    public static Quality Load()
    {
        var cfg = new ConfigFile();
        return cfg.Load(File) == Error.Ok ? (Quality)(int)cfg.GetValue("graphics", "quality", (int)Quality.High) : Quality.High;
    }

    public static void Save(Quality q)
    {
        if (ViewSettings.ReadOnly) return;
        var cfg = new ConfigFile();
        cfg.Load(File);
        cfg.SetValue("graphics", "quality", (int)q);
        cfg.Save(File);
    }

    /// <summary>How much of the ambient light comes from the sky by day at this level (the rest is the dust's glow).</summary>
    public static float SkyShare { get; private set; } = 1;

    /// <summary>Lamps casting shadows at each level.</summary>
    public static int ShadowLamps(Quality q) => q switch { Quality.Low => 0, Quality.Medium => 2, Quality.High => 4, _ => 8 };

    /// <summary>Lamps lit: the floor in view, and this many above and below it.</summary>
    public static (int above, int below) LampFloors(Quality q) => q switch { Quality.Ultra => (1, 2), Quality.Low => (0, 0), _ => (0, 1) };

    /// <summary>The environment, sun, haze and viewport for a level (switches made off for measuring stay off: Dev.cs).</summary>
    public static void Apply(Quality q, Environment env, DirectionalLight3D sun, FogVolume? haze, Viewport viewport)
    {
        env.SsaoEnabled = q >= Quality.Medium && !Dev.Off("ssao");
        env.SdfgiEnabled = q >= Quality.High && !Dev.Off("sdfgi");
        env.VolumetricFogEnabled = q >= Quality.High && !Dev.Off("fog");
        env.SsilEnabled = q >= Quality.Ultra && !Dev.Off("ssil");
        if (haze != null) haze.Visible = env.VolumetricFogEnabled;
        // Without bounced light, the sky lights the rooms a little more.
        SkyShare = env.SdfgiEnabled ? 1f : 0.85f;
        env.AmbientLightSkyContribution = SkyShare;
        sun.DirectionalShadowMaxDistance = q == Quality.Low ? 120 : 200;
        viewport.Msaa3D = q == Quality.Low || Dev.Off("msaa") ? Viewport.Msaa.Disabled : Viewport.Msaa.Msaa2X;
        viewport.ScreenSpaceAA = q == Quality.Low ? Viewport.ScreenSpaceAAEnum.Fxaa : Viewport.ScreenSpaceAAEnum.Disabled;
    }
}
