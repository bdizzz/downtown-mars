using Godot;

namespace DowntownMars;

/// <summary>
/// Dust storms, as the web's (render3d/storm3d.ts and the stage's applyStorm): the storm's strength
/// eases toward the sim's (0.8 a second); the sky thickens to murk (dusty by day, near black by night),
/// the air fills with haze (Godot's volumetric fog, which the lamps light up), and grit streams past
/// the camera on the wind: GPU particles in a box round the camera, above the ground, thicker as the
/// storm builds. From above only, as the web's (not with a floor picked).
/// </summary>
public partial class Storm : Node3D
{
    static readonly Color Murk = new("#9a6a4a"), MurkNight = new("#1a100c");
    const float Ease = 0.8f, Reach = 28, Height = 14;

    readonly GpuParticles3D _grit;
    readonly StandardMaterial3D _dotMaterial;
    static readonly Color Grit = new("#c49468");
    float _target;
    public float Level { get; private set; }

    public Storm()
    {
        var process = new ParticleProcessMaterial
        {
            EmissionShape = ParticleProcessMaterial.EmissionShapeEnum.Box,
            EmissionBoxExtents = new Vector3(Reach, Height / 2, Reach),
            // Along the wind (0.6 rad about y, as the web's), wandering a little up and down.
            Direction = new Vector3(Mathf.Cos(0.6f), 0, Mathf.Sin(0.6f)),
            Spread = 9,
            InitialVelocityMin = 9,
            InitialVelocityMax = 18,
            Gravity = Vector3.Zero,
            ScaleMin = 0.7f,
            ScaleMax = 1.3f,
        };
        var dot = new QuadMesh { Size = new Vector2(0.08f, 0.08f) };
        dot.Material = _dotMaterial = new StandardMaterial3D
        {
            // Motes right at the lens would be blobs: they fade in from 2 to 8 metres out.
            DistanceFadeMode = BaseMaterial3D.DistanceFadeModeEnum.PixelAlpha,
            DistanceFadeMinDistance = 2,
            DistanceFadeMaxDistance = 8,
            ShadingMode = BaseMaterial3D.ShadingModeEnum.Unshaded,
            BillboardMode = BaseMaterial3D.BillboardModeEnum.Particles,
            Transparency = BaseMaterial3D.TransparencyEnum.Alpha,
            AlbedoColor = Grit with { A = 0.75f },
            AlbedoTexture = SoftDot(),
            VertexColorUseAsAlbedo = false,
        };
        _grit = new GpuParticles3D
        {
            Amount = 3000,
            Lifetime = 3.2,
            ProcessMaterial = process,
            DrawPass1 = dot,
            Emitting = false,
            LocalCoords = false,
            VisibilityAabb = new Aabb(new Vector3(-80, -20, -80), new Vector3(160, 40, 160)),
            CastShadow = GeometryInstance3D.ShadowCastingSetting.Off,
            Preprocess = 2,
        };
        AddChild(_grit);
    }

    static Texture2D SoftDot()
    {
        var img = Image.CreateEmpty(32, 32, false, Image.Format.Rgba8);
        for (var y = 0; y < 32; y++)
            for (var x = 0; x < 32; x++)
            {
                var d = new Vector2(x - 15.5f, y - 15.5f).Length() / 16;
                img.SetPixel(x, y, new Color(1, 1, 1, Mathf.Clamp(1 - d * d, 0, 1)));
            }
        return ImageTexture.CreateFromImage(img);
    }

    /// <summary>The sim's storm, 0 clear to 1 (eased toward; the first one taken at once).</summary>
    public void SetTarget(float storm, bool first)
    {
        _target = storm;
        if (first) Level = storm;
    }

    /// <summary>
    /// Ease on, and show it: the sky toward murk by the day's light, haze, and grit round the camera
    /// (only from above, with no floor picked). Returns the level for the lighting to dim by.
    /// </summary>
    public float Step(float dt, float light, Godot.Environment env, Camera3D? camera, bool fromAbove)
    {
        Level += (_target - Level) * Mathf.Min(1, dt * Ease);
        if (Mathf.Abs(_target - Level) < 0.002f) Level = _target;
        // The sky's murk (shaders/sky.gdshader mixes it in, dusty by day, near black by night).
        if (env.Sky?.SkyMaterial is ShaderMaterial sky) sky.SetShaderParameter("dust", Level);
        // Haze: from the calm day's light dust to a brown-out.
        env.VolumetricFogDensity = Mathf.Lerp(0.0006f, 0.012f, Level);
        env.VolumetricFogAlbedo = new Color(0.9f, 0.7f, 0.55f).Lerp(new Color("#b07a52"), Level);
        var blowing = fromAbove && Level > 0.01f && camera != null;
        _grit.Emitting = blowing;
        _grit.Visible = blowing;
        if (blowing)
        {
            _grit.AmountRatio = Level;
            // Lit by the day: dim at night (they're unshaded, so they'd glow).
            _dotMaterial.AlbedoColor = (Grit * (0.2f + 0.8f * light)) with { A = 0.75f };
            // The box follows the camera across the land, kept above the ground.
            var c = camera!.GlobalPosition;
            _grit.GlobalPosition = new Vector3(c.X, Mathf.Max(Height / 2, c.Y - 4), c.Z);
        }
        return Level;
    }
}
