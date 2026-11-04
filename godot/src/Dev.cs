using System.Linq;

namespace DowntownMars;

/// <summary>
/// Switches for measuring what things cost: DM_FX=nosdfgi,nofog,nossil,nossao,noglow,nolamps,nofurniture,
/// nopeople,nolabels,nosunshadow,nomsaa,nominiature,nomodels turns each off (see docs/PLAN-GODOT.md for numbers;
/// nomodels draws first person's Blender-made furniture models, #357 and #360, as their code-built parts).
/// </summary>
static class Dev
{
    static readonly string[] Fx = (System.Environment.GetEnvironmentVariable("DM_FX") ?? "").Split(',');

    public static bool Off(string what) => Fx.Contains("no" + what);
}
