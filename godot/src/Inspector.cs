using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// The room panel: what the clicked room is and how it's doing (from the bridge's inspect.ts, kept
/// up to date while it's open), and its outline drawn over the scene.
/// </summary>
public partial class Inspector : Node3D
{
    readonly PanelContainer _panel = new();
    readonly Label _title = new(), _subtitle = new(), _state = new(), _lines = new();
    readonly Button _connect = new() { Text = "Connect", FocusMode = Control.FocusModeEnum.None, TooltipText = "Carve corridors (rock finish) along rooms to reach it" };
    readonly Button _demolish = new() { Text = "Demolish", FocusMode = Control.FocusModeEnum.None };
    int _roomId;
    readonly MeshInstance3D _outline = new() { Name = "Outline", CastShadow = GeometryInstance3D.ShadowCastingSetting.Off };
    readonly StandardMaterial3D _lineMaterial = new()
    {
        ShadingMode = BaseMaterial3D.ShadingModeEnum.Unshaded,
        AlbedoColor = new Color(1f, 0.85f, 0.55f),
        NoDepthTest = true,
        RenderPriority = 10,
    };
    string _outlineData = "";

    public Action? Closed { get; set; }
    /// <summary>Sends a simulation command (SimCommand) for the room's buttons.</summary>
    public Action<Dictionary<string, object>>? Command { get; set; }

    public Inspector(CanvasLayer hud)
    {
        AddChild(_outline);
        _panel.Visible = false;
        _panel.SetAnchorsPreset(Control.LayoutPreset.TopRight);
        _panel.GrowHorizontal = Control.GrowDirection.Begin;
        _panel.Position = new Vector2(-360, 100);
        _panel.CustomMinimumSize = new Vector2(330, 0);
        _panel.AddThemeStyleboxOverride("panel", Live.Panel());
        hud.AddChild(_panel);
        var rows = new VBoxContainer();
        rows.AddThemeConstantOverride("separation", 6);
        _panel.AddChild(rows);
        var head = new HBoxContainer();
        rows.AddChild(head);
        Style(_title, 20, new Color("#e8834a"));
        _title.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        head.AddChild(_title);
        var close = new Button { Text = "×", Flat = true, FocusMode = Control.FocusModeEnum.None };
        close.Pressed += () => Closed?.Invoke();
        head.AddChild(close);
        Style(_subtitle, 14, new Color("#c9b29c"));
        rows.AddChild(_subtitle);
        Style(_state, 15, new Color("#f3e6d8"));
        rows.AddChild(_state);
        Style(_lines, 14, new Color("#e0cfbd"));
        rows.AddChild(_lines);
        var buttons = new HBoxContainer();
        buttons.AddThemeConstantOverride("separation", 8);
        rows.AddChild(buttons);
        _connect.Pressed += () => Command?.Invoke(new() { ["type"] = "connectRoom", ["roomId"] = _roomId, ["finish"] = "rock" });
        _demolish.Pressed += () => Command?.Invoke(new() { ["type"] = "demolish", ["roomId"] = _roomId });
        buttons.AddChild(_connect);
        buttons.AddChild(_demolish);
    }

    static void Style(Label l, int size, Color color)
    {
        l.AddThemeFontSizeOverride("font_size", size);
        l.AddThemeColorOverride("font_color", color);
        l.AutowrapMode = TextServer.AutowrapMode.WordSmart;
        l.CustomMinimumSize = new Vector2(300, 0);
    }

    public bool Open => _panel.Visible;

    /// <summary>The bridge's "inspected" message: a room's lines and outline, or roomId null to close.</summary>
    public void Show(JsonElement msg)
    {
        if (msg.GetProperty("roomId").ValueKind != JsonValueKind.Number)
        {
            Hide();
            return;
        }
        _panel.Visible = true;
        _roomId = msg.GetProperty("roomId").GetInt32();
        _connect.Visible = !msg.GetProperty("connected").GetBoolean() && !msg.GetProperty("unbuilt").GetBoolean();
        _demolish.Text = msg.GetProperty("unbuilt").GetBoolean() ? "Cancel" : "Demolish";
        _title.Text = msg.GetProperty("title").GetString();
        _subtitle.Text = msg.GetProperty("subtitle").GetString();
        _state.Text = msg.GetProperty("state").GetString();
        _state.AddThemeColorOverride("font_color", msg.GetProperty("problem").GetBoolean() ? new Color("#f0a030") : new Color("#9fd28a"));
        var lines = new System.Collections.Generic.List<string>();
        foreach (var l in msg.GetProperty("lines").EnumerateArray()) lines.Add(l.GetString()!);
        _lines.Text = string.Join("\n", lines);
        _lines.Visible = lines.Count > 0;
        var outline = msg.GetProperty("outline").GetString()!;
        if (outline != _outlineData)
        {
            _outlineData = outline;
            var f = MemoryMarshal.Cast<byte, float>(Convert.FromBase64String(outline)).ToArray();
            var verts = new Vector3[f.Length / 3];
            for (var i = 0; i < verts.Length; i++) verts[i] = new Vector3(f[i * 3], f[i * 3 + 1], f[i * 3 + 2]);
            var arrays = new Godot.Collections.Array();
            arrays.Resize((int)Mesh.ArrayType.Max);
            arrays[(int)Mesh.ArrayType.Vertex] = verts;
            var mesh = new ArrayMesh();
            if (verts.Length > 0)
            {
                mesh.AddSurfaceFromArrays(Mesh.PrimitiveType.Lines, arrays);
                mesh.SurfaceSetMaterial(0, _lineMaterial);
            }
            _outline.Mesh = mesh;
        }
        _outline.Visible = true;
    }

    public new void Hide()
    {
        _panel.Visible = false;
        _outline.Visible = false;
        _outlineData = "";
    }
}
