using System.Linq;

namespace DowntownMars;

/// <summary>
/// Switches for measuring what things cost: DM_FX=nosdfgi,nofog,nossil,nossao,noglow,nolamps,nofurniture,
/// nopeople,nolabels,nosunshadow,nomsaa,nominiature,nomodels turns each off (see docs/PLAN-GODOT.md for numbers;
/// nomodels draws first person's Blender-made furniture models, #357 and #360, as their code-built parts).
/// DM_FP_STRESS=lathe draws that item's first-person model for every item in first person, to measure models
/// everywhere at about the triangle limit (#362), as the web's `__stage3d.models(true, "lathe")`.
/// </summary>
static class Dev
{
    static readonly string[] Fx = (System.Environment.GetEnvironmentVariable("DM_FX") ?? "").Split(',');

    public static bool Off(string what) => Fx.Contains("no" + what);

    public static readonly string? FpStress = System.Environment.GetEnvironmentVariable("DM_FP_STRESS") is { Length: > 0 } s ? s : null;
}
