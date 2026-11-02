using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// The room panel, as the web's inspector (ui/Inspector.tsx), drawn from the bridge's panel model
/// (view/roomPanel.ts panelModel, kept up to date twice a second while it's open): its name (✎ renames
/// it), a status pill and headline chips, the alerts band (with Connect), condition, then the sections
/// that fold open and closed (Work, Home, Serves, Surroundings, Building, Seed kit, Storage), each with
/// its rows and its controls: crop, what a tank holds, priority, running and stop-at in Work;
/// construction, refitting its walls and demolish in Building. Which sections are open is remembered per
/// section (ViewSettings.PanelSections). Its outline is drawn over the scene. The widgets are made once
/// and only their values change, so a field being typed in isn't reset under the pointer.
/// </summary>
public partial class Inspector : Node3D
{
    const int RoomNameMax = 32;
    static readonly Color Dim = new("#a8927e"), Ink = new("#e0cfbd"), Warn = new("#f0a030"), Good = new("#9fd28a"), Danger = new("#e0503a");
    /// <summary>The panel's five tones, the same hex values as the web's (ui/styles.css --tone-*).</summary>
    static readonly Dictionary<string, Color> Tones = new()
    {
        ["good"] = Good,
        ["idle"] = Dim,
        ["warn"] = Warn,
        ["bad"] = new("#ff7a5c"),
        ["info"] = new("#7fb0e0"),
    };
    static Color ToneOf(JsonElement e, string key, Color fallback) =>
        e.TryGetProperty(key, out var t) && t.ValueKind == JsonValueKind.String && Tones.TryGetValue(t.GetString()!, out var c) ? c : fallback;
    /// <summary>The sections in the order the panel shows them (view/roomPanel.ts SECTIONS).</summary>
    static readonly string[] SectionIds = { "work", "home", "serves", "surroundings", "building", "kit", "storage" };

    /// <summary>A section that folds: its header (chevron, icon, title, and a warning dot or row count) and its body.</summary>
    sealed class Fold
    {
        public readonly VBoxContainer Root = new();
        public readonly Button Head = new() { Flat = true, FocusMode = Control.FocusModeEnum.None, Alignment = HorizontalAlignment.Left, SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
        public readonly TextureRect Chevron = Icons.Rect("chevron", 12, Dim);
        public readonly TextureRect Icon = Icons.Rect("walls", 14, Ink);
        public readonly Label Count = new();
        public readonly VBoxContainer Body = new();
        public readonly RichTextLabel Rows = Inspector.Rows();
        public string RowsKey = "";
        public bool Open;
    }
    readonly Dictionary<string, Fold> _folds = new();

    readonly PanelContainer _panel = new();
    readonly ScrollContainer _scroll = new() { HorizontalScrollMode = ScrollContainer.ScrollMode.Disabled };
    readonly Label _title = new(), _subtitle = new();
    // The header strip: the status pill and headline chips.
    readonly HFlowContainer _headline = new();
    readonly PanelContainer _pill = new();
    readonly StyleBoxFlat _pillBox = new() { CornerRadiusTopLeft = 9, CornerRadiusTopRight = 9, CornerRadiusBottomLeft = 9, CornerRadiusBottomRight = 9, ContentMarginLeft = 8, ContentMarginRight = 8, ContentMarginTop = 1, ContentMarginBottom = 1 };
    readonly Label _pillText = new();
    readonly List<(PanelContainer box, TextureRect icon, Label value, string id)> _chips = new();
    // The alerts band.
    readonly VBoxContainer _alerts = new();
    readonly List<(HBoxContainer row, TextureRect icon, Label text, Button to)> _alertRows = new();
    readonly List<string> _alertSections = new();
    readonly LineEdit _rename = new() { MaxLength = RoomNameMax, Visible = false };
    // Construction, condition.
    readonly VBoxContainer _building = new();
    readonly ProgressBar _buildBar = Bar();
    readonly Label _buildText = new();
    readonly Button _prioritize = Btn("Priority construction", "Move it to the front of the construction queue");
    readonly Button _cancelRefit = Btn("Cancel the refit (full refund)", "Call the refit off: the room keeps its walls, and what it cost comes back");
    readonly VBoxContainer _condition = new();
    readonly Label _conditionText = new();
    readonly ProgressBar _conditionBar = Bar();
    readonly StyleBoxFlat _conditionFill = new() { BgColor = Good };
    // Storage.
    readonly VBoxContainer _storage = new();
    readonly Label _storageText = new();
    readonly HBoxContainer _storageBar = new() { CustomMinimumSize = new Vector2(0, 8) };
    readonly HBoxContainer _allNone = new();
    readonly Button _allowAll = Btn("All", "Let every good into this room"), _allowNone = Btn("None", "Keep every good out of this room");
    readonly GridContainer _goods = new() { Columns = 2 };
    readonly Dictionary<string, (CheckBox on, Label stored)> _goodRows = new();
    readonly Button _connect = Btn("Connect", "Carve the shortest corridor from the network to this room, along the borders of rooms");
    // The seed kit.
    readonly VBoxContainer _kit = new();
    readonly Label _kitText = new(), _kitGoods = new(), _kitNote = new();
    readonly Button _kitButton = Btn("Gather a seed kit");
    // Refit, crop, priority, controls.
    readonly HBoxContainer _refitRow = new() { TooltipText = "Refit the walls through the construction queue. Once the crews start the room works at half speed (a home is less comfortable) until it's done, then it's as good as new. Taking brick or metal out gives half of it back." };
    readonly OptionButton _refit = new() { FocusMode = Control.FocusModeEnum.None, SizeFlagsHorizontal = Control.SizeFlags.ExpandFill, ClipText = true, FitToLongestItem = false };
    readonly HBoxContainer _cropRow = new(), _holdsRow = new(), _priorityRow = new(), _stopRow = new();
    readonly OptionButton _crop = new() { FocusMode = Control.FocusModeEnum.None }, _holds = new() { FocusMode = Control.FocusModeEnum.None }, _priority = new() { FocusMode = Control.FocusModeEnum.None };
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
    List<string> _goodIds = new(), _allowed = new();
    /// <summary>The refit picker's linings (material, finish), after its "Choose new walls…" item, and their texts.</summary>
    (string material, string finish)[] _refits = Array.Empty<(string, string)>();
    string[] _refitTexts = Array.Empty<string>();
    string[] _cropIds = Array.Empty<string>(), _holdsIds = Array.Empty<string>(), _priorityIds = Array.Empty<string>();
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

        // The header strip: status pill, then the headline chips.
        _headline.AddThemeConstantOverride("h_separation", 4);
        _headline.AddThemeConstantOverride("v_separation", 4);
        _pill.AddThemeStyleboxOverride("panel", _pillBox);
        _pillText.AddThemeFontSizeOverride("font_size", 13);
        _pillText.AddThemeColorOverride("font_color", new Color("#1a0f0d"));
        _pill.AddChild(_pillText);
        _headline.AddChild(_pill);
        rows.AddChild(_headline);

        // The alerts band: one line per warning, each with a button to its section; Connect below.
        _alerts.AddThemeConstantOverride("separation", 3);
        _alerts.AddChild(_connect);
        rows.AddChild(_alerts);
        _connect.Pressed += () => Send(new() { ["type"] = "connectRoom", ["roomId"] = _roomId, ["finish"] = _connectFinish ?? "rock" });

        Style(_buildText, 13, Dim);
        _building.AddChild(_buildBar);
        _building.AddChild(_buildText);
        _building.AddChild(_prioritize);
        _building.AddChild(_cancelRefit);
        _prioritize.Pressed += () => Send(new() { ["type"] = "prioritize", ["jobId"] = _jobId });
        _cancelRefit.Pressed += () => Send(new() { ["type"] = "cancelJob", ["jobId"] = _jobId });
        _buildBar.AddThemeStyleboxOverride("fill", new StyleBoxFlat { BgColor = new Color("#e0a03b") });

        // At a glance: condition (the rest of the glance band comes with #309).
        Style(_conditionText, 14, Ink);
        _condition.AddChild(_conditionText);
        _conditionBar.AddThemeStyleboxOverride("fill", _conditionFill);
        _condition.AddChild(_conditionBar);
        rows.AddChild(_condition);

        // The sections, each made once; the controls go into the one they belong to.
        foreach (var id in SectionIds)
        {
            var f = new Fold();
            var line = new HBoxContainer();
            line.AddThemeConstantOverride("separation", 4);
            f.Chevron.PivotOffset = new Vector2(6, 6);
            line.AddChild(f.Chevron);
            line.AddChild(f.Icon);
            f.Head.AddThemeFontSizeOverride("font_size", 14);
            f.Head.AddThemeColorOverride("font_color", Ink);
            line.AddChild(f.Head);
            Style(f.Count, 13, Dim);
            f.Count.CustomMinimumSize = Vector2.Zero;
            f.Count.AutowrapMode = TextServer.AutowrapMode.Off;
            line.AddChild(f.Count);
            f.Root.AddChild(new HSeparator());
            f.Root.AddChild(line);
            f.Body.AddThemeConstantOverride("separation", 6);
            f.Root.AddChild(f.Body);
            var sectionId = id;
            f.Head.Pressed += () => SetOpen(sectionId, !_folds[sectionId].Open);
            _folds[id] = f;
            rows.AddChild(f.Root);
        }
        var work = _folds["work"].Body;
        var building = _folds["building"].Body;
        foreach (var id in new[] { "work", "home", "serves", "surroundings" }) _folds[id].Body.AddChild(_folds[id].Rows);
        building.AddChild(_building);
        building.AddChild(_folds["building"].Rows);

        Style(_storageText, 14, Ink);
        _storage.AddChild(_storageText);
        _storageBar.AddThemeConstantOverride("separation", 0);
        _storage.AddChild(_storageBar);
        _allNone.AddChild(_allowAll);
        _allNone.AddChild(_allowNone);
        _allowAll.Pressed += () => SetAllows(_goodIds);
        _allowNone.Pressed += () => SetAllows(new());
        _storage.AddChild(_allNone);
        _goods.AddThemeConstantOverride("h_separation", 8);
        _storage.AddChild(_goods);
        _folds["storage"].Body.AddChild(_storage);

        Style(_kitText, 14, Ink);
        Style(_kitGoods, 13, Dim);
        Style(_kitNote, 13, Dim);
        _kit.AddChild(_kitText);
        _kit.AddChild(_kitGoods);
        _kit.AddChild(_kitButton);
        _kit.AddChild(_kitNote);
        _kitButton.Pressed += () => Send(new() { ["type"] = "setGathering", ["gathering"] = !_gathering });
        _folds["kit"].Body.AddChild(_kit);

        _refitRow.AddChild(Caption("Refit"));
        _refitRow.AddChild(_refit);
        _refit.ItemSelected += i =>
        {
            if (_filling || i < 1) return;
            var (material, finish) = _refits[i - 1];
            Send(new() { ["type"] = "upgradeRoom", ["roomId"] = _roomId, ["material"] = material, ["finish"] = finish });
            _refit.Select(0);
        };
        building.AddChild(_refitRow);

        _cropRow.AddChild(Caption("Crop"));
        _cropRow.AddChild(_crop);
        _crop.ItemSelected += i =>
        {
            if (!_filling) Send(new() { ["type"] = "setCrop", ["roomId"] = _roomId, ["crop"] = _cropIds[i] });
        };
        work.AddChild(_cropRow);
        _holdsRow.AddChild(Caption("Holds"));
        _holdsRow.AddChild(_holds);
        _holds.ItemSelected += i =>
        {
            if (!_filling) Send(new() { ["type"] = "setHolds", ["roomId"] = _roomId, ["holds"] = _holdsIds[i] });
        };
        work.AddChild(_holdsRow);
        _priorityRow.AddChild(Caption("Priority"));
        _priorityRow.AddChild(_priority);
        _priority.ItemSelected += i =>
        {
            if (!_filling) Send(new() { ["type"] = "setPriority", ["roomId"] = _roomId, ["priority"] = _priorityIds[i] });
        };
        work.AddChild(_priorityRow);

        work.AddChild(_running);
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
        work.AddChild(_stopRow);

        _demolish.AddThemeColorOverride("font_color", Danger);
        _demolish.Pressed += () => Send(new() { ["type"] = "demolish", ["roomId"] = _roomId });
        building.AddChild(_demolish);
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

    void SetAllows(List<string> ids) => Send(new() { ["type"] = "setAllows", ["roomId"] = _roomId, ["allows"] = ids });

    void ToggleGood(string id, bool on) => SetAllows(on ? _allowed.Append(id).ToList() : _allowed.Where(k => k != id).ToList());

    /// <summary>A storage room: a bar of what it holds, and a checklist of the goods it allows, as the web's.</summary>
    void FillStorage(JsonElement st)
    {
        var space = st.GetProperty("space").GetDouble();
        _storageText.Text = $"Storage: {st.GetProperty("summary").GetString()}";
        foreach (var c in _storageBar.GetChildren()) c.QueueFree();
        var used = 0.0;
        foreach (var g in st.GetProperty("segments").EnumerateArray())
        {
            var units = g.GetProperty("units").GetDouble();
            used += units;
            _storageBar.AddChild(new ColorRect
            {
                Color = Color.FromHtml(g.GetProperty("color").GetString()!),
                SizeFlagsHorizontal = Control.SizeFlags.ExpandFill,
                SizeFlagsStretchRatio = (float)Math.Max(units, 0.001),
                TooltipText = $"{g.GetProperty("name").GetString()} {Math.Round(units)}",
                MouseFilter = Control.MouseFilterEnum.Pass,
            });
        }
        // The empty rest of the room.
        if (space - used > 0.5)
            _storageBar.AddChild(new ColorRect { Color = new Color(0, 0, 0, 0.33f), SizeFlagsHorizontal = Control.SizeFlags.ExpandFill, SizeFlagsStretchRatio = (float)(space - used) });
        _goodIds = new();
        _allowed = new();
        foreach (var g in st.GetProperty("goods").EnumerateArray())
        {
            var id = g.GetProperty("id").GetString()!;
            var on = g.GetProperty("allowed").GetBoolean();
            var stored = g.GetProperty("stored").GetDouble();
            _goodIds.Add(id);
            if (on) _allowed.Add(id);
            if (!_goodRows.TryGetValue(id, out var row))
            {
                var check = new CheckBox { Text = g.GetProperty("name").GetString(), FocusMode = Control.FocusModeEnum.None, SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
                check.AddThemeFontSizeOverride("font_size", 13);
                check.AddThemeColorOverride("font_color", Color.FromHtml(g.GetProperty("color").GetString()!));
                var amount = new Label { HorizontalAlignment = HorizontalAlignment.Right };
                Style(amount, 13, Ink);
                check.Toggled += v =>
                {
                    if (!_filling) ToggleGood(id, v);
                };
                _goods.AddChild(check);
                _goods.AddChild(amount);
                _goodRows[id] = row = (check, amount);
            }
            row.on.ButtonPressed = on;
            row.on.Modulate = on ? Colors.White : new Color(1, 1, 1, 0.55f);
            row.stored.Text = stored >= 0.5 ? Math.Round(stored).ToString() : "";
        }
    }

    // ---- showing ----

    public bool Open => _panel.Visible;
    /// <summary>The room shown, if the panel's open.</summary>
    public int? Selected => _panel.Visible ? _roomId : null;
    /// <summary>The room's outline as line pairs in world space, while the panel is open (for the plan view).</summary>
    public Vector3[] OutlineLines => _panel.Visible ? _outlineVerts : System.Array.Empty<Vector3>();
    Vector3[] _outlineVerts = System.Array.Empty<Vector3>();

    /// <summary>A section's rows, as the web's: an icon, a dimmed label, then the text, in its tone. Redrawn only when they change.</summary>
    static void FillRows(Fold f, JsonElement rows)
    {
        var key = rows.GetRawText();
        if (key == f.RowsKey) return;
        f.RowsKey = key;
        var r = f.Rows;
        r.Clear();
        var first = true;
        foreach (var row in rows.EnumerateArray())
        {
            if (!first) r.Newline();
            first = false;
            var tone = ToneOf(row, "tone", Ink);
            if (row.TryGetProperty("icon", out var icon) && Icons.Get(icon.GetString()!) is { } tex) r.AddImage(tex, 13, 13, tone == Ink ? Dim : tone);
            r.AddText(" ");
            if (row.TryGetProperty("k", out var k))
            {
                r.PushColor(Dim);
                r.AddText(k.GetString()! + " ");
                r.Pop();
            }
            r.PushColor(tone);
            r.AddText(row.GetProperty("text").GetString()!);
            r.Pop();
        }
        // Icons that arrive later redraw it.
        if (Icons.Get("workers") == null) f.RowsKey = "";
        r.Visible = !first;
    }

    /// <summary>Open or close a section, and remember it for every room (as the web's useOpenSections).</summary>
    void SetOpen(string id, bool open)
    {
        ViewSettings.PanelSections[id] = open;
        ViewSettings.Save();
        ShowFold(_folds[id], open);
        CallDeferred(nameof(FitHeight));
    }

    static void ShowFold(Fold f, bool open)
    {
        f.Open = open;
        f.Body.Visible = open;
        f.Chevron.RotationDegrees = open ? 90 : 0;
    }

    /// <summary>An alert's button: open its section and bring it into view.</summary>
    void GoTo(string id)
    {
        SetOpen(id, true);
        CallDeferred(nameof(ScrollTo), id);
    }

    void ScrollTo(string id) => _scroll.EnsureControlVisible(_folds[id].Root);

    /// <summary>The header strip, the alerts band and the sections from the panel model (view/roomPanel.ts panelModel).</summary>
    void FillModel(JsonElement model, bool canConnect)
    {
        var status = model.GetProperty("status");
        var word = status.GetProperty("text").GetString()!;
        _pill.Visible = word != "";
        _pillText.Text = word;
        _pill.TooltipText = status.GetProperty("tip").GetString();
        _pillBox.BgColor = ToneOf(status, "tone", Dim);

        var chips = model.GetProperty("headline").EnumerateArray().ToArray();
        for (var i = 0; i < chips.Length; i++)
        {
            var c = chips[i];
            var icon = c.GetProperty("icon").GetString()!;
            if (i >= _chips.Count)
            {
                var box = new PanelContainer();
                box.AddThemeStyleboxOverride("panel", new StyleBoxFlat { BgColor = new Color(0, 0, 0, 0.27f), CornerRadiusTopLeft = 4, CornerRadiusTopRight = 4, CornerRadiusBottomLeft = 4, CornerRadiusBottomRight = 4, ContentMarginLeft = 6, ContentMarginRight = 6, ContentMarginTop = 1, ContentMarginBottom = 1 });
                var line = new HBoxContainer { MouseFilter = Control.MouseFilterEnum.Ignore };
                line.AddThemeConstantOverride("separation", 3);
                var rect = Icons.Rect(icon, 13, Ink);
                var value = new Label { MouseFilter = Control.MouseFilterEnum.Ignore };
                value.AddThemeFontSizeOverride("font_size", 13);
                line.AddChild(rect);
                line.AddChild(value);
                box.AddChild(line);
                _headline.AddChild(box);
                _chips.Add((box, rect, value, icon));
            }
            var chip = _chips[i];
            if (chip.id != icon)
            {
                Icons.Show(chip.icon, icon);
                _chips[i] = chip = (chip.box, chip.icon, chip.value, icon);
            }
            var tone = ToneOf(c, "tone", Ink);
            chip.value.Text = c.GetProperty("value").GetString();
            chip.value.AddThemeColorOverride("font_color", tone);
            chip.icon.Modulate = tone;
            var label = c.GetProperty("label").GetString();
            chip.box.TooltipText = c.TryGetProperty("tip", out var tip) ? $"{label}: {tip.GetString()}" : label;
            chip.box.Visible = true;
        }
        for (var i = chips.Length; i < _chips.Count; i++) _chips[i].box.Visible = false;
        _headline.Visible = _pill.Visible || chips.Length > 0;

        var sections = model.GetProperty("sections").EnumerateArray().ToDictionary(x => x.GetProperty("id").GetString()!);
        var alerts = model.GetProperty("alerts").EnumerateArray().ToArray();
        var connect = false;
        _alertSections.Clear();
        for (var i = 0; i < alerts.Length; i++)
        {
            var a = alerts[i];
            if (i >= _alertRows.Count)
            {
                var row = new HBoxContainer();
                row.AddThemeConstantOverride("separation", 5);
                var rect = Icons.Rect("alert", 13, Warn);
                var text = new Label { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
                Style(text, 13, Warn);
                text.CustomMinimumSize = Vector2.Zero;
                // One line each, the whole of it as the tooltip (it's in full in its section too).
                text.AutowrapMode = TextServer.AutowrapMode.Off;
                text.TextOverrunBehavior = TextServer.OverrunBehavior.TrimEllipsis;
                text.ClipText = true;
                text.MouseFilter = Control.MouseFilterEnum.Pass;
                var to = new Button { Flat = true, FocusMode = Control.FocusModeEnum.None, SizeFlagsVertical = Control.SizeFlags.ShrinkBegin };
                to.AddThemeFontSizeOverride("font_size", 12);
                to.AddThemeColorOverride("font_color", Dim);
                var n = i;
                to.Pressed += () => GoTo(_alertSections[n]);
                row.AddChild(rect);
                row.AddChild(text);
                row.AddChild(to);
                _alerts.AddChild(row);
                _alerts.MoveChild(_connect, -1);
                _alertRows.Add((row, rect, text, to));
            }
            var (r, icon, label, button) = _alertRows[i];
            var section = a.GetProperty("section").GetString()!;
            _alertSections.Add(section);
            var tone = ToneOf(a, "tone", Warn);
            icon.Modulate = tone;
            label.Text = a.GetProperty("text").GetString();
            label.TooltipText = label.Text;
            label.AddThemeColorOverride("font_color", tone);
            button.Visible = sections.TryGetValue(section, out var target);
            if (button.Visible) button.Text = $"→ {target.GetProperty("title").GetString()}";
            r.Visible = true;
            if (a.TryGetProperty("action", out var act) && act.GetString() == "connect") connect = true;
        }
        for (var i = alerts.Length; i < _alertRows.Count; i++) _alertRows[i].row.Visible = false;
        _connect.Visible = connect && canConnect;
        _alerts.Visible = alerts.Length > 0;

        foreach (var id in SectionIds)
        {
            var f = _folds[id];
            f.Root.Visible = sections.TryGetValue(id, out var x);
            if (!f.Root.Visible) continue;
            f.Head.Text = x.GetProperty("title").GetString();
            Icons.Show(f.Icon, x.GetProperty("icon").GetString()!);
            var rows = x.GetProperty("rows");
            var warns = rows.EnumerateArray().Any(r => r.TryGetProperty("warn", out var w) && w.GetBoolean());
            var open = ViewSettings.PanelSections.TryGetValue(id, out var remembered) ? remembered : x.GetProperty("open").GetBoolean();
            ShowFold(f, open);
            var count = rows.GetArrayLength();
            f.Count.Text = warns ? "●" : !open && count > 0 ? count.ToString() : "";
            f.Count.AddThemeColorOverride("font_color", warns ? Warn : Dim);
            if (f.Rows.GetParent() != null) FillRows(f, rows);
        }
    }

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

    /// <summary>The refit picker, as the web's: "Choose new walls…", then each lining with what it gives and costs, greyed out with why when it can't be ordered.</summary>
    void FillRefit(JsonElement options)
    {
        var all = options.EnumerateArray().ToArray();
        static string? Refusal(JsonElement o) => o.GetProperty("refusal").ValueKind == JsonValueKind.String ? o.GetProperty("refusal").GetString() : null;
        var texts = all.Select(o => o.GetProperty("text").GetString() + (Refusal(o) is { } why ? $" ({why})" : "")).ToArray();
        if (!texts.SequenceEqual(_refitTexts))
        {
            _refit.Clear();
            _refit.AddItem("Choose new walls…");
            for (var i = 0; i < all.Length; i++)
            {
                _refit.AddItem(texts[i]);
                _refit.SetItemDisabled(i + 1, Refusal(all[i]) != null);
            }
            _refits = all.Select(o => (o.GetProperty("material").GetString()!, o.GetProperty("finish").GetString()!)).ToArray();
            _refitTexts = texts;
        }
        _refit.Select(0);
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

        _building.Visible = Has("construction", out var job);
        if (_building.Visible)
        {
            _jobId = job.GetProperty("jobId").GetInt32();
            _buildBar.Value = job.GetProperty("progress").GetDouble();
            _buildText.Text = job.GetProperty("text").GetString();
            _prioritize.Visible = job.GetProperty("canPrioritize").GetBoolean();
            _cancelRefit.Visible = job.GetProperty("canCancel").GetBoolean();
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
        var canConnect = Has("connect", out var conn);
        if (canConnect)
        {
            _connectFinish = conn.GetProperty("finish").GetString();
            _connect.Text = $"Connect with a corridor ({conn.GetProperty("name").GetString()})";
        }
        FillModel(msg.GetProperty("model"), canConnect);
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
        _refitRow.Visible = Has("refit", out var refit);
        if (_refitRow.Visible) FillRefit(refit);
        _cropRow.Visible = Has("crop", out var crop);
        if (_cropRow.Visible) Options(_crop, crop, ref _cropIds);
        _holdsRow.Visible = Has("holds", out var holds);
        if (_holdsRow.Visible) Options(_holds, holds, ref _holdsIds);
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
