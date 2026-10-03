using System.Collections.Generic;
using Godot;

namespace DowntownMars;

/// <summary>
/// What the cutaway shows round the cut, as the web's stage: a rock backdrop behind the rooms (the
/// inside of a cylinder just past the unlocked rings, closed at the bottom; the cut takes the near half
/// of it too), and the cut face, where the ground is sliced (the section through the axis, either side
/// of the hole out to the horizon and down, and a slab under the hole), turned with the camera.
/// </summary>
public partial class Cutaway : Node3D
{
    const float Margin = 6, Reach = 1700, Bottom = -900, FloorH = 4, Crust = 3;
    readonly MeshInstance3D _shell = new() { Name = "Shell" };
    readonly MeshInstance3D _section = new() { Name = "Section" };
    string _key = "";

    public Cutaway()
    {
        AddChild(_shell);
        AddChild(_section);
        Visible = false;
    }

    static Material Rock() => Looks.For("rock:cutaway", new Color("#6a3a28"), 1, 0, false)!;

    /// <summary>Built for the hole's size.</summary>
    void Build(HoleShape h)
    {
        var key = $"{h.ShaftRadiusM}:{h.UnlockedRings}:{h.Floors}";
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
        // The cut face, in its own frame: u along the cut (x), y up; the node turns it with the camera.
        var inner = h.ShaftRadiusM + h.UnlockedRings * 10 + Margin;
        var face = new List<Vector3>();
        void Quad(float u0, float u1, float y0, float y1) =>
            face.AddRange(new[] { new Vector3(u0, y1, 0), new Vector3(u1, y1, 0), new Vector3(u1, y0, 0), new Vector3(u0, y1, 0), new Vector3(u1, y0, 0), new Vector3(u0, y0, 0) });
        Quad(-Reach, -inner, Bottom, 0);
        Quad(inner, Reach, Bottom, 0);
        Quad(-inner, inner, Bottom, -deep);
        _section.Mesh = Mesh(face);
        _section.MaterialOverride = Rock();
    }

    static ArrayMesh Mesh(List<Vector3> verts)
    {
        var st = new SurfaceTool();
        st.Begin(Godot.Mesh.PrimitiveType.Triangles);
        foreach (var v in verts) st.AddVertex(v);
        st.GenerateNormals();
        return st.Commit();
    }

    /// <summary>On in the cutaway: the backdrop always, the cut face with no floor picked (the ground's there to cut then).</summary>
    public void Show(bool on, HoleShape hole, float heading, bool whole)
    {
        Visible = on;
        if (!on) return;
        Build(hole);
        _section.Visible = whole;
        // Along the cut, a hair to the kept side so the cut doesn't take it.
        var outward = new Vector3(Mathf.Cos(heading), 0, Mathf.Sin(heading));
        _section.Basis = new Basis(new Vector3(-outward.Z, 0, outward.X), Vector3.Up, outward);
        _section.Position = -outward * 0.05f;
    }
}
