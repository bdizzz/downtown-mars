using System.Collections.Generic;
using Godot;

namespace DowntownMars;

/// <summary>
/// The exported scene's materials are plain colours (the web game's procedural surfaces are its own
/// shaders, which don't travel). Here each gets a richer surface by what it is, from its name:
/// rock with grain and relief, room walls and floors with fine texture, glass that's clear and
/// glossy, furniture with its vertex colours and a little surface detail. All textures are
/// generated noise (no downloads), mapped by world position, so nothing needs unwrapping.
/// </summary>
static class Dress
{
    static readonly Dictionary<string, Material> Done = new();

    public static void Apply(Node root)
    {
        foreach (var node in Walk(root))
        {
            if (node is not MeshInstance3D mi || mi.Mesh == null) continue;
            for (var i = 0; i < mi.Mesh.GetSurfaceCount(); i++)
            {
                if (mi.Mesh.SurfaceGetMaterial(i) is not BaseMaterial3D m) continue;
                mi.SetSurfaceOverrideMaterial(i, For(m));
            }
        }
    }

    static IEnumerable<Node> Walk(Node n)
    {
        yield return n;
        foreach (var c in n.GetChildren())
            foreach (var d in Walk(c)) yield return d;
    }

    /// <summary>The dressed material for an exported one (made once per original).</summary>
    public static Material For(BaseMaterial3D src)
    {
        if (Dev.Off("dress")) return src;
        var key = $"{src.ResourceName}|{src.AlbedoColor}|{src.Transparency}";
        if (Done.TryGetValue(key, out var hit)) return hit;
        var name = src.ResourceName ?? "";
        Material made;
        if (src.Transparency != BaseMaterial3D.TransparencyEnum.Disabled) made = Glass(src);
        else if (name.StartsWith("rock") || name.StartsWith("finish:rock")) made = Rock(src);
        else if (name.StartsWith("furniture:")) made = Furniture(src);
        else if (src.EmissionEnabled) made = src;
        else made = Surface(src);
        Done[key] = made;
        return made;
    }

    /// <summary>Martian rock: grain, mottling and relief, mapped round the hole by world position.</summary>
    static Material Rock(BaseMaterial3D src) => new StandardMaterial3D
    {
        AlbedoColor = src.AlbedoColor,
        AlbedoTexture = Noise.Tone(0.04f, 0.72f),
        NormalEnabled = true,
        NormalTexture = Noise.Bumps(0.06f, 9),
        NormalScale = 1.2f,
        Roughness = 0.95f,
        Uv1Triplanar = true,
        Uv1WorldTriplanar = true,
        Uv1Scale = new Vector3(0.12f, 0.12f, 0.12f),
        Uv1TriplanarSharpness = 4,
    };

    /// <summary>Room walls and floors: their colour, with a fine plaster-like grain and a soft sheen.</summary>
    static Material Surface(BaseMaterial3D src) => new StandardMaterial3D
    {
        AlbedoColor = src.AlbedoColor,
        AlbedoTexture = Noise.Tone(0.2f, 0.88f),
        NormalEnabled = true,
        NormalTexture = Noise.Bumps(0.3f, 2),
        NormalScale = 0.12f,
        Roughness = Mathf.Min(src.Roughness, 0.8f),
        Metallic = src.Metallic,
        Uv1Triplanar = true,
        Uv1WorldTriplanar = true,
        Uv1Scale = new Vector3(0.5f, 0.5f, 0.5f),
        CullMode = BaseMaterial3D.CullModeEnum.Disabled,
    };

    /// <summary>Furniture keeps its painted vertex colours, with a little grain.</summary>
    static Material Furniture(BaseMaterial3D src) => new StandardMaterial3D
    {
        VertexColorUseAsAlbedo = true,
        AlbedoColor = src.AlbedoColor,
        NormalEnabled = true,
        NormalTexture = Noise.Bumps(1.5f, 1.5f),
        NormalScale = 0.25f,
        Roughness = src.Roughness,
        Metallic = src.Metallic,
        EmissionEnabled = src.EmissionEnabled,
        Emission = src.Emission,
        EmissionEnergyMultiplier = src.EmissionEnergyMultiplier,
        Uv1Triplanar = true,
        Uv1WorldTriplanar = true,
    };

    /// <summary>Glass: clear, glossy, a faint tint, reflecting the world (Godot's screen-space and sky reflections).</summary>
    static Material Glass(BaseMaterial3D src)
    {
        var c = src.AlbedoColor;
        return new StandardMaterial3D
        {
            AlbedoColor = new Color(c.R, c.G, c.B, Mathf.Clamp(c.A, 0.08f, 0.35f)),
            Transparency = BaseMaterial3D.TransparencyEnum.Alpha,
            Roughness = 0.04f,
            Metallic = 0.0f,
            MetallicSpecular = 0.8f,
            CullMode = BaseMaterial3D.CullModeEnum.Disabled,
            EmissionEnabled = src.EmissionEnabled,
            Emission = src.Emission,
            EmissionEnergyMultiplier = src.EmissionEnergyMultiplier,
        };
    }
}

/// <summary>Seamless noise textures, made once each.</summary>
static class Noise
{
    static readonly Dictionary<string, Texture2D> Made = new();

    /// <summary>A greyscale tone between `low` and 1, multiplied into a colour.</summary>
    public static Texture2D Tone(float frequency, float low) => Get($"tone:{frequency}:{low}", () => new NoiseTexture2D
    {
        Width = 1024,
        Height = 1024,
        Seamless = true,
        Noise = new FastNoiseLite { NoiseType = FastNoiseLite.NoiseTypeEnum.SimplexSmooth, Frequency = frequency, FractalOctaves = 6, FractalType = FastNoiseLite.FractalTypeEnum.Fbm },
        ColorRamp = new Gradient { Colors = new[] { new Color(low, low, low), Colors.White }, Offsets = new[] { 0f, 1f } },
        GenerateMipmaps = true,
    });

    /// <summary>A normal map from noise: relief of this strength.</summary>
    public static Texture2D Bumps(float frequency, float strength) => Get($"bumps:{frequency}:{strength}", () => new NoiseTexture2D
    {
        Width = 1024,
        Height = 1024,
        Seamless = true,
        AsNormalMap = true,
        BumpStrength = strength,
        Noise = new FastNoiseLite { NoiseType = FastNoiseLite.NoiseTypeEnum.Cellular, Frequency = frequency, FractalOctaves = 4, FractalType = FastNoiseLite.FractalTypeEnum.Fbm },
        GenerateMipmaps = true,
    });

    static Texture2D Get(string key, System.Func<Texture2D> make)
    {
        if (!Made.TryGetValue(key, out var t)) Made[key] = t = make();
        return t;
    }
}
