using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// The game's choices, as the web's: event cards (ui/EventCards.tsx), one each at the top left with
/// its choices and how long you have, the game running on; and the office (ui/Office.tsx), a panel
/// with who's waiting and the answers you can give, promises, ordinances and notables (from the
/// bridge's office.ts). Answers go to the sim as commands.
/// </summary>
public partial class Choices : Node
{
    static readonly Dictionary<string, string> Icon = new()
    {
        ["aquifer"] = "💧", ["ore_vein"] = "⛏", ["silica_bed"] = "◇", ["lava_tube"] = "◠",
        ["gas_pocket"] = "⚠", ["microfossils"] = "✶", ["belt_ship"] = "🛰", ["celebration"] = "✦",
    };

    readonly Action<Dictionary<string, object>> _command;
    readonly VBoxContainer _cards = new();
    readonly PanelContainer _office = new();
    readonly VBoxContainer _officeRows = new();
    readonly Dictionary<int, Label> _countdowns = new();
    readonly VBoxContainer _news = new();
    static readonly System.Text.RegularExpressions.Regex RoomToken = new(@"\[\[room:\d+\|([^|\]]*)\|([^\]]*)\]\]");
    string _cardsKey = "";
    int _ticksPerDay = 240;

    /// <summary>Opened: the room panel closes (they share the right side).</summary>
    public Action? OfficeOpened { get; set; }
    public bool OfficeOpen => _office.Visible;
    public int Waiting { get; private set; }

    public Choices(CanvasLayer hud, Action<Dictionary<string, object>> command)
    {
        _command = command;
        _cards.Position = new Vector2(10, 100);
        // Kept just under the top bar, however tall it wraps (Live).
        _cards.SetMeta("under_top", true);
        _cards.AddThemeConstantOverride("separation", 8);
        hud.AddChild(_cards);

        // News, as the web's messages: the latest few, fading over a game day, at the bottom right.
        _news.SetAnchorsPreset(Control.LayoutPreset.BottomRight);
        _news.GrowHorizontal = Control.GrowDirection.Begin;
        _news.GrowVertical = Control.GrowDirection.Begin;
        _news.Position = new Vector2(-470, -100);
        _news.Alignment = BoxContainer.AlignmentMode.End;
        _news.AddThemeConstantOverride("separation", 4);
        hud.AddChild(_news);

        _office.Visible = false;
        _office.SetAnchorsPreset(Control.LayoutPreset.TopRight);
        _office.GrowHorizontal = Control.GrowDirection.Begin;
        _office.Position = new Vector2(-400, 100);
        _office.SetMeta("under_top", true);
        _office.AddThemeStyleboxOverride("panel", Live.Panel());
        hud.AddChild(_office);
        var scroll = new ScrollContainer { CustomMinimumSize = new Vector2(370, 640), HorizontalScrollMode = ScrollContainer.ScrollMode.Disabled };
        _office.AddChild(scroll);
        _officeRows.AddThemeConstantOverride("separation", 6);
        _officeRows.CustomMinimumSize = new Vector2(350, 0);
        scroll.AddChild(_officeRows);
    }

    public void ToggleOffice(bool? open = null)
    {
        _office.Visible = open ?? !_office.Visible;
        if (_office.Visible) OfficeOpened?.Invoke();
    }

    static Label Text(string text, int size, Color color, bool wrap = true)
    {
        var l = new Label { Text = text };
        l.AddThemeFontSizeOverride("font_size", size);
        l.AddThemeColorOverride("font_color", color);
        if (wrap)
        {
            l.AutowrapMode = TextServer.AutowrapMode.WordSmart;
            l.CustomMinimumSize = new Vector2(330, 0);
        }
        return l;
    }

    static readonly Color Title = new("#e8834a"), Body = new("#f3e6d8"), Muted = new("#b8a490"), Warn = new("#f0a030");

    Button Choice(string label, string hint, string? refusal, Action pressed)
    {
        var b = new Button
        {
            Text = $"{label}\n{refusal ?? hint}",
            Disabled = refusal != null,
            TooltipText = refusal ?? hint,
            Alignment = HorizontalAlignment.Left,
            AutowrapMode = TextServer.AutowrapMode.WordSmart,
            CustomMinimumSize = new Vector2(330, 0),
            FocusMode = Control.FocusModeEnum.None,
        };
        b.AddThemeFontSizeOverride("font_size", 13);
        b.Pressed += pressed;
        return b;
    }

    string Left(int ticks)
    {
        var h = (float)ticks / _ticksPerDay * 24;
        return h >= 24 ? $"{h / 24:0.0} days" : $"{Math.Max(1, Mathf.RoundToInt(h))} h";
    }

    /// <summary>The snapshot's pending events: a card each (rebuilt when they or their choices change; the time left ticks down).</summary>
    public void SetEvents(JsonElement snapshot, int ticksPerDay)
    {
        _ticksPerDay = ticksPerDay;
        var tick = snapshot.GetProperty("tick").GetInt32();
        var pending = snapshot.GetProperty("events").GetProperty("pending");
        var key = string.Join("|", pending.EnumerateArray().Select(e => $"{e.GetProperty("id").GetInt32()}:{string.Join(",", e.GetProperty("choices").EnumerateArray().Select(c => c.GetProperty("refusal").ValueKind == JsonValueKind.String))}"));
        if (key != _cardsKey)
        {
            _cardsKey = key;
            foreach (var c in _cards.GetChildren()) c.QueueFree();
            _countdowns.Clear();
            foreach (var e in pending.EnumerateArray())
            {
                var id = e.GetProperty("id").GetInt32();
                var card = new PanelContainer();
                card.AddThemeStyleboxOverride("panel", Live.Panel());
                var rows = new VBoxContainer();
                rows.AddThemeConstantOverride("separation", 6);
                card.AddChild(rows);
                rows.AddChild(Text($"{Icon.GetValueOrDefault(e.GetProperty("kind").GetString()!, "!")}  {e.GetProperty("title").GetString()}", 17, Title));
                rows.AddChild(Text(e.GetProperty("text").GetString()!, 14, Body));
                foreach (var c in e.GetProperty("choices").EnumerateArray())
                {
                    var choice = c.GetProperty("id").GetString()!;
                    var refusal = c.GetProperty("refusal").ValueKind == JsonValueKind.String ? c.GetProperty("refusal").GetString() : null;
                    rows.AddChild(Choice(c.GetProperty("label").GetString()!, c.GetProperty("hint").GetString()!, refusal,
                        () => _command(new() { ["type"] = "answerEvent", ["eventId"] = id, ["choice"] = choice })));
                }
                var countdown = Text("", 13, Muted);
                rows.AddChild(countdown);
                _countdowns[id] = countdown;
                _cards.AddChild(card);
            }
        }
        foreach (var e in pending.EnumerateArray())
            if (_countdowns.TryGetValue(e.GetProperty("id").GetInt32(), out var label))
                label.Text = $"Decide within {Left(e.GetProperty("expiresTick").GetInt32() - tick)}";
    }

    string _newsKey = "";

    /// <summary>The snapshot's messages: the latest four from the last game day, fading as they age.</summary>
    public void SetMessages(JsonElement snapshot, int ticksPerDay)
    {
        var tick = snapshot.GetProperty("tick").GetInt32();
        var holeId = snapshot.GetProperty("holeId").GetInt32();
        var recent = snapshot.GetProperty("messages").EnumerateArray().Where(m => tick - m.GetProperty("tick").GetInt32() < ticksPerDay).TakeLast(4).ToList();
        var key = string.Join("|", recent.Select(m => $"{m.GetProperty("tick").GetInt32()}:{m.GetProperty("text").GetString()}"));
        if (key != _newsKey)
        {
            _newsKey = key;
            foreach (var c in _news.GetChildren())
            {
                _news.RemoveChild(c);
                c.QueueFree();
            }
            foreach (var m in recent)
            {
                var text = RoomToken.Replace(m.GetProperty("text").GetString()!, x => x.Groups[2].Value == "S" ? $"{x.Groups[1].Value} (surface)" : $"{x.Groups[1].Value} (F{x.Groups[2].Value})");
                if (m.TryGetProperty("holeId", out var h) && h.GetInt32() != holeId && m.TryGetProperty("holeName", out var name)) text = $"{name.GetString()}: {text}";
                var kind = m.GetProperty("kind").GetString();
                var label = Text(text, 14, kind == "warn" ? Warn : kind == "good" ? new Color("#9fd28a") : Body);
                label.CustomMinimumSize = new Vector2(440, 0);
                label.HorizontalAlignment = HorizontalAlignment.Right;
                label.AddThemeColorOverride("font_shadow_color", new Color(0, 0, 0, 0.8f));
                label.AddThemeConstantOverride("shadow_offset_x", 1);
                label.AddThemeConstantOverride("shadow_offset_y", 1);
                label.SetMeta("tick", m.GetProperty("tick").GetInt32());
                _news.AddChild(label);
            }
        }
        // Fading out over the day, as the web's.
        foreach (var label in _news.GetChildren().OfType<Label>())
            label.Modulate = new Color(1, 1, 1, 1 - Mathf.Pow((float)(tick - label.GetMeta("tick").AsInt32()) / ticksPerDay, 3));
    }

    /// <summary>The bridge's office view.</summary>
    public void SetOffice(JsonElement msg)
    {
        Waiting = msg.GetProperty("waiting").GetArrayLength();
        foreach (var c in _officeRows.GetChildren())
        {
            _officeRows.RemoveChild(c);
            c.QueueFree();
        }
        var head = new HBoxContainer();
        var title = Text("Administration", 20, Title, false);
        title.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        head.AddChild(title);
        var close = new Button { Text = "×", Flat = true, FocusMode = Control.FocusModeEnum.None };
        close.Pressed += () => ToggleOffice(false);
        head.AddChild(close);
        _officeRows.AddChild(head);

        _officeRows.AddChild(Text("Waiting room", 16, Body));
        if (Waiting == 0) _officeRows.AddChild(Text("Nobody is waiting.", 13, Muted));
        foreach (var v in msg.GetProperty("waiting").EnumerateArray())
        {
            var id = v.GetProperty("id").GetInt32();
            _officeRows.AddChild(Text(v.GetProperty("who").GetString()!, 15, Title));
            _officeRows.AddChild(Text(v.GetProperty("about").GetString()!, 12, Muted));
            _officeRows.AddChild(Text(v.GetProperty("title").GetString()!, 14, Body));
            _officeRows.AddChild(Text(v.GetProperty("text").GetString()!, 13, Body));
            _officeRows.AddChild(Text(v.GetProperty("leaves").GetString()!, 12, Muted));
            foreach (var c in v.GetProperty("choices").EnumerateArray())
            {
                var choice = c.GetProperty("id").GetString()!;
                var refusal = c.GetProperty("refusal").ValueKind == JsonValueKind.String ? c.GetProperty("refusal").GetString() : null;
                _officeRows.AddChild(Choice(c.GetProperty("label").GetString()!, c.GetProperty("hint").GetString()!, refusal,
                    () => _command(new() { ["type"] = "answerVisit", ["visitId"] = id, ["choice"] = choice })));
            }
        }

        var promises = msg.GetProperty("promises");
        if (promises.GetArrayLength() > 0)
        {
            _officeRows.AddChild(Text("Promises", 16, Body));
            foreach (var p in promises.EnumerateArray()) _officeRows.AddChild(Text(p.GetString()!, 13, Body));
        }

        var slots = msg.GetProperty("slots");
        _officeRows.AddChild(Text($"Ordinances  ·  {slots.GetProperty("used").GetInt32()}/{slots.GetProperty("of").GetInt32()} slots", 16, Body));
        foreach (var o in msg.GetProperty("ordinances").EnumerateArray())
        {
            var id = o.GetProperty("id").GetString()!;
            var on = o.GetProperty("on").GetBoolean();
            var refusal = o.GetProperty("refusal").ValueKind == JsonValueKind.String ? o.GetProperty("refusal").GetString() : null;
            var row = new HBoxContainer();
            var words = new VBoxContainer { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
            var name = Text(o.GetProperty("name").GetString()!, 14, on ? new Color("#9fd28a") : Body);
            name.CustomMinimumSize = new Vector2(250, 0);
            var desc = Text(o.GetProperty("description").GetString()!, 12, Muted);
            desc.CustomMinimumSize = new Vector2(250, 0);
            words.AddChild(name);
            words.AddChild(desc);
            row.AddChild(words);
            var b = new Button { Text = on ? "Repeal" : "Enact", Disabled = refusal != null, TooltipText = refusal ?? "", FocusMode = Control.FocusModeEnum.None };
            b.Pressed += () => _command(new() { ["type"] = "setOrdinance", ["id"] = id, ["enacted"] = !on });
            row.AddChild(b);
            _officeRows.AddChild(row);
        }

        _officeRows.AddChild(Text("Notables", 16, Body));
        foreach (var n in msg.GetProperty("notables").EnumerateArray())
            _officeRows.AddChild(Text($"{n.GetProperty("name").GetString()}  ·  loyalty {n.GetProperty("loyalty").GetInt32()}\n{n.GetProperty("about").GetString()}", 13, Body));
    }
}
