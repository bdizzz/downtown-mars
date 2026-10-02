using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// Building from Godot, by the web game's rules (the bridge's build.ts): a strip of categories along
/// the bottom (B opens it), each popping up its rooms; choosing one puts it in hand, and the pointer
/// shows a ghost of where it would go, green or red, with its cost or why not. Click to build, R turns
/// it (cycles its shapes), Esc or a right click puts it down.
/// </summary>
public partial class BuildMode : Node3D
{
    record Room(string Id, string Name, string Category, int[][] Shapes, bool Surface, string Cost, string? Key, string? Locked, string? Short);

    readonly Action<object> _send;
    readonly PanelContainer _strip = new();
    readonly HBoxContainer _categories = new();
    readonly PanelContainer _popup = new();
    readonly GridContainer _rooms = new() { Columns = 1 };
    readonly Label _tip = new();
    readonly Label _toast = new();
    readonly ConfirmationDialog _confirm = new() { Title = "Build here?", OkButtonText = "Build", CancelButtonText = "Cancel" };
    readonly MeshInstance3D _ghost = new() { Name = "Ghost", CastShadow = GeometryInstance3D.ShadowCastingSetting.Off };
    readonly StandardMaterial3D _good = Ghost(new Color(0.45f, 0.95f, 0.5f, 0.35f)), _bad = Ghost(new Color(1f, 0.35f, 0.3f, 0.35f));
    List<Room> _palette = new();
    List<(string id, string name)> _cats = new();
    string? _open;
    double _toastUntil, _clock;
    object? _pendingConfirm;

    /// <summary>The room in hand and its shape, or null.</summary>
    public string? Tool { get; private set; }
    int _shape;
    public bool Active => _strip.Visible;

    public BuildMode(CanvasLayer hud, Action<object> send)
    {
        _send = send;
        AddChild(_ghost);
        _ghost.Visible = false;

        _strip.AddThemeStyleboxOverride("panel", Live.Panel());
        _strip.SetAnchorsPreset(Control.LayoutPreset.CenterBottom);
        _strip.GrowHorizontal = Control.GrowDirection.Both;
        _strip.GrowVertical = Control.GrowDirection.Begin;
        _strip.Position = new Vector2(0, -80);
        _strip.Visible = false;
        hud.AddChild(_strip);
        _strip.AddChild(_categories);

        _popup.AddThemeStyleboxOverride("panel", Live.Panel());
        _popup.Visible = false;
        hud.AddChild(_popup);
        _popup.AddChild(_rooms);

        Style(_tip, 14, new Color("#f3e6d8"));
        _tip.Visible = false;
        _tip.AddThemeStyleboxOverride("normal", Live.Panel());
        hud.AddChild(_tip);

        Style(_toast, 16, new Color("#f3e6d8"));
        _toast.AddThemeStyleboxOverride("normal", Live.Panel());
        _toast.SetAnchorsPreset(Control.LayoutPreset.CenterBottom);
        _toast.GrowHorizontal = Control.GrowDirection.Both;
        _toast.Position = new Vector2(0, -150);
        _toast.Visible = false;
        hud.AddChild(_toast);

        _confirm.Confirmed += () =>
        {
            if (_pendingConfirm is Dictionary<string, object?> place) _send(place);
            _pendingConfirm = null;
        };
        hud.AddChild(_confirm);
    }

    static StandardMaterial3D Ghost(Color c) => new()
    {
        ShadingMode = BaseMaterial3D.ShadingModeEnum.Unshaded,
        AlbedoColor = c,
        Transparency = BaseMaterial3D.TransparencyEnum.Alpha,
        CullMode = BaseMaterial3D.CullModeEnum.Disabled,
        NoDepthTest = true,
        RenderPriority = 5,
    };

    static void Style(Label l, int size, Color color)
    {
        l.AddThemeFontSizeOverride("font_size", size);
        l.AddThemeColorOverride("font_color", color);
    }

    public override void _Process(double delta)
    {
        _clock += delta;
        if (_toast.Visible && _clock > _toastUntil) _toast.Visible = false;
    }

    public void Toast(string text)
    {
        _toast.Text = text;
        _toast.Visible = true;
        _toastUntil = _clock + 3.5;
    }

    /// <summary>Open or close the strip (closing puts down whatever's in hand).</summary>
    public void Toggle(bool? on = null)
    {
        _strip.Visible = on ?? !_strip.Visible;
        if (!_strip.Visible)
        {
            Drop();
            OpenCategory(null);
        }
    }

    public void Drop()
    {
        Tool = null;
        _ghost.Visible = false;
        _tip.Visible = false;
        RefreshRooms();
    }

    /// <summary>The bridge's palette: categories, and each buildable room with its shapes, cost and whether it's locked or unaffordable.</summary>
    public void SetPalette(JsonElement msg)
    {
        _cats = msg.GetProperty("categories").EnumerateArray().Select(c => (c.GetProperty("id").GetString()!, c.GetProperty("name").GetString()!)).ToList();
        _palette = msg.GetProperty("rooms").EnumerateArray().Select(r => new Room(
            r.GetProperty("id").GetString()!,
            r.GetProperty("name").GetString()!,
            r.GetProperty("category").GetString()!,
            r.GetProperty("shapes").EnumerateArray().Select(s => s.EnumerateArray().Select(x => x.GetInt32()).ToArray()).ToArray(),
            r.GetProperty("surface").GetBoolean(),
            r.GetProperty("cost").GetString()!,
            r.TryGetProperty("key", out var k) ? k.GetString() : null,
            r.TryGetProperty("locked", out var l) ? l.GetString() : null,
            r.TryGetProperty("short", out var s2) ? s2.GetString() : null)).ToList();
        foreach (var c in _categories.GetChildren()) c.QueueFree();
        foreach (var (id, name) in _cats)
        {
            var b = new Button { Text = name, ToggleMode = true, FocusMode = Control.FocusModeEnum.None };
            var cat = id;
            b.Pressed += () => OpenCategory(_open == cat ? null : cat);
            b.SetMeta("cat", id);
            _categories.AddChild(b);
        }
        RefreshRooms();
    }

    void OpenCategory(string? cat)
    {
        _open = cat;
        foreach (var b in _categories.GetChildren().OfType<Button>()) b.ButtonPressed = b.GetMeta("cat").AsString() == cat;
        RefreshRooms();
    }

    void RefreshRooms()
    {
        // Out at once (not at the end of the frame), so the popup sizes to the new list.
        foreach (var c in _rooms.GetChildren())
        {
            _rooms.RemoveChild(c);
            c.QueueFree();
        }
        _popup.Visible = _open != null && _strip.Visible;
        if (!_popup.Visible) return;
        var list = _palette.Where(r => r.Category == _open).ToList();
        // Long lists in two columns, so they don't run off the top.
        _rooms.Columns = list.Count > 8 ? 2 : 1;
        foreach (var r in list)
        {
            var why = r.Locked ?? r.Short;
            var b = new Button
            {
                Text = $"{r.Name}{(r.Key != null ? $" [{r.Key}]" : "")}  ·  {r.Cost}",
                TooltipText = why ?? "",
                Alignment = HorizontalAlignment.Left,
                ToggleMode = true,
                ButtonPressed = Tool == r.Id,
                Disabled = r.Locked != null,
                FocusMode = Control.FocusModeEnum.None,
                CustomMinimumSize = new Vector2(280, 0),
            };
            if (r.Short != null) b.AddThemeColorOverride("font_color", new Color("#e0a070"));
            var id = r.Id;
            b.Pressed += () => Pick(id);
            _rooms.AddChild(b);
        }
        // Above the strip, at the open category's button, once laid out.
        CallDeferred(nameof(PlacePopup));
    }

    void PlacePopup()
    {
        var button = _categories.GetChildren().OfType<Button>().FirstOrDefault(b => b.GetMeta("cat").AsString() == _open);
        if (button == null) return;
        _popup.ResetSize();
        var x = Mathf.Clamp(button.GlobalPosition.X, 10, GetViewport().GetVisibleRect().Size.X - _popup.Size.X - 10);
        _popup.Position = new Vector2(x, _strip.GlobalPosition.Y - _popup.Size.Y - 8);
    }

    /// <summary>Put a room in hand (by id), its first shape.</summary>
    public void Pick(string id)
    {
        Tool = Tool == id ? null : id;
        _shape = 0;
        if (Tool == null) Drop();
        else if (_palette.FirstOrDefault(r => r.Id == id) is Room r && r.Category != _open) OpenCategory(r.Category);
        RefreshRooms();
    }

    /// <summary>The room in hand by its key, if there's one with that key.</summary>
    public bool PickByKey(string key)
    {
        var r = _palette.FirstOrDefault(r => r.Key == key && r.Locked == null);
        if (r == null) return false;
        if (!_strip.Visible) Toggle(true);
        OpenCategory(r.Category);
        Pick(r.Id);
        return true;
    }

    public void Rotate()
    {
        var r = _palette.FirstOrDefault(r => r.Id == Tool);
        if (r != null) _shape = (_shape + 1) % r.Shapes.Length;
    }

    public bool SurfaceTool => _palette.FirstOrDefault(r => r.Id == Tool)?.Surface == true;

    object ToolJson()
    {
        var r = _palette.First(r => r.Id == Tool);
        return new Dictionary<string, object> { ["room"] = r.Id, ["shape"] = r.Shapes[_shape] };
    }

    Vector3? _lastHover;
    double _lastHoverAt;

    /// <summary>The pointer moved over this world point with a room in hand: ask what placing it there would do (a few times a second at most).</summary>
    public void Hover(Vector3 at, Vector2 screen)
    {
        if (Tool == null) return;
        _tip.Position = screen + new Vector2(18, 18);
        if (_lastHover is Vector3 last && last.DistanceTo(at) < 0.5f && _clock - _lastHoverAt < 0.5) return;
        if (_clock - _lastHoverAt < 0.06) return;
        _lastHover = at;
        _lastHoverAt = _clock;
        _send(new Dictionary<string, object> { ["type"] = "hover", ["tool"] = ToolJson(), ["at"] = new[] { at.X, at.Y, at.Z } });
    }

    public void Place(Vector3 at)
    {
        if (Tool == null) return;
        _send(new Dictionary<string, object> { ["type"] = "place", ["tool"] = ToolJson(), ["at"] = new[] { at.X, at.Y, at.Z } });
    }

    /// <summary>The bridge's answer to a hover: ok or not, the cost and a note, and the footprint.</summary>
    public void Hovered(JsonElement msg)
    {
        if (Tool == null) return;
        var ok = msg.GetProperty("ok").GetBoolean();
        var text = msg.GetProperty("text").GetString();
        var cost = msg.GetProperty("cost").GetString();
        _tip.Text = string.IsNullOrEmpty(text) ? cost : $"{cost}\n{text}";
        _tip.AddThemeColorOverride("font_color", ok ? new Color("#cfeec0") : new Color("#f3b0a0"));
        _tip.Visible = true;
        if (msg.TryGetProperty("ghost", out var g))
        {
            var f = MemoryMarshal.Cast<byte, float>(Convert.FromBase64String(g.GetString()!)).ToArray();
            var verts = new Vector3[f.Length / 3];
            for (var i = 0; i < verts.Length; i++) verts[i] = new Vector3(f[i * 3], f[i * 3 + 1], f[i * 3 + 2]);
            var arrays = new Godot.Collections.Array();
            arrays.Resize((int)Mesh.ArrayType.Max);
            arrays[(int)Mesh.ArrayType.Vertex] = verts;
            var mesh = new ArrayMesh();
            if (verts.Length > 0)
            {
                mesh.AddSurfaceFromArrays(Mesh.PrimitiveType.Triangles, arrays);
                mesh.SurfaceSetMaterial(0, ok ? _good : _bad);
            }
            _ghost.Mesh = mesh;
            _ghost.Visible = true;
        }
        else _ghost.Visible = false;
    }

    /// <summary>The bridge's notice: why a click didn't build, or a question (it would cut corridors) to confirm.</summary>
    public void Notice(JsonElement msg)
    {
        var text = msg.GetProperty("text").GetString() ?? "";
        if (msg.TryGetProperty("confirm", out var c))
        {
            _pendingConfirm = new Dictionary<string, object?>
            {
                ["type"] = "place",
                ["tool"] = JsonSerializer.Deserialize<object>(c.GetProperty("tool").GetRawText()),
                ["at"] = JsonSerializer.Deserialize<float[]>(c.GetProperty("at").GetRawText()),
                ["confirmed"] = true,
            };
            _confirm.DialogText = text;
            _confirm.PopupCentered();
            return;
        }
        Toast(text);
    }
}
