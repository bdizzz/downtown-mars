using System.Collections.Generic;
using Godot;

namespace DowntownMars;

/// <summary>
/// Below ground (a floor picked, or walking), as the web's stage: a wall of rock just past the unlocked
/// rings, from the floor in view up to the surface, so the view stops at rock rather than running off
/// into the distance. Only its inside is drawn, so a camera outside it (zoomed out) sees straight through.
/// </summary>
public partial class RockWall : MeshInstance3D
{
    // Flush with the rings' outer edge, just clear of the outer walls; it reaches a little below the floor.
    const float Flush = 0.05f, Below = 6, FloorH = 4, Crust = 3;
    string _key = "";

    public RockWall()
    {
        Name = "RockWall";
        Visible = false;
        // The shaft wall's rock. Its shader draws both sides, but the camera's always inside the wall (Top,
        // the shaft, walking), and in Iso's cut-out the shader leaves out the side nearer the camera.
        MaterialOverride = Looks.For("rock:wall", new Color("#6a3a28"), 1, 0, false);
        // In Iso's cut-out its near side goes and it darkens with depth (view.gdshaderinc `slice_role` 3).
        if (MaterialOverride is ShaderMaterial s) s.SetShaderParameter("slice_role", 3);
    }

    /// <summary>The wall's radius: just past the unlocked rings, where the cutaway's backdrop sits.</summary>
    public static float Radius(HoleShape hole) => hole.ShaftRadiusM + hole.UnlockedRings * 10 + Flush;

    /// <summary>Shown down to the bottom of this floor (null: hidden). In Iso's cut-out the shader leaves out its near side.</summary>
    public void Show(HoleShape hole, int? floor)
    {
        Visible = floor != null;
        if (floor == null) return;
        var key = $"{hole.ShaftRadiusM}:{hole.UnlockedRings}:{floor}";
        if (key == _key) return;
        _key = key;
        var r = Radius(hole);
        var deep = floor.Value * FloorH + Crust + Below;
        var verts = new List<Vector3>();
        const int n = 96;
        Vector3 P(float a, float y) => new(r * Mathf.Cos(a), y, r * Mathf.Sin(a));
        for (var i = 0; i < n; i++)
        {
            float a0 = Mathf.Tau * i / n, a1 = Mathf.Tau * (i + 1) / n;
            verts.AddRange(new[] { P(a0, 0), P(a1, 0), P(a1, -deep), P(a0, 0), P(a1, -deep), P(a0, -deep) });
        }
        var st = new SurfaceTool();
        st.Begin(Godot.Mesh.PrimitiveType.Triangles);
        foreach (var v in verts) st.AddVertex(v);
        st.GenerateNormals();
        Mesh = st.Commit();
    }
}
