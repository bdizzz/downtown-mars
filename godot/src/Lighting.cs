using System.Collections.Generic;
using Godot;

namespace DowntownMars;

/// <summary>
/// Light for the experiment: a butterscotch Mars sky, the sun with cascaded shadows, and everything
/// Godot's Forward+ renderer offers that the web version can't afford: SDFGI global illumination
/// (light bouncing round the shaft and rooms), screen-space ambient occlusion and indirect light,
/// volumetric fog that the lamps light up, glow, AgX tone mapping, and a real light per lamp.
/// </summary>
static class Lighting
{
    /// <summary>Lamp brightness and reach, relative to the web game's numbers (a longer reach costs every pixel it touches).</summary>
    public const float LampEnergy = 1.4f, LampRange = 1.0f;

    /// <param name="lite">Without the costly parts (SDFGI, SSIL, volumetric fog), to measure what they cost.</param>
    /// <summary>The sky's top, horizon and ground-horizon colours by day and by night.</summary>
    public static readonly (Color top, Color horizon, Color ground) DaySky = (new(0.62f, 0.45f, 0.33f), new(0.86f, 0.66f, 0.47f), new(0.55f, 0.36f, 0.25f));
    public static readonly (Color top, Color horizon, Color ground) NightSky = (new(0.03f, 0.02f, 0.04f), new(0.09f, 0.05f, 0.06f), new(0.05f, 0.03f, 0.03f));

    public static WorldEnvironment MakeEnvironment(bool lite = false)
    {
        var sky = new ProceduralSkyMaterial
        {
            SkyTopColor = DaySky.top,
            SkyHorizonColor = DaySky.horizon,
            GroundHorizonColor = DaySky.ground,
            GroundBottomColor = new Color(0.25f, 0.15f, 0.1f),
            SunAngleMax = 20,
        };
        var env = new Godot.Environment
        {
            BackgroundMode = Godot.Environment.BGMode.Sky,
            Sky = new Sky { SkyMaterial = sky },
            AmbientLightSource = Godot.Environment.AmbientSource.Sky,
            AmbientLightEnergy = 0.25f,
            TonemapMode = Godot.Environment.ToneMapper.Agx,
            TonemapExposure = 1.0f,
            SsaoEnabled = true,
            SsaoRadius = 1.2f,
            SsaoIntensity = 1.6f,
            SsilEnabled = true,
            SdfgiEnabled = true,
            SdfgiUseOcclusion = true,
            SdfgiCascades = 4,
            SdfgiMinCellSize = 0.25f,
            SdfgiEnergy = 1.0f,
            GlowEnabled = true,
            GlowIntensity = 0.5f,
            GlowBloom = 0.05f,
            VolumetricFogEnabled = true,
            VolumetricFogDensity = 0.0015f,
            VolumetricFogAlbedo = new Color(0.9f, 0.7f, 0.55f),
            VolumetricFogLength = 120,
            VolumetricFogGIInject = 0.6f,
            // AgX keeps highlights soft but greys colours a little: some of it back.
            AdjustmentEnabled = true,
            AdjustmentContrast = 1.12f,
            AdjustmentSaturation = 1.2f,
        };
        // For measuring (Dev.cs): effects off one by one.
        if (Dev.Off("sdfgi")) env.SdfgiEnabled = false;
        if (Dev.Off("fog")) env.VolumetricFogEnabled = false;
        if (Dev.Off("ssil")) env.SsilEnabled = false;
        if (Dev.Off("ssao")) env.SsaoEnabled = false;
        if (Dev.Off("glow")) env.GlowEnabled = false;
        if (lite)
        {
            env.SdfgiEnabled = false;
            env.SsilEnabled = false;
            env.VolumetricFogEnabled = false;
        }
        return new WorldEnvironment { Environment = env };
    }

    /// <summary>Haze in the shaft only: dust hanging in the open air of the hole, where lamp light and sunbeams show.</summary>
    public static FogVolume MakeShaftHaze(HoleShape h)
    {
        var depth = 3 + h.FloorHeightM * (h.Floors + 1);
        var mat = new FogMaterial { Density = 0.012f, Albedo = new Color(0.95f, 0.75f, 0.6f), HeightFalloff = 0, EdgeFade = 0.3f };
        return new FogVolume
        {
            Shape = RenderingServer.FogVolumeShape.Cylinder,
            Size = new Vector3(h.ShaftRadiusM * 2, depth, h.ShaftRadiusM * 2),
            Position = new Vector3(0, -depth / 2, 0),
            Material = mat,
        };
    }

    /// <summary>The sun, from where the web game had it, with two shadow cascades out to 200 m.</summary>
    public static DirectionalLight3D MakeSun(float[] pos)
    {
        var sun = new DirectionalLight3D
        {
            LightColor = new Color(1, 0.94f, 0.85f),
            LightEnergy = 2.2f,
            ShadowEnabled = true,
            DirectionalShadowMode = DirectionalLight3D.ShadowMode.Parallel2Splits,
            DirectionalShadowMaxDistance = 200,
        };
        var from = new Vector3(pos[0], pos[1], pos[2]);
        // Looking from the sun toward the hole (a vertical sun needs another "up").
        var up = Mathf.Abs(from.Normalized().Y) > 0.98f ? Vector3.Forward : Vector3.Up;
        sun.LookAtFromPosition(from, Vector3.Zero, up);
        return sun;
    }

    /// <summary>A real light for every lamp the web game pooled on the floor, casting shadows (unless not).</summary>
    public static int AddLamps(Node parent, List<Lamp> lamps, bool shadows = true)
    {
        foreach (var l in lamps)
        {
            parent.AddChild(new OmniLight3D
            {
                Position = new Vector3(l.X, l.Y, l.Z),
                LightColor = new Color(l.Color),
                LightEnergy = l.Strength * LampEnergy,
                OmniRange = l.Reach * LampRange,
                OmniAttenuation = 1.4f,
                ShadowEnabled = shadows,
                LightIndirectEnergy = 1.2f,
                LightVolumetricFogEnergy = 0.6f,
            });
        }
        return lamps.Count;
    }
}
