using System.Collections.Generic;
using Godot;

namespace DowntownMars;

/// <summary>
/// What the cutaway shows round the cut, as the web's stage: a rock backdrop behind the rooms (the
/// inside of a cylinder just past the unlocked rings, closed at the bottom; the cut takes the near half
/// of it too), and the cut face, where the ground is sliced (either side of the hole out to the horizon and
/// down, the crust over floor 1 in to the shaft, and a slab under the hole), turned with the camera. The cut
/// is a wedge (CameraRig.CutWidth): each side of it is its own half of the face, turned to its edge; a flat
/// cut's two halves are back to back, through the axis.
/// </summary>
public partial class Cutaway : Node3D
{
    const float Margin = 6, Reach = 1700, Bottom = -900, FloorH = 4, Crust = 3;
    /// <summary>The shaft wall's flat steps to a ring-1 slot (cylinder.ts ARC_STEPS), and how far behind it the crust's face tucks.</summary>
    const int ArcSteps = 4;
    const float Tuck = 0.01f;
    readonly MeshInstance3D _shell = new() { Name = "Shell" };
    /// <summary>The cut face's two halves, left (along −u) and right (along +u) as the camera sees a flat cut, each with its crust.</summary>
    readonly MeshInstance3D[] _halves = { new() { Name = "SectionLeft" }, new() { Name = "SectionRight" } };
    readonly MeshInstance3D[] _crusts = { new() { Name = "Crust" }, new() { Name = "Crust" } };
    readonly MeshInstance3D _slice = new() { Name = "Slice" };
    string _key = "", _crustKey = "";
    /// <summary>
    /// Each half sits `Back` metres to its own kept side, so the cut doesn't take it; in a wedge, each reaches
    /// `Seam` past the axis so the two still meet there.
    /// </summary>
    const float Back = 0.05f, Seam = Back * 4;

    public Cutaway()
    {
        AddChild(_shell);
        for (var i = 0; i < 2; i++)
        {
            AddChild(_halves[i]);
            _halves[i].AddChild(_crusts[i]);
        }
        AddChild(_slice);
        Visible = false;
    }

    static Material Rock() => Looks.For("rock:cutaway", new Color("#6a3a28"), 1, 0, false)!;

    /// <summary>Built for the hole's size.</summary>
    void Build(HoleShape h, bool wedge)
    {
        var key = $"{h.ShaftRadiusM}:{h.UnlockedRings}:{h.Floors}:{wedge}";
        if (key == _key) return;
        _key = key;
        var rOuter = h.ShaftRadiusM + h.UnlockedRings * 10 + Margin;
        var deep = (h.Floors + 1) * FloorH + Crust + Margin;
        // The backdrop: the cylinder's inside, and its floor.
        var verts = new List<Vector3>();
        const int n = 96;
        for (var i = 0; i < n; i++)
        {
            float a0 = Mathf.Tau * i / n, a1 = Mathf.Tau * (i + 1) / n;
            Vector3 P(float a, float y) => new(rOuter * Mathf.Cos(a), y, rOuter * Mathf.Sin(a));
            verts.AddRange(new[] { P(a0, 0), P(a1, 0), P(a1, -deep), P(a0, 0), P(a1, -deep), P(a0, -deep) });
            verts.AddRange(new[] { new Vector3(0, -deep, 0), P(a0, -deep), P(a1, -deep) });
        }
        _shell.Mesh = Mesh(verts);
        _shell.MaterialOverride = Rock();
        // The cut face, in its own frame: u along the cut (x), y up; Show turns each half to its side of the cut.
        var inner = h.ShaftRadiusM + h.UnlockedRings * 10 + Margin;
        var seam = wedge ? Seam : 0;
        var left = new List<Vector3>();
        var right = new List<Vector3>();
        void Quad(List<Vector3> face, float u0, float u1, float y0, float y1) =>
            face.AddRange(new[] { new Vector3(u0, y1, 0), new Vector3(u1, y1, 0), new Vector3(u1, y0, 0), new Vector3(u0, y1, 0), new Vector3(u1, y0, 0), new Vector3(u0, y0, 0) });
        Quad(left, -Reach, -inner, Bottom, 0);
        Quad(right, inner, Reach, Bottom, 0);
        // The slab under the hole, half each side, meeting at the axis.
        Quad(left, -inner, seam, Bottom, -deep);
        Quad(right, -seam, inner, Bottom, -deep);
        // Free view's cut through the land, in the shaft wall's rock, where the rings look widest (Show places it).
        var cut = new List<Vector3>();
        void CutQuad(float u0, float u1) =>
            cut.AddRange(new[] { new Vector3(u0, 0, 0), new Vector3(u1, 0, 0), new Vector3(u1, Bottom, 0), new Vector3(u0, 0, 0), new Vector3(u1, Bottom, 0), new Vector3(u0, Bottom, 0) });
        // From the middle out: the shader leaves out what's inside the rock wall (view.gdshaderinc).
        CutQuad(-Reach, 0);
        CutQuad(0, Reach);
        _slice.Mesh = Mesh(cut);
        // Its own material: it fades with distance and dissolves in (view.gdshaderinc `slice_role` 2).
        var sliceRock = Looks.For("rock:slice", new Color("#6a3a28"), 1, 0, false);
        if (sliceRock is ShaderMaterial s) s.SetShaderParameter("slice_role", 2);
        _slice.MaterialOverride = sliceRock;
        _halves[0].Mesh = Mesh(left);
        _halves[1].Mesh = Mesh(right);
        foreach (var half in _halves) half.MaterialOverride = Rock();
    }

    /// <summary>
    /// The crust over floor 1 is rock all the way in to the shaft wall, not open to the backdrop. The wall is
    /// drawn in flat steps, so either side the face starts where the cut meets them (cylinder.ts shaftCollarRadius),
    /// which moves as the cut turns. `edges` are the angles the cut's left and right sides run out at.
    /// </summary>
    void BuildCrust(HoleShape h, float[] edges)
    {
        var key = $"{_key}:{edges[0]}:{edges[1]}";
        if (key == _crustKey) return;
        _crustKey = key;
        var inner = h.ShaftRadiusM + h.UnlockedRings * 10 + Margin;
        var step = Mathf.Tau / (Mathf.Max(1, h.RingSlots.Length > 0 ? h.RingSlots[0] : 1) * ArcSteps);
        float Collar(float angle)
        {
            var off = Mathf.PosMod(angle, step) - step / 2;
            return h.ShaftRadiusM * Mathf.Cos(step / 2) / Mathf.Cos(off) - Tuck;
        }
        for (var i = 0; i < 2; i++)
        {
            // Left to right, as the other quads, so it faces the same way.
            var sign = i == 0 ? -1f : 1f;
            var wall = sign * Collar(edges[i]);
            float u0 = Mathf.Min(wall, sign * inner), u1 = Mathf.Max(wall, sign * inner);
            _crusts[i].Mesh = Mesh(new List<Vector3> { new(u0, 0, 0), new(u1, 0, 0), new(u1, -Crust, 0), new(u0, 0, 0), new(u1, -Crust, 0), new(u0, -Crust, 0) });
            _crusts[i].MaterialOverride = Rock();
        }
    }

    static ArrayMesh Mesh(List<Vector3> verts)
    {
        var st = new SurfaceTool();
        st.Begin(Godot.Mesh.PrimitiveType.Triangles);
        foreach (var v in verts) st.AddVertex(v);
        st.GenerateNormals();
        return st.Commit();
    }

    /// <summary>
    /// On in the cutaway: the backdrop always, the cut face with no floor picked (the ground's there to cut
    /// then). Sliced (Free view with a floor picked), only the cut face either side of the rings, without the slab
    /// under the hole, so the land reads as cut open down to that floor: square to `toward` (from the axis
    /// toward the camera), `offset` metres toward it, where the rings look widest. `width` is the cutaway's
    /// wedge, in radians (π: flat).
    /// </summary>
    public void Show(bool on, HoleShape hole, float heading, bool whole, bool sliced = false, Vector2 toward = default, float offset = 0, float width = Mathf.Pi)
    {
        Visible = on || sliced;
        if (!Visible) return;
        Build(hole, width < Mathf.Pi - 1e-4f);
        _shell.Visible = on;
        var outward = new Vector3(Mathf.Cos(heading), 0, Mathf.Sin(heading));
        var flat = new Basis(new Vector3(-outward.Z, 0, outward.X), Vector3.Up, outward);
        // Each half turned from the flat cut to its edge of the wedge, half the width either side of the camera,
        // and a hair to its kept side. (Angles here run from +x toward +z: the other way round +y for Godot.)
        var turn = width / 2 - Mathf.Pi / 2;
        var edges = new float[2];
        for (var i = 0; i < 2; i++)
        {
            var sign = i == 0 ? -1f : 1f;
            var edge = heading + sign * width / 2;
            edges[i] = edge;
            _halves[i].Visible = on && whole;
            _halves[i].Basis = flat.Rotated(Vector3.Up, -sign * turn);
            _halves[i].Position = sign * new Vector3(-Mathf.Sin(edge), 0, Mathf.Cos(edge)) * Back;
        }
        if (on && whole) BuildCrust(hole, edges);
        _slice.Visible = sliced && !on;
        var at = new Vector3(toward.X, 0, toward.Y);
        _slice.Basis = new Basis(new Vector3(-at.Z, 0, at.X), Vector3.Up, at);
        _slice.Position = at * (offset - 0.05f);
    }
}
