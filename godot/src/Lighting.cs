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

    /// <summary>
    /// Underground lighting (#305), from data/lighting.json: the ceiling lights in rooms and corridors, and
    /// the modes by the hour (by day every ceiling light on and lamps brighter; by night a few ceiling
    /// lights on, dimmed, and some lamps dimmed; after midnight the rooms dark, the corridors as by night).
    /// </summary>
    public static class Indoor
    {
        public static readonly Color OverheadColor;
        public static readonly float RoomEnergy, RoomReach, CorridorEnergy, CorridorReach, FixtureRadius;
        public static readonly float DayLampBoost, DayColour, NightOverheadShare, NightOverheadDim, NightLampShare, NightLampDim;
        public static readonly float DawnHour, DuskHour, OffHour, SpreadS, OffLampDim, OffOverheadDim;

        /// <summary>The lights' modes: above ground (the sky lights the rooms), and underground by day, by night and after midnight.</summary>
        public enum Mode { Surface, Day, Night, Off }

        static Indoor()
        {
            var path = ProjectSettings.GlobalizePath("res://") + "../data/lighting.json";
            using var doc = System.Text.Json.JsonDocument.Parse(System.IO.File.ReadAllText(path));
            var o = doc.RootElement.GetProperty("overhead");
            OverheadColor = new Color(o.GetProperty("color").GetString()!);
            RoomEnergy = o.GetProperty("room").GetProperty("energy").GetSingle();
            RoomReach = o.GetProperty("room").GetProperty("reachM").GetSingle();
            CorridorEnergy = o.GetProperty("corridor").GetProperty("energy").GetSingle();
            CorridorReach = o.GetProperty("corridor").GetProperty("reachM").GetSingle();
            FixtureRadius = o.GetProperty("fixtureRadiusM").GetSingle();
            DayLampBoost = doc.RootElement.GetProperty("day").GetProperty("lampBoost").GetSingle();
            DayColour = doc.RootElement.GetProperty("day").GetProperty("colour").GetSingle();
            var n = doc.RootElement.GetProperty("night");
            NightOverheadShare = n.GetProperty("overheadShareOn").GetSingle();
            NightOverheadDim = n.GetProperty("overheadDim").GetSingle();
            NightLampShare = n.GetProperty("lampShareDimmed").GetSingle();
            NightLampDim = n.GetProperty("lampDim").GetSingle();
            var s = doc.RootElement.GetProperty("switch");
            DawnHour = s.GetProperty("dawnHour").GetSingle();
            DuskHour = s.GetProperty("duskHour").GetSingle();
            OffHour = s.GetProperty("offHour").GetSingle();
            SpreadS = s.GetProperty("spreadS").GetSingle();
            var off = doc.RootElement.GetProperty("off");
            OffLampDim = off.GetProperty("lampDim").GetSingle();
            OffOverheadDim = off.GetProperty("overheadDim").GetSingle();
        }

        /// <summary>The underground mode at this time of day (0..1): day from dawn, night from dusk, off from offHour (midnight) to dawn.</summary>
        public static Mode At(float dayFraction)
        {
            var h = dayFraction * 24;
            if (h >= DawnHour && h < DuskHour) return Mode.Day;
            // Night runs from dusk round to offHour, which may be past midnight.
            var sinceDusk = (h - DuskHour + 24) % 24;
            var nightLong = (OffHour - DuskHour + 24) % 24;
            return sinceDusk < nightLong ? Mode.Night : Mode.Off;
        }

        /// <summary>A stable 0..1 for a light, from where it is: the same lights dim every night.</summary>
        public static float Pick(Vector3 p)
        {
            var h = (uint)(Mathf.RoundToInt(p.X * 10) * 73856093) ^ (uint)(Mathf.RoundToInt(p.Y * 10) * 19349663) ^ (uint)(Mathf.RoundToInt(p.Z * 10) * 83492791);
            h ^= h >> 13;
            h *= 0x5bd1e995;
            h ^= h >> 15;
            return (h & 0xFFFF) / 65536f;
        }
    }

    /// <param name="lite">Without the costly parts (SDFGI, SSIL, volumetric fog), to measure what they cost.</param>
    /// <summary>The sky's top, horizon and ground-horizon colours by day and by night.</summary>
    public static readonly (Color top, Color horizon, Color ground) DaySky = (new(0.62f, 0.45f, 0.33f), new(0.86f, 0.66f, 0.47f), new(0.55f, 0.36f, 0.25f));
    public static readonly (Color top, Color horizon, Color ground) NightSky = (new(0.05f, 0.035f, 0.06f), new(0.17f, 0.1f, 0.1f), new(0.1f, 0.06f, 0.05f));

    public static WorldEnvironment MakeEnvironment(bool lite = false)
    {
        // The web's sky (shaders/sky.gdshader): its colours, the sun's halo, stars at night, storm murk.
        var sky = new ShaderMaterial { Shader = GD.Load<Shader>("res://shaders/sky.gdshader") };
        var env = new Godot.Environment
        {
            BackgroundMode = Godot.Environment.BGMode.Sky,
            Sky = new Sky { SkyMaterial = sky },
            AmbientLightSource = Godot.Environment.AmbientSource.Sky,
            AmbientLightEnergy = 0.25f,
            // Mixed with the sky's light (by AmbientLightSkyContribution): the dust's dim glow, which carries the nights.
            AmbientLightColor = new Color(0.46f, 0.4f, 0.4f),
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
            VolumetricFogDensity = 0.0006f,
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
        var mat = new FogMaterial { Density = 0.005f, Albedo = new Color(0.95f, 0.75f, 0.6f), HeightFalloff = 0, EdgeFade = 0.3f };
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
            // Thin walls at a glancing sun shadow themselves in jagged bands without these.
            ShadowBias = 0.08f,
            ShadowNormalBias = 2.5f,
            ShadowBlur = 1.5f,
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
