using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// The resource grid under the top bar, as the web's (ui/ResourceBar.tsx, its cells from the bridge's
/// hud.ts): the colony (colonists, health, happiness and its afterglow, condition, workers, power),
/// then life, food and materials, each a small cell of icon, value and a rising or falling arrow.
/// A worry is amber in a thin frame, trouble red in a thick filled one, full storage blue and
/// underlined, so the shape shows it as well as the colour. Pointing at one shows its name, what it
/// means and a sparkline of its last two days; clicking opens Charts → Trends on it.
/// </summary>
public partial class HudBar : HFlowContainer
{
    static readonly Color Muted = new("#a8927e"), Value = new("#f3e6d8"), Warn = new("#f4b860"), Bad = new("#ff8a6c"), Full = new("#8fc0ea"),
        Up = new("#9fd28a"), Down = new("#f08070"), Glow = new("#ffd27a");

    /// <summary>A trend clicked: open Charts → Trends on it.</summary>
    public Action<string>? Clicked { get; set; }
    string _shape = "";
    readonly Dictionary<string, Item> _items = new();

    /// <summary>Groups wrap onto another line when the window's too narrow, as the web's.</summary>
    public HudBar()
    {
        AddThemeConstantOverride("h_separation", 8);
        AddThemeConstantOverride("v_separation", 3);
    }

    /// <summary>The bridge's "hud" message: the grid's groups of cells.</summary>
    public void Set(JsonElement msg)
    {
        var groups = msg.GetProperty("groups").EnumerateArray().Select(g => g.EnumerateArray().ToArray()).ToArray();
        var shape = string.Join("|", groups.Select(g => string.Join(",", g.Select(i => i.GetProperty("id").GetString()))));
        if (shape != _shape)
        {
            _shape = shape;
            foreach (var c in GetChildren())
            {
                RemoveChild(c);
                c.QueueFree();
            }
            _items.Clear();
            var names = msg.TryGetProperty("groupNames", out var gn) ? gn.EnumerateArray().Select(n => n.GetString() ?? "").ToArray() : Array.Empty<string>();
            for (var gi = 0; gi < groups.Length; gi++)
            {
                var g = groups[gi];
                var name = gi < names.Length ? names[gi] : "";
                // Each section its own panel with a small label, as the web's: the section first, then the cell.
                var panel = new PanelContainer { Name = $"group_{name.ToLowerInvariant()}" };
                panel.AddThemeStyleboxOverride("panel", Section());
                AddChild(panel);
                var box = new HBoxContainer();
                box.AddThemeConstantOverride("separation", 1);
                panel.AddChild(box);
                var label = new Label { Text = name.ToUpperInvariant(), VerticalAlignment = VerticalAlignment.Center, MouseFilter = MouseFilterEnum.Ignore };
                label.AddThemeFontSizeOverride("font_size", 10);
                label.AddThemeColorOverride("font_color", Muted);
                label.AddThemeStyleboxOverride("normal", SectionLabel());
                box.AddChild(label);
                foreach (var i in g)
                {
                    var id = i.GetProperty("id").GetString()!;
                    // Stable names, as the web's data-hud ids, for the tutorial to find.
                    var item = new Item(this) { Name = id.Replace(":", "_") };
                    box.AddChild(item);
                    _items[id] = item;
                }
            }
        }
        foreach (var g in groups)
            foreach (var i in g)
                _items[i.GetProperty("id").GetString()!].Fill(i);
    }

    /// <summary>A section's panel: a faint fill and outline round its cells.</summary>
    static StyleBoxFlat Section()
    {
        var box = new StyleBoxFlat { BgColor = new Color(1, 1, 1, 0.03f), BorderColor = new Color(1, 1, 1, 0.11f), ContentMarginRight = 3, ContentMarginTop = 1, ContentMarginBottom = 1 };
        box.SetBorderWidthAll(1);
        box.SetCornerRadiusAll(5);
        return box;
    }

    /// <summary>A section's label: a darker tab at the panel's left, ruled off from its cells.</summary>
    static StyleBoxFlat SectionLabel()
    {
        var box = new StyleBoxFlat { BgColor = new Color(1, 1, 1, 0.04f), BorderColor = new Color(1, 1, 1, 0.11f), BorderWidthRight = 1, ContentMarginLeft = 7, ContentMarginRight = 7 };
        box.CornerRadiusTopLeft = box.CornerRadiusBottomLeft = 4;
        return box;
    }

    /// <summary>A cell's frame for its level: none, a thin amber frame, a thick red filled one, or a blue underline.</summary>
    static StyleBoxFlat Frame(string level)
    {
        var box = new StyleBoxFlat { BgColor = Colors.Transparent, ContentMarginLeft = 4, ContentMarginRight = 4, ContentMarginTop = 1, ContentMarginBottom = 1 };
        box.SetCornerRadiusAll(3);
        switch (level)
        {
            case "warn":
                box.BgColor = new Color(Warn, 0.08f);
                box.BorderColor = new Color(Warn, 0.6f);
                box.SetBorderWidthAll(1);
                break;
            case "bad":
                box.BgColor = new Color(Bad, 0.18f);
                box.BorderColor = Bad;
                box.SetBorderWidthAll(2);
                break;
            case "full":
                box.BorderColor = new Color(Full, 0.7f);
                box.BorderWidthBottom = 2;
                break;
        }
        return box;
    }

    /// <summary>One cell: icon, value, and an arrow or the afterglow, with its tooltip.</summary>
    partial class Item : PanelContainer
    {
        readonly HudBar _bar;
        readonly TextureRect _icon, _dir;
        readonly Label _value = new(), _sub = new();
        string _trend = "", _level = "";
        JsonElement _data;

        public Item(HudBar bar)
        {
            _bar = bar;
            MouseFilter = MouseFilterEnum.Stop;
            MouseDefaultCursorShape = CursorShape.PointingHand;
            CustomMinimumSize = new Vector2(62, 0);
            var row = new HBoxContainer { MouseFilter = MouseFilterEnum.Ignore };
            row.AddThemeConstantOverride("separation", 4);
            AddChild(row);
            _icon = Icons.Rect("rock", 16, Muted);
            row.AddChild(_icon);
            foreach (var (l, size) in new[] { (_value, 15), (_sub, 12) })
            {
                l.AddThemeFontSizeOverride("font_size", size);
                l.MouseFilter = MouseFilterEnum.Ignore;
                l.VerticalAlignment = VerticalAlignment.Center;
            }
            row.AddChild(_value);
            _dir = Icons.Rect("up", 9, Up);
            row.AddChild(_dir);
            _sub.AddThemeColorOverride("font_color", Glow);
            row.AddChild(_sub);
        }

        public void Fill(JsonElement i)
        {
            _data = i.Clone();
            _trend = i.GetProperty("trend").GetString()!;
            Icons.Show(_icon, i.GetProperty("icon").GetString()!);
            _value.Text = i.GetProperty("value").GetString();
            var level = i.GetProperty("level").GetString()!;
            var tone = level switch { "warn" => Warn, "bad" => Bad, "full" => Full, _ => Value };
            _value.AddThemeColorOverride("font_color", tone);
            _icon.Modulate = level == "ok" ? Muted : tone;
            if (level != _level)
            {
                _level = level;
                AddThemeStyleboxOverride("panel", Frame(level));
            }
            var hasSub = i.TryGetProperty("sub", out var sub);
            _sub.Visible = hasSub;
            if (hasSub) _sub.Text = sub.GetProperty("text").GetString();
            // The arrow keeps its room when steady, so the cells don't shuffle as rates come and go.
            var hasDir = i.TryGetProperty("dir", out var dir);
            _dir.Visible = !hasSub;
            _dir.SelfModulate = hasDir ? Colors.White : Colors.Transparent;
            if (hasDir)
            {
                var up = dir.GetString() == "up";
                Icons.Show(_dir, up ? "up" : "down");
                _dir.Modulate = up ? Up : Down;
            }
            // Something for Godot to show a tooltip for; the tooltip itself is made below.
            TooltipText = i.GetProperty("title").GetString();
        }

        public override void _GuiInput(InputEvent e)
        {
            if (e is InputEventMouseButton { ButtonIndex: MouseButton.Left, Pressed: true })
            {
                _bar.Clicked?.Invoke(_trend);
                AcceptEvent();
            }
        }

        /// <summary>The tooltip: a title, notes, and the series' last two days, as the web's.</summary>
        public override GodotObject _MakeCustomTooltip(string forText)
        {
            var panel = new PanelContainer();
            panel.AddThemeStyleboxOverride("panel", Live.Panel());
            var rows = new VBoxContainer();
            rows.AddThemeConstantOverride("separation", 3);
            panel.AddChild(rows);
            Label Line(string text, int size, Color color)
            {
                var l = new Label { Text = text, AutowrapMode = TextServer.AutowrapMode.WordSmart, CustomMinimumSize = new Vector2(220, 0) };
                l.AddThemeFontSizeOverride("font_size", size);
                l.AddThemeColorOverride("font_color", color);
                rows.AddChild(l);
                return l;
            }
            Line($"{_data.GetProperty("title").GetString()} · {_data.GetProperty("value").GetString()}", 15, Value);
            foreach (var n in _data.GetProperty("notes").EnumerateArray()) Line(n.GetString()!, 13, new Color("#e0cfbd"));
            var lines = _data.GetProperty("spark").EnumerateArray()
                .Select(l => (new Color(l.GetProperty("color").GetString()!), l.GetProperty("dashed").GetBoolean(), l.GetProperty("label").GetString()!, l.GetProperty("values").EnumerateArray().Select(v => v.GetSingle()).ToArray()))
                .ToList();
            var main = lines.FirstOrDefault().Item4 ?? Array.Empty<float>();
            if (main.Length > 1)
            {
                rows.AddChild(new Sparkline(lines.Select(l => (l.Item1, l.Item2, l.Item4)).ToList()) { CustomMinimumSize = new Vector2(220, 40) });
                if (lines.Count > 1) Line(string.Join("   ", lines.Select(l => $"{(l.Item2 ? "┄" : "━")} {l.Item3}")), 12, Muted);
                var change = main[^1] - main[0];
                Line($"{_data.GetProperty("span").GetString()}: {(change >= 0 ? "+" : "−")}{Live.Num(Math.Abs(change))} · click for Trends", 12, Muted);
            }
            else Line("History builds up hour by hour · click for Trends", 12, Muted);
            // Godot sizes the tooltip to this once it's shown; size the panel with it.
            panel.Ready += () => panel.CallDeferred(Control.MethodName.ResetSize);
            panel.CustomMinimumSize = new Vector2(244, 0);
            return panel;
        }
    }

    /// <summary>A small chart of a few lines over the same span, scaled together.</summary>
    partial class Sparkline : Control
    {
        readonly List<(Color color, bool dashed, float[] values)> _lines;

        public Sparkline(List<(Color, bool, float[])> lines) => _lines = lines;

        public override void _Draw()
        {
            var all = _lines.SelectMany(l => l.values).ToArray();
            if (all.Length < 2) return;
            float lo = all.Min(), hi = all.Max();
            if (hi - lo < 1e-3f) { lo -= 1; hi += 1; }
            foreach (var (color, dashed, values) in _lines)
            {
                if (values.Length < 2) continue;
                var pts = values.Select((v, i) => new Vector2(i / (float)(values.Length - 1) * Size.X, Size.Y - 2 - (v - lo) / (hi - lo) * (Size.Y - 4))).ToArray();
                if (dashed) DrawMultiline(pts.Zip(pts.Skip(1)).Where((_, i) => i % 2 == 0).SelectMany(p => new[] { p.First, p.Second }).ToArray(), color, 1.5f);
                else DrawPolyline(pts, color, 1.5f, true);
            }
        }
    }
}
