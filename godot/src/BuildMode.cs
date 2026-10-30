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
/// a border, or drag a chain along borders and confirm it, to carve corridors in a finish (or fit
/// bulkheads or windows); Shift erases. Demolish (X) takes down the room clicked; Undo (⌘Z) takes back
/// the last room placed.
/// </summary>
public partial class BuildMode : Node3D
{
    record Room(string Id, string Name, string Category, int[][] Shapes, bool Surface, string Cost, string? Key, string? Locked, string? Short, JsonElement Card, bool Lineable, JsonElement? InLining);

    readonly Action<object> _send;
    readonly PanelContainer _strip = new();
    /// <summary>The strip's buttons, categories first: one row while it fits the window, wrapping when it doesn't (#224).</summary>
    readonly HFlowContainer _row = new();
    readonly List<Button> _categories = new();
    readonly PanelContainer _popup = new();
    /// <summary>The popup: tools that take a whole row (the corridor tool's, the building material), then the rooms as tiles.</summary>
    readonly VBoxContainer _tools = new();
    readonly GridContainer _rooms = new() { Columns = 1 };
    readonly Label _tip = new();
    readonly Label _toast = new();
    readonly ConfirmationDialog _confirm = new() { Title = "Build here?", OkButtonText = "Build", CancelButtonText = "Cancel" };
    readonly Button _demolishButton = new() { Text = "Demolish [X]", ToggleMode = true, FocusMode = Control.FocusModeEnum.None, TooltipText = "Demolish a room (half its cost back)" };
    readonly Button _undoButton = new() { Text = "Undo ⌘Z", Disabled = true, FocusMode = Control.FocusModeEnum.None, TooltipText = "Undo your last placement for a full refund, within a few game hours" };
    /// <summary>A snaked chain of corridors to confirm: carve (or fill in) it all, or not.</summary>
    readonly ConfirmationDialog _propose = new() { Title = "Corridors", CancelButtonText = "Cancel" };
    /// <summary>The chain being snaked out (or waiting on the confirm): its borders, by colour.</summary>
    readonly MeshInstance3D _chain = new() { Name = "Chain", CastShadow = GeometryInstance3D.ShadowCastingSetting.Off };
    List<(Color color, Vector3[] tris)> _chainBands = new();
    readonly MeshInstance3D _ghost = new() { Name = "Ghost", CastShadow = GeometryInstance3D.ShadowCastingSetting.Off };
    /// <summary>The room's effect on the cells round where it would go (the web's halo), a band of cells per strength.</summary>
    readonly MeshInstance3D _halo = new() { Name = "Halo", CastShadow = GeometryInstance3D.ShadowCastingSetting.Off };
    List<(Color color, Vector3[] tris)> _haloBands = new();
    /// <summary>The room card: what the room pointed at (or in hand) costs, takes, makes and does, above the popup.</summary>
    readonly PanelContainer _card = new();
    readonly VBoxContainer _cardRows = new();
    string? _pointed;
    readonly StandardMaterial3D _good = Ghost(new Color(0.45f, 0.95f, 0.5f, 0.35f)), _bad = Ghost(new Color(1f, 0.35f, 0.3f, 0.35f));
    /// <summary>A surface room in hand: every spot it could go, tinted faintly on the ground, and the one pointed at, stronger (T-107).</summary>
    readonly MeshInstance3D _spots = new() { Name = "Spots", CastShadow = GeometryInstance3D.ShadowCastingSetting.Off };
    readonly MeshInstance3D _spot = new() { Name = "Spot", CastShadow = GeometryInstance3D.ShadowCastingSetting.Off };
    readonly StandardMaterial3D _spotsFaint = Spot(0.12f), _spotHover = Spot(0.3f);
    List<Room> _palette = new();
    List<(string id, string name, Color color)> _cats = new();
    string? _open;
    double _toastUntil, _clock;
    object? _pendingConfirm;

    /// <summary>The room in hand and its shape, or null.</summary>
    public string? Tool { get; private set; }

    // The corridor tool (Access): a finish to draw in, or bulkheads, or windows; erasing with Erase or Shift.
    List<(string id, string name, string cost, string hint)> _finishes = new();
    string _bulkheadCost = "", _windowsCost = "";
    // The building material (T-038): the lining rooms are built in, bare rock each time Build opens.
    List<(string id, string name, string cost, string hint)> _linings = new();
    const string BareRock = "rock";
    string _lining = BareRock;
    /// <summary>The corridor tool's finish while it's in hand, or null.</summary>
    public string? Corridor { get; private set; }
    bool _bulkhead, _windows, _erase;
    /// <summary>Shift held: the corridor tool erases.</summary>
    public bool ShiftErase { get; set; }
    public bool HasTool => Tool != null || Corridor != null || Demolishing;
    /// <summary>The demolish tool (X): a click takes the room under the pointer down.</summary>
    public bool Demolishing { get; private set; }
    public Action? UndoPressed { get; set; }
    public bool CanUndo { set => _undoButton.Disabled = !value; }
    /// <summary>Dragging paints corridors (not for bulkheads or windows, which go one wall at a time).</summary>
    public bool Painting => Corridor != null && !_bulkhead && !_windows;
    int _shape;
    public bool Active => _strip.Visible;
    /// <summary>Where the strip's top edge is now, in the window, for what sits above it (the news).</summary>
    public float StripTop => _strip.Position.Y;
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
        AddChild(_chain);
        AddChild(_spots);
        AddChild(_spot);

        _strip.AddThemeStyleboxOverride("panel", Live.Panel());
        // Centred on the bottom edge, its width set by FitStrip: as wide as its buttons, or the window.
        _strip.SetAnchorsPreset(Control.LayoutPreset.CenterBottom);
        _strip.GrowHorizontal = Control.GrowDirection.Both;
        _strip.GrowVertical = Control.GrowDirection.Begin;
        _strip.OffsetBottom = _strip.OffsetTop = StripBottom;
        _strip.Visible = false;
        hud.AddChild(_strip);
        _row.AddThemeConstantOverride("h_separation", 6);
        _row.AddThemeConstantOverride("v_separation", 4);
        _strip.AddChild(_row);
        _row.AddChild(new VSeparator());
        _demolishButton.Pressed += ToggleDemolish;
        _demolishButton.AddThemeColorOverride("font_color", new Color("#f0a090"));
        _row.AddChild(_demolishButton);
        _undoButton.Pressed += () => UndoPressed?.Invoke();
        _row.AddChild(_undoButton);
        var hint = new Label { Text = "R rotates · Esc or right-click cancels", VerticalAlignment = VerticalAlignment.Center };
        Style(hint, 12, new Color("#a8927e"));
        _row.AddChild(hint);

        _popup.AddThemeStyleboxOverride("panel", Live.Panel());
        _popup.Visible = false;
        hud.AddChild(_popup);
        var popupRows = new VBoxContainer();
        popupRows.AddThemeConstantOverride("separation", 6);
        _popup.AddChild(popupRows);
        popupRows.AddChild(_tools);
        _rooms.AddThemeConstantOverride("h_separation", 4);
        _rooms.AddThemeConstantOverride("v_separation", 4);
        popupRows.AddChild(_rooms);

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
        _toast.Position = new Vector2(0, ToastTop);
        _toast.Visible = false;
        hud.AddChild(_toast);

        _confirm.Confirmed += () =>
        {
            if (_pendingConfirm is Dictionary<string, object?> place) _send(place);
            _pendingConfirm = null;
        };
        hud.AddChild(_confirm);
        _propose.Confirmed += () => _send(new Dictionary<string, object> { ["type"] = "proposalAnswer", ["accept"] = true });
        _propose.Canceled += () => _send(new Dictionary<string, object> { ["type"] = "proposalAnswer", ["accept"] = false });
        hud.AddChild(_propose);
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

    /// <summary>A surface spot's tint: as the ghost's green, but on the ground, so buildings and boulders stand over it.</summary>
    static StandardMaterial3D Spot(float alpha) => new()
    {
        ShadingMode = BaseMaterial3D.ShadingModeEnum.Unshaded,
        AlbedoColor = new Color(0.5f, 0.84f, 0.5f, alpha),
        Transparency = BaseMaterial3D.TransparencyEnum.Alpha,
        CullMode = BaseMaterial3D.CullModeEnum.Disabled,
        RenderPriority = 4,
    };

    /// <summary>Triangles from the bridge (float32 xyz, base64) as a mesh in one material; empty when there are none.</summary>
    static ArrayMesh TriMesh(string b64, Material m)
    {
        var f = MemoryMarshal.Cast<byte, float>(Convert.FromBase64String(b64)).ToArray();
        var verts = new Vector3[f.Length / 3];
        for (var i = 0; i < verts.Length; i++) verts[i] = new Vector3(f[i * 3], f[i * 3 + 1], f[i * 3 + 2]);
        var mesh = new ArrayMesh();
        if (verts.Length == 0) return mesh;
        var arrays = new Godot.Collections.Array();
        arrays.Resize((int)Mesh.ArrayType.Max);
        arrays[(int)Mesh.ArrayType.Vertex] = verts;
        mesh.AddSurfaceFromArrays(Mesh.PrimitiveType.Triangles, arrays);
        mesh.SurfaceSetMaterial(0, m);
        return mesh;
    }

    /// <summary>The bridge's answer to picking a room: where it could go on the surface (nothing for a room inside the hole).</summary>
    public void Spots(JsonElement msg)
    {
        _spots.Mesh = TriMesh(msg.GetProperty("tris").GetString() ?? "", _spotsFaint);
        _spots.Visible = SurfaceTool;
    }

    static void Style(Label l, int size, Color color)
    {
        l.AddThemeFontSizeOverride("font_size", size);
        l.AddThemeColorOverride("font_color", color);
    }

    public override void _Ready() => GetViewport().SizeChanged += FitStrip;

    /// <summary>The strip's bottom edge, up from the window's, clear of the status lines.</summary>
    const float StripBottom = -58;
    float _stripBottom = StripBottom;

    /// <summary>Keep the strip's bottom edge just above this window height (the status lines' top, however many they wrap to).</summary>
    public void KeepAbove(float y)
    {
        var bottom = y - 6 - GetViewport().GetVisibleRect().Size.Y;
        if (Mathf.Abs(bottom - _stripBottom) < 0.5f) return;
        _stripBottom = bottom;
        _strip.OffsetTop = _strip.OffsetBottom = bottom;
    }
    /// <summary>Room tiles: about square, a few to a row (#224).</summary>
    static readonly Vector2 TileSize = new(112, 62);
    const int MostColumns = 6;

    /// <summary>
    /// Size the strip to the window: one row as wide as its buttons when that fits, else as wide as the
    /// window allows, its buttons wrapping onto more rows, centred on the bottom edge either way.
    /// </summary>
    void FitStrip()
    {
        if (!IsInsideTree()) return;
        var room = GetViewport().GetVisibleRect().Size.X - 24;
        var gap = _row.GetThemeConstant("h_separation");
        var shown = _row.GetChildren().OfType<Control>().Where(c => c.Visible).ToList();
        var oneRow = shown.Sum(c => c.GetCombinedMinimumSize().X) + gap * Math.Max(0, shown.Count - 1);
        var margins = _strip.GetThemeStylebox("panel") is StyleBox sb ? sb.GetMinimumSize().X : 0;
        var w = Mathf.Min(oneRow + margins, room);
        _strip.OffsetLeft = -w / 2;
        _strip.OffsetRight = w / 2;
        // Let it grow upward to however many rows the flow needs at that width.
        _strip.OffsetTop = _strip.OffsetBottom = _stripBottom;
        if (_popup.Visible) CallDeferred(nameof(RefreshRooms));
    }

    public override void _Process(double delta)
    {
        _clock += delta;
        if (_toast.Visible && _clock > _toastUntil) _toast.Visible = false;
        // The toast and the room popup above the strip, however many rows it wraps to (growing to fit
        // moves its rect, not its offsets, so they go by where it actually is).
        if (_toast.Visible)
        {
            var y = _strip.Visible ? _strip.Position.Y - 10 - _toast.Size.Y : GetViewport().GetVisibleRect().Size.Y + ToastTop;
            if (!Mathf.IsEqualApprox(_toast.Position.Y, y)) _toast.Position = _toast.Position with { Y = y };
        }
        if (_popup.Visible)
        {
            var y = _strip.Position.Y - _popup.Size.Y - 8;
            if (!Mathf.IsEqualApprox(_popup.Position.Y, y))
            {
                _popup.Position = _popup.Position with { Y = y };
                PlaceCard();
            }
        }
    }

    /// <summary>A toast's top, up from the window's bottom edge, with the strip shut.</summary>
    const float ToastTop = -150;

    public void Toast(string text)
    {
        _toast.Text = text;
        _toast.Visible = true;
        _toastUntil = _clock + 3.5;
    }

    /// <summary>Open or close the strip (closing puts down whatever's in hand).</summary>
    public void Toggle(bool? on = null)
    {
        var was = _strip.Visible;
        _strip.Visible = on ?? !_strip.Visible;
        if (_strip.Visible && !was)
        {
            _lining = BareRock;
            FitStrip();
        }
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
        Demolishing = false;
        _demolishButton.ButtonPressed = false;
        _ghost.Visible = false;
        _spots.Visible = _spot.Visible = false;
        ClearHalo();
        _tip.Visible = false;
        RefreshRooms();
    }

    /// <summary>The bridge's palette: categories, and each buildable room with its shapes, cost and whether it's locked or unaffordable.</summary>
    public void SetPalette(JsonElement msg)
    {
        _cats = msg.GetProperty("categories").EnumerateArray().Select(c => (
            c.GetProperty("id").GetString()!,
            c.GetProperty("name").GetString()!,
            c.TryGetProperty("color", out var cc) ? new Color(cc.GetString()!) : new Color("#888888"))).ToList();
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
            r.GetProperty("card").Clone(),
            r.TryGetProperty("lineable", out var ln) && ln.GetBoolean(),
            r.TryGetProperty("inLining", out var il) ? il.Clone() : null)).ToList();
        _linings = msg.TryGetProperty("linings", out var lns)
            ? lns.EnumerateArray().Select(f => (f.GetProperty("id").GetString()!, f.GetProperty("name").GetString()!, f.GetProperty("cost").GetString()!, f.GetProperty("hint").GetString()!)).ToList()
            : new();
        var cor = msg.GetProperty("corridors");
        _finishes = cor.GetProperty("finishes").EnumerateArray().Select(f => (f.GetProperty("id").GetString()!, f.GetProperty("name").GetString()!, f.GetProperty("cost").GetString()!, f.GetProperty("hint").GetString()!)).ToList();
        _bulkheadCost = cor.GetProperty("bulkhead").GetString()!;
        _windowsCost = cor.GetProperty("windows").GetString()!;
        foreach (var c in _categories)
        {
            _row.RemoveChild(c);
            c.QueueFree();
        }
        _categories.Clear();
        foreach (var (id, name, color) in _cats)
        {
            // A swatch of the category's colour before its name, as the web's.
            var b = new Button { Text = name, ToggleMode = true, FocusMode = Control.FocusModeEnum.None, Icon = Swatch(color, 9) };
            var cat = id;
            b.Pressed += () => OpenCategory(_open == cat ? null : cat);
            b.SetMeta("cat", id);
            _row.AddChild(b);
            _row.MoveChild(b, _categories.Count);
            _categories.Add(b);
        }
        FitStrip();
        RefreshRooms();
    }

    static readonly Dictionary<(Color, int), Texture2D> Swatches = new();
    /// <summary>A small rounded square of a category's colour, for its buttons.</summary>
    static Texture2D Swatch(Color color, int size)
    {
        if (Swatches.TryGetValue((color, size), out var t)) return t;
        var img = Image.CreateEmpty(size, size, false, Image.Format.Rgba8);
        img.Fill(color);
        // Round the corners off a little.
        foreach (var (x, y) in new[] { (0, 0), (size - 1, 0), (0, size - 1), (size - 1, size - 1) }) img.SetPixel(x, y, Colors.Transparent);
        return Swatches[(color, size)] = ImageTexture.CreateFromImage(img);
    }

    /// <summary>A room tile's look: a rounded fill, framed in the accent when it's the room in hand.</summary>
    static StyleBoxFlat Tile(Color fill, Color frame) => new()
    {
        BgColor = fill,
        BorderColor = frame,
        BorderWidthLeft = 2, BorderWidthRight = 2, BorderWidthTop = 2, BorderWidthBottom = 2,
        CornerRadiusTopLeft = 6, CornerRadiusTopRight = 6, CornerRadiusBottomLeft = 6, CornerRadiusBottomRight = 6,
        ContentMarginLeft = 6, ContentMarginRight = 6, ContentMarginTop = 8, ContentMarginBottom = 6,
    };

    /// <summary>The colour of a room's category.</summary>
    Color CategoryColor(string cat) => _cats.FirstOrDefault(c => c.id == cat).color is var c && c != default ? c : new Color("#888888");

    void OpenCategory(string? cat)
    {
        _open = cat;
        foreach (var b in _categories) b.ButtonPressed = b.GetMeta("cat").AsString() == cat;
        RefreshRooms();
    }

    void RefreshRooms()
    {
        // Out at once (not at the end of the frame), so the popup sizes to the new list.
        foreach (var c in _rooms.GetChildren().Concat(_tools.GetChildren()))
        {
            c.GetParent().RemoveChild(c);
            c.QueueFree();
        }
        _popup.Visible = _open != null && _strip.Visible;
        if (!_popup.Visible) return;
        var list = _palette.Where(r => r.Category == _open).ToList();
        // Access starts with the corridor tool: its finishes, bulkheads, windows, and Erase.
        // Other groups start with the building material.
        // The rooms as tiles, as many to a row as fit the window (up to a few), so long lists stay low.
        var fit = (int)((GetViewport().GetVisibleRect().Size.X - 60 - CardRoom) / (TileSize.X + 4));
        _rooms.Columns = Math.Max(1, Math.Min(Math.Min(MostColumns, fit), list.Count));
        _rooms.Visible = list.Count > 0;
        if (_open == "circulation")
        {
            Button ToolButton(string text, string tip, bool on, Action pressed)
            {
                var b = new Button { Text = text, TooltipText = tip, Alignment = HorizontalAlignment.Left, ToggleMode = true, ButtonPressed = on, FocusMode = Control.FocusModeEnum.None, CustomMinimumSize = new Vector2(280, 0) };
                b.Pressed += pressed;
                _tools.AddChild(b);
                return b;
            }
            foreach (var f in _finishes)
            {
                var id = f.id;
                ToolButton($"Corridor: {f.name} [Z]  ·  {f.cost}", f.hint + ". Click or drag along the borders between cells; Shift erases.", Corridor == id && !_bulkhead && !_windows, () => PickCorridor(id, false, false)).SetMeta("highlight", "tool:corridors");
            }
            ToolButton($"Bulkhead  ·  {_bulkheadCost}", "Click a built corridor to seal it: people pass, air and smell don't. Shift-click takes one out.", Corridor != null && _bulkhead, () => PickCorridor(Corridor ?? _finishes.FirstOrDefault().id ?? "rock", true, false));
            ToolButton($"Windows  ·  {_windowsCost}", "Click a room's wall where it faces the shaft, a corridor or a walk-through room: glazes the wall. Shift-click takes them out.", Corridor != null && _windows, () => PickCorridor(Corridor ?? _finishes.FirstOrDefault().id ?? "rock", false, true));
            ToolButton("Erase (or hold Shift)", "Fill corridors in (it costs as much as carving them), or take out bulkheads and windows.", _erase, () =>
            {
                _erase = !_erase;
                RefreshRooms();
            });
        }
        else if (_linings.Count > 0)
        {
            // The building material: bare rock, or a lining paid on top that goes in with the room, in its own build time.
            var held = _palette.FirstOrDefault(r => r.Id == Tool);
            var pick = new OptionButton { FocusMode = Control.FocusModeEnum.None, CustomMinimumSize = new Vector2(280, 0), Disabled = held != null && !held.Lineable };
            pick.TooltipText = held != null && !held.Lineable ? $"{held.Name} can't be lined: built in bare rock" : "The material rooms are built in: its cost goes on top of the room's, with no extra build time";
            for (var i = 0; i < _linings.Count; i++)
            {
                var (_, name, _, hint) = _linings[i];
                pick.AddItem($"Built in: {name}", i);
                pick.SetItemTooltip(i, hint);
            }
            pick.Selected = Math.Max(0, _linings.FindIndex(l => l.id == _lining));
            pick.ItemSelected += i =>
            {
                _lining = _linings[(int)i].id;
                _lastHover = null; // re-ask what placing it costs now
                CallDeferred(nameof(RefreshRooms)); // the rooms' costs, now in this lining
            };
            _tools.AddChild(pick);
        }
        _tools.Visible = _tools.GetChildCount() > 0;
        foreach (var r in list)
        {
            var lined = Lined(r);
            var shortOf = lined is JsonElement li ? (li.TryGetProperty("short", out var sh) ? sh.GetString() : null) : r.Short;
            var why = r.Locked ?? shortOf;
            var cost = lined is JsonElement lc ? lc.GetProperty("cost").GetString() : r.Cost;
            // A tile: the category's swatch over the name (wrapped) and its key; the cost and the rest on the card.
            var b = new Button
            {
                Text = r.Key != null ? $"{r.Name}\n[{r.Key}]" : r.Name,
                TooltipText = string.Join("\n", new[] { cost, why }.Where(s => !string.IsNullOrEmpty(s))),
                Icon = Swatch(CategoryColor(r.Category), 10),
                IconAlignment = HorizontalAlignment.Center,
                VerticalIconAlignment = VerticalAlignment.Top,
                Alignment = HorizontalAlignment.Center,
                AutowrapMode = TextServer.AutowrapMode.WordSmart,
                ToggleMode = true,
                ButtonPressed = Tool == r.Id,
                Disabled = r.Locked != null,
                FocusMode = Control.FocusModeEnum.None,
                CustomMinimumSize = TileSize,
                SizeFlagsHorizontal = Control.SizeFlags.Fill,
            };
            b.AddThemeFontSizeOverride("font_size", 13);
            b.AddThemeStyleboxOverride("normal", Tile(new Color(0.18f, 0.11f, 0.09f), new Color(0, 0, 0, 0)));
            b.AddThemeStyleboxOverride("hover", Tile(new Color(0.23f, 0.14f, 0.11f), new Color(0, 0, 0, 0)));
            b.AddThemeStyleboxOverride("pressed", Tile(new Color(0.23f, 0.14f, 0.11f), new Color("#e8834a")));
            b.AddThemeStyleboxOverride("hover_pressed", Tile(new Color(0.27f, 0.16f, 0.12f), new Color("#e8834a")));
            b.AddThemeStyleboxOverride("disabled", Tile(new Color(0.14f, 0.09f, 0.08f), new Color(0, 0, 0, 0)));
            if (shortOf != null) b.AddThemeColorOverride("font_color", new Color("#e0a070"));
            var id = r.Id;
            b.SetMeta("highlight", "room:" + id);
            b.Pressed += () => Pick(id);
            b.MouseEntered += () => Point(id);
            b.MouseExited += () => Point(null);
            _rooms.AddChild(b);
        }
        // Above the strip, at the open category's button, once laid out.
        CallDeferred(nameof(PlacePopup));
        ShowCard();
    }

    /// <summary>The room built in the lining picked (one cost for the lot), or null for bare rock or a room that can't be lined.</summary>
    JsonElement? Lined(Room r) => _lining != BareRock && r.InLining is JsonElement il && il.TryGetProperty(_lining, out var v) ? v : null;

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
        var costs = Lined(room) is JsonElement lined ? lined.GetProperty("cardCost") : card.GetProperty("cost");
        cost.Text = string.Join("   ", costs.EnumerateArray().Select(c => c.GetProperty("short").GetBoolean() ? $"[color=#f08070]{c.GetProperty("text").GetString()}[/color]" : $"[color=#f3e6d8]{c.GetProperty("text").GetString()}[/color]"));
        _cardRows.AddChild(cost);
        foreach (var l in card.GetProperty("lines").EnumerateArray())
            Line(l.GetProperty("text").GetString()!, 13, l.TryGetProperty("tone", out var t) && Tones.TryGetValue(t.GetString()!, out var c) ? c : new Color("#e0cfbd"));
        CallDeferred(nameof(PlaceCard));
    }

    void PlaceCard()
    {
        if (!_card.Visible) return;
        _card.ResetSize();
        var view = GetViewport().GetVisibleRect().Size;
        var above = _popup.Position.Y - _card.Size.Y - 8;
        if (above >= 10)
        {
            var x = Mathf.Clamp(_popup.Position.X, 10, view.X - _card.Size.X - 10);
            _card.Position = new Vector2(x, above);
            return;
        }
        // No room above in a short window: beside the popup, on whichever side has more room, its foot level with the popup's.
        var right = view.X - (_popup.Position.X + _popup.Size.X);
        var bx = right >= _popup.Position.X ? _popup.Position.X + _popup.Size.X + 8 : _popup.Position.X - _card.Size.X - 8;
        var by = _popup.Position.Y + _popup.Size.Y - _card.Size.Y;
        _card.Position = new Vector2(Mathf.Clamp(bx, 10, view.X - _card.Size.X - 10), Mathf.Max(10, by));
    }

    /// <summary>The card's width, kept free beside the room tiles for when it can't go above them.</summary>
    const float CardRoom = 350;

    // ---- the halo ----

    void ClearHalo()
    {
        _halo.Visible = false;
        _haloBands = new();
    }

    /// <summary>The room's effects round where it would go, for the plan view: a colour (with its opacity) and triangles per band.</summary>
    public List<(Color color, Vector3[] tris)> Halo => _chain.Visible ? _chainBands : _halo.Visible && Tool != null ? _haloBands : NoHalo;
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
        var button = _categories.FirstOrDefault(b => b.GetMeta("cat").AsString() == _open);
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
        _spots.Visible = _spot.Visible = false;
        Demolishing = false;
        _demolishButton.ButtonPressed = false;
        Corridor = same ? null : finish;
        _bulkhead = bulkhead;
        _windows = windows;
        if (Corridor == null) Drop();
        else if (_open != "circulation") OpenCategory("circulation");
        RefreshRooms();
    }

    object CorridorJson() => new Dictionary<string, object> { ["finish"] = Corridor!, ["erase"] = _erase || ShiftErase, ["bulkhead"] = _bulkhead, ["windows"] = _windows };

    /// <summary>The demolish tool on or off (opening the strip for it).</summary>
    public void ToggleDemolish()
    {
        var on = !Demolishing;
        Drop();
        Demolishing = on;
        _demolishButton.ButtonPressed = on;
        if (on)
        {
            if (!_strip.Visible) _strip.Visible = true;
            OpenCategory(null);
            Toast("Demolish: click a room (half its cost back) · X or Esc stops");
        }
    }

    Vector3? _lastPaint;

    /// <summary>Pressed with the corridor tool: a chain starts at the border under the pointer.</summary>
    public void ChainStart(Vector3 at)
    {
        _lastPaint = at;
        _send(new Dictionary<string, object> { ["type"] = "chain", ["tool"] = CorridorJson(), ["at"] = new[] { at.X, at.Y, at.Z }, ["start"] = true });
    }

    /// <summary>Dragged: the chain grows along the borders crossed (or trims back, retracing).</summary>
    public void Paint(Vector3 at)
    {
        if (!Painting || _lastPaint is not Vector3 last || last.DistanceTo(at) < 0.6f) return;
        _lastPaint = at;
        _send(new Dictionary<string, object> { ["type"] = "chain", ["tool"] = CorridorJson(), ["at"] = new[] { at.X, at.Y, at.Z } });
    }

    /// <summary>Released: the bridge asks to confirm a chain, or draws a single border as a click.</summary>
    public void ChainEnd(Vector3 at)
    {
        if (_lastPaint == null) return;
        _lastPaint = null;
        _send(new Dictionary<string, object> { ["type"] = "chainEnd", ["tool"] = CorridorJson(), ["at"] = new[] { at.X, at.Y, at.Z } });
    }

    public bool Chaining => _lastPaint != null;

    /// <summary>The bridge's chain to show: strips by colour (new, already there, or being filled in).</summary>
    public void ShowChain(JsonElement msg)
    {
        var mesh = new ArrayMesh();
        _chainBands = new();
        foreach (var strip in msg.GetProperty("strips").EnumerateArray())
        {
            var color = new Color(strip.GetProperty("color").GetString()!) with { A = 0.45f };
            var verts = Verts(strip.GetProperty("tris").GetString()!);
            if (verts.Length == 0) continue;
            _chainBands.Add((color, verts));
            var arrays = new Godot.Collections.Array();
            arrays.Resize((int)Mesh.ArrayType.Max);
            arrays[(int)Mesh.ArrayType.Vertex] = verts;
            mesh.AddSurfaceFromArrays(Mesh.PrimitiveType.Triangles, arrays);
            mesh.SurfaceSetMaterial(mesh.GetSurfaceCount() - 1, Ghost(color));
        }
        _chain.Mesh = mesh;
        _chain.Visible = _chainBands.Count > 0;
        // While a chain shows, the single border's strip under the pointer would be in the way.
        if (_chain.Visible) _ghost.Visible = false;
    }

    /// <summary>The bridge's question about a chain (view/corridorProposal.ts): its size, work and cost.</summary>
    public void Propose(JsonElement msg)
    {
        _propose.Title = msg.GetProperty("title").GetString();
        var work = msg.GetProperty("work").ValueKind == JsonValueKind.String ? "\n" + msg.GetProperty("work").GetString() : "";
        _propose.DialogText = $"{msg.GetProperty("size").GetString()}{work}\n{msg.GetProperty("cost").GetString()}";
        _propose.OkButtonText = msg.GetProperty("accept").GetString();
        _propose.GetOkButton().Disabled = !msg.GetProperty("ok").GetBoolean();
        _propose.PopupCentered();
    }

    public void Pick(string id)
    {
        // Not a room in the palette (none yet, or not buildable).
        if (_palette.All(r => r.Id != id)) return;
        Corridor = null;
        Demolishing = false;
        _demolishButton.ButtonPressed = false;
        Tool = Tool == id ? null : id;
        _shape = 0;
        _spots.Visible = _spot.Visible = false;
        if (SurfaceTool) _send(new Dictionary<string, object> { ["type"] = "spots", ["room"] = Tool! });
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

    /// <summary>The rooms with build keys, and the corridor tool's (for Help).</summary>
    public IEnumerable<(string key, string name)> RoomKeys =>
        _palette.Where(r => r.Key != null).Select(r => (r.Key!, r.Name)).Append(("Z", "Corridor tool")).Append(("X", "Demolish"));

    /// <summary>What to pulse for the tutorial: a room's category (and the room, its popup open), or the corridor tool.</summary>
    public IEnumerable<Control> HighlightTargets(string highlight)
    {
        var category = highlight == "tool:corridors" ? "circulation" : _palette.FirstOrDefault(r => "room:" + r.Id == highlight)?.Category;
        foreach (var b in _categories)
            if (b.GetMeta("cat").AsString() == category) yield return b;
        foreach (var b in _tools.GetChildren().Concat(_rooms.GetChildren()).OfType<Button>())
            if (b.HasMeta("highlight") && b.GetMeta("highlight").AsString() == highlight) yield return b;
    }

    public bool SurfaceTool => _palette.FirstOrDefault(r => r.Id == Tool)?.Surface == true;

    object ToolJson()
    {
        var r = _palette.First(r => r.Id == Tool);
        return new Dictionary<string, object> { ["room"] = r.Id, ["shape"] = r.Shapes[_shape], ["lining"] = _lining };
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
        // A surface room: where it could go (fresh after each build), and the spot pointed at.
        if (msg.TryGetProperty("spots", out var all))
        {
            _spots.Mesh = TriMesh(all.GetString()!, _spotsFaint);
            _spots.Visible = SurfaceTool;
        }
        if (msg.TryGetProperty("spot", out var one)) _spot.Mesh = TriMesh(one.GetString()!, _spotHover);
        _spot.Visible = SurfaceTool && msg.TryGetProperty("spot", out _);
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
