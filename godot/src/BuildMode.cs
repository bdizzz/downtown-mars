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
/// it (cycles its shapes), Esc or a right click puts it down. Access holds the corridor tool (Z): click
/// or drag along borders to carve corridors in a finish, or fit bulkheads or windows; Shift erases.
/// </summary>
public partial class BuildMode : Node3D
{
    record Room(string Id, string Name, string Category, int[][] Shapes, bool Surface, string Cost, string? Key, string? Locked, string? Short, JsonElement Card);

    readonly Action<object> _send;
    readonly PanelContainer _strip = new();
    readonly HBoxContainer _categories = new();
    readonly PanelContainer _popup = new();
    readonly GridContainer _rooms = new() { Columns = 1 };
    readonly Label _tip = new();
    readonly Label _toast = new();
    readonly ConfirmationDialog _confirm = new() { Title = "Build here?", OkButtonText = "Build", CancelButtonText = "Cancel" };
    readonly MeshInstance3D _ghost = new() { Name = "Ghost", CastShadow = GeometryInstance3D.ShadowCastingSetting.Off };
    /// <summary>The room's effect on the cells round where it would go (the web's halo), a band of cells per strength.</summary>
    readonly MeshInstance3D _halo = new() { Name = "Halo", CastShadow = GeometryInstance3D.ShadowCastingSetting.Off };
    List<(Color color, Vector3[] tris)> _haloBands = new();
    /// <summary>The room card: what the room pointed at (or in hand) costs, takes, makes and does, above the popup.</summary>
    readonly PanelContainer _card = new();
    readonly VBoxContainer _cardRows = new();
    string? _pointed;
    readonly StandardMaterial3D _good = Ghost(new Color(0.45f, 0.95f, 0.5f, 0.35f)), _bad = Ghost(new Color(1f, 0.35f, 0.3f, 0.35f));
    List<Room> _palette = new();
    List<(string id, string name)> _cats = new();
    string? _open;
    double _toastUntil, _clock;
    object? _pendingConfirm;

    /// <summary>The room in hand and its shape, or null.</summary>
    public string? Tool { get; private set; }

    // The corridor tool (Access): a finish to draw in, or bulkheads, or windows; erasing with Erase or Shift.
    List<(string id, string name, string cost, string hint)> _finishes = new();
    string _bulkheadCost = "", _windowsCost = "";
    /// <summary>The corridor tool's finish while it's in hand, or null.</summary>
    public string? Corridor { get; private set; }
    bool _bulkhead, _windows, _erase;
    /// <summary>Shift held: the corridor tool erases.</summary>
    public bool ShiftErase { get; set; }
    public bool HasTool => Tool != null || Corridor != null;
    /// <summary>Dragging paints corridors (not for bulkheads or windows, which go one wall at a time).</summary>
    public bool Painting => Corridor != null && !_bulkhead && !_windows;
    int _shape;
    public bool Active => _strip.Visible;
    /// <summary>The ghost (or corridor strip) as last hovered: world-space triangles, and whether it can go there (for the plan view).</summary>
    public (Vector3[] tris, bool ok) GhostShape => _ghost.Visible && HasTool ? (_ghostVerts, _ghostOk) : (Array.Empty<Vector3>(), false);
    Vector3[] _ghostVerts = Array.Empty<Vector3>();
    bool _ghostOk;

    public BuildMode(CanvasLayer hud, Action<object> send)
    {
        _send = send;
        AddChild(_ghost);
        _ghost.Visible = false;
        AddChild(_halo);

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

        _card.AddThemeStyleboxOverride("panel", Live.Panel());
        _card.Visible = false;
        _card.MouseFilter = Control.MouseFilterEnum.Ignore;
        _cardRows.AddThemeConstantOverride("separation", 3);
        _card.AddChild(_cardRows);
        hud.AddChild(_card);

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
        Corridor = null;
        _ghost.Visible = false;
        ClearHalo();
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
            r.TryGetProperty("short", out var s2) ? s2.GetString() : null,
            r.GetProperty("card").Clone())).ToList();
        var cor = msg.GetProperty("corridors");
        _finishes = cor.GetProperty("finishes").EnumerateArray().Select(f => (f.GetProperty("id").GetString()!, f.GetProperty("name").GetString()!, f.GetProperty("cost").GetString()!, f.GetProperty("hint").GetString()!)).ToList();
        _bulkheadCost = cor.GetProperty("bulkhead").GetString()!;
        _windowsCost = cor.GetProperty("windows").GetString()!;
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
        // Access starts with the corridor tool: its finishes, bulkheads, windows, and Erase.
        var tools = _open == "circulation" ? _finishes.Count + 3 : 0;
        // Long lists in two columns, so they don't run off the top.
        _rooms.Columns = list.Count + tools > 8 ? 2 : 1;
        if (_open == "circulation")
        {
            Button ToolButton(string text, string tip, bool on, Action pressed)
            {
                var b = new Button { Text = text, TooltipText = tip, Alignment = HorizontalAlignment.Left, ToggleMode = true, ButtonPressed = on, FocusMode = Control.FocusModeEnum.None, CustomMinimumSize = new Vector2(280, 0) };
                b.Pressed += pressed;
                _rooms.AddChild(b);
                return b;
            }
            foreach (var f in _finishes)
            {
                var id = f.id;
                ToolButton($"Corridor: {f.name} [Z]  ·  {f.cost}", f.hint + ". Click or drag along the borders between cells; Shift erases.", Corridor == id && !_bulkhead && !_windows, () => PickCorridor(id, false, false));
            }
            ToolButton($"Bulkhead  ·  {_bulkheadCost}", "Click a built corridor to seal it: people pass, air and smell don't. Shift-click takes one out.", Corridor != null && _bulkhead, () => PickCorridor(Corridor ?? _finishes.FirstOrDefault().id ?? "rock", true, false));
            ToolButton($"Windows  ·  {_windowsCost}", "Click a room's wall where it faces the shaft, a corridor or a walk-through room: glazes the wall. Shift-click takes them out.", Corridor != null && _windows, () => PickCorridor(Corridor ?? _finishes.FirstOrDefault().id ?? "rock", false, true));
            ToolButton("Erase (or hold Shift)", "Fill corridors in (it costs as much as carving them), or take out bulkheads and windows.", _erase, () =>
            {
                _erase = !_erase;
                RefreshRooms();
            });
        }
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
            b.MouseEntered += () => Point(id);
            b.MouseExited += () => Point(null);
            _rooms.AddChild(b);
        }
        // Above the strip, at the open category's button, once laid out.
        CallDeferred(nameof(PlacePopup));
        ShowCard();
    }

    // ---- the room card ----

    void Point(string? id)
    {
        _pointed = id;
        ShowCard();
    }

    static readonly Dictionary<string, Color> Tones = new() { ["k"] = new Color("#a8927e"), ["good"] = new Color("#9fd28a"), ["bad"] = new Color("#f08070") };

    /// <summary>The card for the room pointed at in the popup, else the one in hand; above the popup, as the web's.</summary>
    void ShowCard()
    {
        var room = _palette.FirstOrDefault(r => r.Id == (_pointed ?? Tool));
        _card.Visible = room != null && _popup.Visible;
        if (room == null || !_card.Visible) return;
        foreach (var c in _cardRows.GetChildren())
        {
            _cardRows.RemoveChild(c);
            c.QueueFree();
        }
        Label Line(string text, int size, Color color)
        {
            var l = new Label { Text = text, AutowrapMode = TextServer.AutowrapMode.WordSmart, CustomMinimumSize = new Vector2(320, 0) };
            l.AddThemeFontSizeOverride("font_size", size);
            l.AddThemeColorOverride("font_color", color);
            _cardRows.AddChild(l);
            return l;
        }
        var card = room.Card;
        Line(card.GetProperty("name").GetString()!, 17, new Color("#e8834a"));
        var shape = room.Shapes[Tool == room.Id ? _shape : 0];
        var size = card.GetProperty("size").GetString() + (card.GetProperty("surface").GetBoolean() ? "" : $" · {shape[0]} wide × {shape[1]} deep");
        Line(room.Shapes.Length > 1 && Tool == room.Id ? size + "  ·  R turns it" : size, 13, Tones["k"]);
        // The cost, what the stocks are short of in red.
        var cost = new RichTextLabel { BbcodeEnabled = true, FitContent = true, ScrollActive = false, AutowrapMode = TextServer.AutowrapMode.WordSmart, CustomMinimumSize = new Vector2(320, 0), MouseFilter = Control.MouseFilterEnum.Ignore };
        cost.AddThemeFontSizeOverride("normal_font_size", 14);
        cost.Text = string.Join("   ", card.GetProperty("cost").EnumerateArray().Select(c => c.GetProperty("short").GetBoolean() ? $"[color=#f08070]{c.GetProperty("text").GetString()}[/color]" : $"[color=#f3e6d8]{c.GetProperty("text").GetString()}[/color]"));
        _cardRows.AddChild(cost);
        foreach (var l in card.GetProperty("lines").EnumerateArray())
            Line(l.GetProperty("text").GetString()!, 13, l.TryGetProperty("tone", out var t) && Tones.TryGetValue(t.GetString()!, out var c) ? c : new Color("#e0cfbd"));
        CallDeferred(nameof(PlaceCard));
    }

    void PlaceCard()
    {
        if (!_card.Visible) return;
        _card.ResetSize();
        var x = Mathf.Clamp(_popup.Position.X, 10, GetViewport().GetVisibleRect().Size.X - _card.Size.X - 10);
        _card.Position = new Vector2(x, Mathf.Max(10, _popup.Position.Y - _card.Size.Y - 8));
    }

    // ---- the halo ----

    void ClearHalo()
    {
        _halo.Visible = false;
        _haloBands = new();
    }

    /// <summary>The room's effects round where it would go, for the plan view: a colour (with its opacity) and triangles per band.</summary>
    public List<(Color color, Vector3[] tris)> Halo => _halo.Visible && Tool != null ? _haloBands : NoHalo;
    static readonly List<(Color color, Vector3[] tris)> NoHalo = new();

    void ShowHalo(JsonElement msg)
    {
        if (!msg.TryGetProperty("halo", out var bands))
        {
            ClearHalo();
            return;
        }
        var mesh = new ArrayMesh();
        _haloBands = new();
        foreach (var band in bands.EnumerateArray())
        {
            var color = new Color(band.GetProperty("color").GetString()!) with { A = band.GetProperty("alpha").GetSingle() };
            var verts = Verts(band.GetProperty("tris").GetString()!);
            if (verts.Length == 0) continue;
            _haloBands.Add((color, verts));
            var arrays = new Godot.Collections.Array();
            arrays.Resize((int)Mesh.ArrayType.Max);
            arrays[(int)Mesh.ArrayType.Vertex] = verts;
            mesh.AddSurfaceFromArrays(Mesh.PrimitiveType.Triangles, arrays);
            var m = Ghost(color);
            m.RenderPriority = 4;
            mesh.SurfaceSetMaterial(mesh.GetSurfaceCount() - 1, m);
        }
        _halo.Mesh = mesh;
        _halo.Visible = true;
    }

    static Vector3[] Verts(string b64)
    {
        var f = MemoryMarshal.Cast<byte, float>(Convert.FromBase64String(b64)).ToArray();
        var verts = new Vector3[f.Length / 3];
        for (var i = 0; i < verts.Length; i++) verts[i] = new Vector3(f[i * 3], f[i * 3 + 1], f[i * 3 + 2]);
        return verts;
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
    /// <summary>The corridor tool in hand: drawing in a finish, or fitting bulkheads, or windows. Again to put it down.</summary>
    public void PickCorridor(string finish, bool bulkhead, bool windows)
    {
        var same = Corridor == finish && _bulkhead == bulkhead && _windows == windows;
        Tool = null;
        Corridor = same ? null : finish;
        _bulkhead = bulkhead;
        _windows = windows;
        if (Corridor == null) Drop();
        else if (_open != "circulation") OpenCategory("circulation");
        RefreshRooms();
    }

    object CorridorJson() => new Dictionary<string, object> { ["finish"] = Corridor!, ["erase"] = _erase || ShiftErase, ["bulkhead"] = _bulkhead, ["windows"] = _windows };

    Vector3? _lastPaint;

    /// <summary>Dragging with the corridor tool: draw (or erase) along each border crossed.</summary>
    public void Paint(Vector3 at)
    {
        if (!Painting || (_lastPaint is Vector3 last && last.DistanceTo(at) < 0.6f)) return;
        _lastPaint = at;
        _send(new Dictionary<string, object> { ["type"] = "edge", ["tool"] = CorridorJson(), ["at"] = new[] { at.X, at.Y, at.Z }, ["painting"] = true });
    }

    public void EndPaint() => _lastPaint = null;

    public void Pick(string id)
    {
        // Not a room in the palette (none yet, or not buildable).
        if (_palette.All(r => r.Id != id)) return;
        Corridor = null;
        Tool = Tool == id ? null : id;
        _shape = 0;
        if (Tool == null) Drop();
        else if (_palette.FirstOrDefault(r => r.Id == id) is Room r && r.Category != _open) OpenCategory(r.Category);
        RefreshRooms();
    }

    /// <summary>The room in hand by its key, if there's one with that key.</summary>
    public bool PickByKey(string key)
    {
        if (key == "Z" && _finishes.Count > 0)
        {
            if (!_strip.Visible) Toggle(true);
            PickCorridor(Corridor ?? _finishes[0].id, false, false);
            return true;
        }
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
        ShowCard();
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
        if (!HasTool) return;
        _tip.Position = screen + new Vector2(18, 18);
        if (_lastHover is Vector3 last && last.DistanceTo(at) < 0.5f && _clock - _lastHoverAt < 0.5) return;
        if (_clock - _lastHoverAt < 0.06) return;
        _lastHover = at;
        _lastHoverAt = _clock;
        if (Corridor != null) _send(new Dictionary<string, object> { ["type"] = "edgeHover", ["tool"] = CorridorJson(), ["at"] = new[] { at.X, at.Y, at.Z } });
        else _send(new Dictionary<string, object> { ["type"] = "hover", ["tool"] = ToolJson(), ["at"] = new[] { at.X, at.Y, at.Z } });
    }

    public void Place(Vector3 at)
    {
        if (Corridor != null)
        {
            _send(new Dictionary<string, object> { ["type"] = "edge", ["tool"] = CorridorJson(), ["at"] = new[] { at.X, at.Y, at.Z } });
            return;
        }
        if (Tool == null) return;
        _send(new Dictionary<string, object> { ["type"] = "place", ["tool"] = ToolJson(), ["at"] = new[] { at.X, at.Y, at.Z } });
    }

    /// <summary>The bridge's answer to a hover: ok or not, the cost and a note, and the footprint.</summary>
    public void Hovered(JsonElement msg)
    {
        if (!HasTool) return;
        var ok = msg.GetProperty("ok").GetBoolean();
        var text = msg.GetProperty("text").GetString();
        var cost = msg.GetProperty("cost").GetString();
        _tip.Text = string.IsNullOrEmpty(text) ? cost : $"{cost}\n{text}";
        _tip.AddThemeColorOverride("font_color", ok ? new Color("#cfeec0") : new Color("#f3b0a0"));
        _tip.Visible = true;
        if (msg.TryGetProperty("ghost", out var g) || msg.TryGetProperty("strip", out g))
        {
            var f = MemoryMarshal.Cast<byte, float>(Convert.FromBase64String(g.GetString()!)).ToArray();
            var verts = new Vector3[f.Length / 3];
            for (var i = 0; i < verts.Length; i++) verts[i] = new Vector3(f[i * 3], f[i * 3 + 1], f[i * 3 + 2]);
            _ghostVerts = verts;
            _ghostOk = ok;
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
        ShowHalo(msg);
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
