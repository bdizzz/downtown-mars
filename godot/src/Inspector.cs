using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// The room panel, as the web's inspector (ui/Inspector.tsx): what the clicked room is and how it's
/// doing, and its controls (from the bridge's inspect.ts, kept up to date twice a second while it's
/// open): its name (✎ renames it), construction progress (and moving it up the queue), condition,
/// storage shares, connecting it, the rows of what it uses, makes and feels, a staging bay's seed kit,
/// crop, priority, running and stop-at, and demolish. Its outline is drawn over the scene. The widgets
/// are made once and only their values change, so a field being typed in isn't reset under the pointer.
/// </summary>
public partial class Inspector : Node3D
{
    const int RoomNameMax = 32;
    static readonly Color Dim = new("#a8927e"), Ink = new("#e0cfbd"), Warn = new("#f0a030"), Good = new("#9fd28a"), Danger = new("#e0503a");

    readonly PanelContainer _panel = new();
    readonly ScrollContainer _scroll = new() { HorizontalScrollMode = ScrollContainer.ScrollMode.Disabled };
    readonly Label _title = new(), _subtitle = new(), _state = new();
    readonly LineEdit _rename = new() { MaxLength = RoomNameMax, Visible = false };
    // Construction, condition.
    readonly VBoxContainer _building = new();
    readonly ProgressBar _buildBar = Bar();
    readonly Label _buildText = new();
    readonly Button _prioritize = Btn("Priority construction", "Move it to the front of the construction queue");
    readonly VBoxContainer _condition = new();
    readonly Label _conditionText = new();
    readonly ProgressBar _conditionBar = Bar();
    readonly StyleBoxFlat _conditionFill = new() { BgColor = Good };
    // Storage.
    readonly VBoxContainer _storage = new();
    readonly Label _storageText = new();
    readonly GridContainer _goods = new() { Columns = 3 };
    readonly Button _shareEvenly = Btn("Share evenly", "Split the room's space evenly among the goods it keeps");
    readonly Dictionary<string, (CheckBox on, SpinBox amount, ProgressBar fill)> _goodRows = new();
    readonly Button _connect = Btn("Connect", "Carve the shortest corridor from the network to this room, along the borders of rooms");
    readonly RichTextLabel _before = Rows(), _after = Rows();
    // The seed kit.
    readonly VBoxContainer _kit = new();
    readonly Label _kitText = new(), _kitGoods = new(), _kitNote = new();
    readonly Button _kitButton = Btn("Gather a seed kit");
    // Crop, priority, controls.
    readonly HBoxContainer _cropRow = new(), _priorityRow = new(), _stopRow = new();
    readonly OptionButton _crop = new() { FocusMode = Control.FocusModeEnum.None }, _priority = new() { FocusMode = Control.FocusModeEnum.None };
    readonly CheckBox _running = new() { Text = "Running", FocusMode = Control.FocusModeEnum.None };
    readonly CheckBox _stopAt = new() { Text = "Stop at", FocusMode = Control.FocusModeEnum.None, TooltipText = "The room stands by, freeing its staff, while there's at least this much in store" };
    readonly SpinBox _stopAmount = new() { MinValue = 0, MaxValue = 100000, Step = 10, CustomMinimumSize = new Vector2(90, 0) };
    readonly Label _stopRes = new();
    readonly Button _demolish = Btn("Demolish");

    int _roomId = -1;
    string _name = "";
    int _jobId;
    bool _gathering;
    string? _connectFinish;
    int _stopSuggested;
    Dictionary<string, int> _alloc = new();
    int _space;
    string[] _cropIds = Array.Empty<string>(), _priorityIds = Array.Empty<string>();
    /// <summary>Set while values are filled in from a message, so the widgets' change signals don't send commands.</summary>
    bool _filling;

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

    static ProgressBar Bar() => new() { MinValue = 0, MaxValue = 1, Step = 0.001, ShowPercentage = false, CustomMinimumSize = new Vector2(0, 8) };

    static Button Btn(string text, string tip = "")
    {
        var b = new Button { Text = text, FocusMode = Control.FocusModeEnum.None, TooltipText = tip, SizeFlagsHorizontal = Control.SizeFlags.ShrinkBegin };
        b.AddThemeFontSizeOverride("font_size", 13);
        return b;
    }

    static RichTextLabel Rows()
    {
        var r = new RichTextLabel { BbcodeEnabled = true, FitContent = true, ScrollActive = false, SelectionEnabled = false, CustomMinimumSize = new Vector2(300, 0) };
        r.AddThemeFontSizeOverride("normal_font_size", 14);
        r.AddThemeColorOverride("default_color", Ink);
        r.AddThemeConstantOverride("line_separation", 3);
        return r;
    }

    static void Style(Label l, int size, Color color)
    {
        l.AddThemeFontSizeOverride("font_size", size);
        l.AddThemeColorOverride("font_color", color);
        l.AutowrapMode = TextServer.AutowrapMode.WordSmart;
        l.CustomMinimumSize = new Vector2(300, 0);
    }

    static Label Caption(string text)
    {
        var l = new Label { Text = text };
        l.AddThemeFontSizeOverride("font_size", 14);
        l.AddThemeColorOverride("font_color", Dim);
        return l;
    }

    void Send(Dictionary<string, object> command) => Command?.Invoke(command);

    public Inspector(CanvasLayer hud)
    {
        AddChild(_outline);
        _panel.Visible = false;
        _panel.SetAnchorsPreset(Control.LayoutPreset.TopRight);
        _panel.GrowHorizontal = Control.GrowDirection.Begin;
        _panel.Position = new Vector2(-370, 100);
        // Kept just under the top bar, however tall it wraps (Live).
        _panel.SetMeta("under_top", true);
        _panel.CustomMinimumSize = new Vector2(350, 0);
        _panel.AddThemeStyleboxOverride("panel", Live.Panel());
        hud.AddChild(_panel);
        _panel.AddChild(_scroll);
        var rows = new VBoxContainer { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
        rows.AddThemeConstantOverride("separation", 6);
        _scroll.AddChild(rows);

        // The name, a pencil to rename it, and close.
        var head = new HBoxContainer();
        rows.AddChild(head);
        Style(_title, 20, new Color("#e8834a"));
        _title.CustomMinimumSize = new Vector2(0, 0);
        _title.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        head.AddChild(_title);
        _rename.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        _rename.AddThemeFontSizeOverride("font_size", 16);
        head.AddChild(_rename);
        var pencil = new Button { Text = "✎", Flat = true, FocusMode = Control.FocusModeEnum.None, TooltipText = "Rename it (leave it empty for its usual name)" };
        pencil.Pressed += StartRename;
        head.AddChild(pencil);
        var close = new Button { Text = "×", Flat = true, FocusMode = Control.FocusModeEnum.None };
        close.Pressed += () => Closed?.Invoke();
        head.AddChild(close);
        _rename.TextSubmitted += _ => CommitRename();
        _rename.FocusExited += CommitRename;
        _rename.GuiInput += e =>
        {
            if (e is InputEventKey { Pressed: true, Keycode: Key.Escape })
            {
                _rename.Visible = false;
                _title.Visible = true;
                _rename.AcceptEvent();
            }
        };

        Style(_subtitle, 14, new Color("#c9b29c"));
        rows.AddChild(_subtitle);
        Style(_state, 15, Good);
        rows.AddChild(_state);

        Style(_buildText, 13, Dim);
        _building.AddChild(_buildBar);
        _building.AddChild(_buildText);
        _building.AddChild(_prioritize);
        _prioritize.Pressed += () => Send(new() { ["type"] = "prioritize", ["jobId"] = _jobId });
        _buildBar.AddThemeStyleboxOverride("fill", new StyleBoxFlat { BgColor = new Color("#e0a03b") });
        rows.AddChild(_building);

        Style(_conditionText, 14, Ink);
        _condition.AddChild(_conditionText);
        _conditionBar.AddThemeStyleboxOverride("fill", _conditionFill);
        _condition.AddChild(_conditionBar);
        rows.AddChild(_condition);

        Style(_storageText, 14, Ink);
        _storage.AddChild(_storageText);
        _goods.AddThemeConstantOverride("h_separation", 8);
        _storage.AddChild(_goods);
        _storage.AddChild(_shareEvenly);
        _shareEvenly.Pressed += ShareEvenly;
        rows.AddChild(_storage);

        rows.AddChild(_connect);
        _connect.Pressed += () => Send(new() { ["type"] = "connectRoom", ["roomId"] = _roomId, ["finish"] = _connectFinish ?? "rock" });

        rows.AddChild(_before);

        Style(_kitText, 14, Ink);
        Style(_kitGoods, 13, Dim);
        Style(_kitNote, 13, Dim);
        _kit.AddChild(_kitText);
        _kit.AddChild(_kitGoods);
        _kit.AddChild(_kitButton);
        _kit.AddChild(_kitNote);
        _kitButton.Pressed += () => Send(new() { ["type"] = "setGathering", ["gathering"] = !_gathering });
        rows.AddChild(_kit);

        rows.AddChild(_after);

        _cropRow.AddChild(Caption("Crop"));
        _cropRow.AddChild(_crop);
        _crop.ItemSelected += i =>
        {
            if (!_filling) Send(new() { ["type"] = "setCrop", ["roomId"] = _roomId, ["crop"] = _cropIds[i] });
        };
        rows.AddChild(_cropRow);
        _priorityRow.AddChild(Caption("Priority"));
        _priorityRow.AddChild(_priority);
        _priority.ItemSelected += i =>
        {
            if (!_filling) Send(new() { ["type"] = "setPriority", ["roomId"] = _roomId, ["priority"] = _priorityIds[i] });
        };
        rows.AddChild(_priorityRow);

        rows.AddChild(_running);
        _running.Toggled += on =>
        {
            if (!_filling) Send(new() { ["type"] = "setRoomControl", ["roomId"] = _roomId, ["paused"] = !on });
        };
        _stopRow.AddChild(_stopAt);
        _stopRow.AddChild(_stopAmount);
        _stopRow.AddChild(_stopRes);
        _stopAt.Toggled += on =>
        {
            if (!_filling) Send(new() { ["type"] = "setRoomControl", ["roomId"] = _roomId, ["stopAt"] = on ? (int)_stopAmount.Value : null! });
        };
        _stopAmount.ValueChanged += v =>
        {
            if (!_filling && _stopAt.ButtonPressed) Send(new() { ["type"] = "setRoomControl", ["roomId"] = _roomId, ["stopAt"] = (int)v });
        };
        rows.AddChild(_stopRow);

        _demolish.AddThemeColorOverride("font_color", Danger);
        _demolish.Pressed += () => Send(new() { ["type"] = "demolish", ["roomId"] = _roomId });
        rows.AddChild(_demolish);
    }

    // ---- renaming ----

    void StartRename()
    {
        _rename.Text = _name;
        _rename.Visible = true;
        _title.Visible = false;
        _rename.GrabFocus();
        _rename.SelectAll();
    }

    void CommitRename()
    {
        if (!_rename.Visible) return;
        _rename.Visible = false;
        _title.Visible = true;
        Send(new() { ["type"] = "renameRoom", ["roomId"] = _roomId, ["name"] = _rename.Text });
    }

    // ---- storage ----

    void SetAllocation(Dictionary<string, int> next) => Send(new() { ["type"] = "setAllocation", ["roomId"] = _roomId, ["allocation"] = next });

    /// <summary>A good ticked: it gets the free space (or, with none left, an even share of it all), as the web's.</summary>
    void ToggleGood(string id, bool on)
    {
        var next = new Dictionary<string, int>(_alloc);
        if (!on) next.Remove(id);
        else
        {
            var free = _space - _alloc.Values.Sum();
            if (free >= 1) next[id] = free;
            else
            {
                var ids = next.Keys.Append(id).ToList();
                var each = _space / ids.Count;
                foreach (var k in ids) next[k] = each;
            }
        }
        SetAllocation(next);
    }

    void ShareEvenly()
    {
        if (_alloc.Count == 0) return;
        var each = _space / _alloc.Count;
        SetAllocation(_alloc.Keys.ToDictionary(k => k, _ => each));
    }

    void SetGood(string id, int amount)
    {
        var room = _space - _alloc.Values.Sum() + _alloc.GetValueOrDefault(id);
        SetAllocation(new Dictionary<string, int>(_alloc) { [id] = Math.Clamp(amount, 0, room) });
    }

    void FillStorage(JsonElement st)
    {
        _space = st.GetProperty("space").GetInt32();
        _storageText.Text = $"Storage: {st.GetProperty("summary").GetString()}";
        _alloc = new();
        foreach (var g in st.GetProperty("goods").EnumerateArray())
        {
            var id = g.GetProperty("id").GetString()!;
            var on = g.GetProperty("on").GetBoolean();
            var amount = g.GetProperty("amount").GetInt32();
            if (on) _alloc[id] = amount;
            if (!_goodRows.TryGetValue(id, out var row))
            {
                var check = new CheckBox { Text = g.GetProperty("name").GetString(), FocusMode = Control.FocusModeEnum.None, SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
                check.AddThemeFontSizeOverride("font_size", 13);
                var spin = new SpinBox { MinValue = 0, MaxValue = 100000, Step = 10, CustomMinimumSize = new Vector2(84, 0) };
                var fill = Bar();
                fill.CustomMinimumSize = new Vector2(60, 8);
                fill.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;
                check.Toggled += v =>
                {
                    if (!_filling) ToggleGood(id, v);
                };
                spin.ValueChanged += v =>
                {
                    if (!_filling) SetGood(id, (int)v);
                };
                _goods.AddChild(check);
                _goods.AddChild(spin);
                _goods.AddChild(fill);
                _goodRows[id] = row = (check, spin, fill);
            }
            row.on.ButtonPressed = on;
            row.amount.Editable = on;
            // Not while it's being typed in.
            if (!row.amount.GetLineEdit().HasFocus()) row.amount.Value = amount;
            // Kept in the grid (so the rows line up), just not shown.
            row.fill.Modulate = on ? Colors.White : Colors.Transparent;
            row.fill.Value = amount > 0 ? g.GetProperty("fill").GetDouble() / amount : 0;
        }
        _shareEvenly.Visible = _alloc.Count > 1;
    }

    // ---- showing ----

    public bool Open => _panel.Visible;
    /// <summary>The room shown, if the panel's open.</summary>
    public int? Selected => _panel.Visible ? _roomId : null;
    /// <summary>The room's outline as line pairs in world space, while the panel is open (for the plan view).</summary>
    public Vector3[] OutlineLines => _panel.Visible ? _outlineVerts : System.Array.Empty<Vector3>();
    Vector3[] _outlineVerts = System.Array.Empty<Vector3>();

    static string RowsText(JsonElement rows) => string.Join("\n", rows.EnumerateArray().Select(r =>
    {
        var k = r.TryGetProperty("k", out var kk) ? $"[color=#{Dim.ToHtml(false)}]{Escape(kk.GetString()!)}[/color] " : "";
        var text = Escape(r.GetProperty("text").GetString()!);
        return r.TryGetProperty("warn", out var w) && w.GetBoolean() ? $"{k}[color=#{Warn.ToHtml(false)}]{text}[/color]" : k + text;
    }));

    static string Escape(string s) => s.Replace("[", "[lb]");

    static void Options(OptionButton pick, JsonElement o, ref string[] ids)
    {
        var options = o.GetProperty("options").EnumerateArray().ToArray();
        var newIds = options.Select(x => x.GetProperty("id").GetString()!).ToArray();
        if (!newIds.SequenceEqual(ids))
        {
            pick.Clear();
            foreach (var x in options) pick.AddItem(x.GetProperty("label").GetString()!);
            ids = newIds;
        }
        pick.Select(Array.IndexOf(ids, o.GetProperty("value").GetString()));
    }

    /// <summary>The bridge's "inspected" message: a room's panel and outline, or roomId null to close.</summary>
    public void Show(JsonElement msg)
    {
        if (msg.GetProperty("roomId").ValueKind != JsonValueKind.Number)
        {
            Hide();
            return;
        }
        var id = msg.GetProperty("roomId").GetInt32();
        if (id != _roomId && _rename.Visible)
        {
            _rename.Visible = false;
            _title.Visible = true;
        }
        _roomId = id;
        _panel.Visible = true;
        _filling = true;
        try { Fill(msg); }
        finally { _filling = false; }
        // As tall as it needs, up to most of the window: measured once laid out (wrapped text needs its width first).
        CallDeferred(nameof(FitHeight));
        ShowOutline(msg.GetProperty("outline").GetString()!);
    }

    void FitHeight()
    {
        var content = (Control)_scroll.GetChild(0);
        var height = Mathf.Min(content.GetCombinedMinimumSize().Y, _panel.GetViewportRect().Size.Y - _panel.Position.Y - 60);
        if (Mathf.IsEqualApprox(_scroll.CustomMinimumSize.Y, height)) return;
        _scroll.CustomMinimumSize = new Vector2(0, height);
        _panel.ResetSize();
    }

    void Fill(JsonElement msg)
    {
        bool Has(string key, out JsonElement e) => msg.TryGetProperty(key, out e) && e.ValueKind != JsonValueKind.Null;
        _title.Text = msg.GetProperty("title").GetString();
        _name = msg.GetProperty("name").GetString() is { Length: > 0 } n ? n : msg.GetProperty("title").GetString()!;
        _rename.PlaceholderText = msg.GetProperty("defaultName").GetString();
        _subtitle.Text = msg.GetProperty("subtitle").GetString();
        _state.Text = msg.GetProperty("state").GetString();
        _state.AddThemeColorOverride("font_color", msg.GetProperty("problem").GetBoolean() ? Warn : Good);

        _building.Visible = Has("construction", out var job);
        if (_building.Visible)
        {
            _jobId = job.GetProperty("jobId").GetInt32();
            _buildBar.Value = job.GetProperty("progress").GetDouble();
            _buildText.Text = job.GetProperty("text").GetString();
            _prioritize.Visible = job.GetProperty("canPrioritize").GetBoolean();
        }
        _condition.Visible = Has("condition", out var cond);
        if (_condition.Visible)
        {
            var v = cond.GetProperty("value").GetDouble();
            var note = cond.GetProperty("note").GetString();
            _conditionText.Text = $"Condition {Math.Round(v * 100)}%{(string.IsNullOrEmpty(note) ? "" : " · " + note)}";
            _conditionBar.Value = v;
            _conditionFill.BgColor = new Color(cond.GetProperty("color").GetString()!);
        }
        _storage.Visible = Has("storage", out var st);
        if (_storage.Visible) FillStorage(st);
        _connect.Visible = Has("connect", out var conn);
        if (_connect.Visible)
        {
            _connectFinish = conn.GetProperty("finish").GetString();
            _connect.Text = $"Connect with a corridor ({conn.GetProperty("name").GetString()})";
        }
        _before.Text = RowsText(msg.GetProperty("before"));
        _before.Visible = _before.Text != "";
        _kit.Visible = Has("kit", out var kit);
        if (_kit.Visible)
        {
            _gathering = kit.GetProperty("gathering").GetBoolean();
            _kitText.Text = $"Seed kit: {Math.Floor(kit.GetProperty("progress").GetDouble() * 100)}% gathered";
            _kitGoods.Text = kit.GetProperty("goods").GetString();
            _kitButton.Visible = kit.GetProperty("button").ValueKind == JsonValueKind.String;
            if (_kitButton.Visible) _kitButton.Text = kit.GetProperty("button").GetString();
            _kitNote.Text = kit.GetProperty("note").GetString();
        }
        _after.Text = RowsText(msg.GetProperty("after"));
        _after.Visible = _after.Text != "";
        _cropRow.Visible = Has("crop", out var crop);
        if (_cropRow.Visible) Options(_crop, crop, ref _cropIds);
        _priorityRow.Visible = Has("priority", out var pri);
        if (_priorityRow.Visible) Options(_priority, pri, ref _priorityIds);
        var controls = Has("controls", out var ctl);
        _running.Visible = controls;
        _stopRow.Visible = controls && ctl.GetProperty("resource").ValueKind == JsonValueKind.String;
        if (controls)
        {
            _running.ButtonPressed = ctl.GetProperty("running").GetBoolean();
            if (_stopRow.Visible)
            {
                var stopAt = ctl.GetProperty("stopAt");
                _stopSuggested = ctl.GetProperty("suggested").GetInt32();
                _stopAt.ButtonPressed = stopAt.ValueKind == JsonValueKind.Number;
                _stopAmount.Editable = _stopAt.ButtonPressed;
                if (!_stopAmount.GetLineEdit().HasFocus()) _stopAmount.Value = _stopAt.ButtonPressed ? stopAt.GetDouble() : _stopSuggested;
                _stopRes.Text = ctl.GetProperty("resource").GetString();
            }
        }
        _demolish.Visible = Has("demolish", out var demolish);
        if (_demolish.Visible) _demolish.Text = demolish.GetString();
    }

    void ShowOutline(string outline)
    {
        if (outline != _outlineData)
        {
            _outlineData = outline;
            var f = MemoryMarshal.Cast<byte, float>(Convert.FromBase64String(outline)).ToArray();
            var verts = new Vector3[f.Length / 3];
            for (var i = 0; i < verts.Length; i++) verts[i] = new Vector3(f[i * 3], f[i * 3 + 1], f[i * 3 + 2]);
            _outlineVerts = verts;
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
        _roomId = -1;
    }
}
