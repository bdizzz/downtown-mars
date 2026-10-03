using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// The resource bar under the top bar, as the web's (ui/ResourceBar.tsx, its items from the bridge's
/// hud.ts): the colony (colonists and health, happiness and its afterglow, condition, workers, power),
/// then life, food and materials, each with its rate; amber when it's a worry, blue when storage is
/// full. Pointing at one shows what it means (health, happiness and what they come from; days left;
/// storage) with a sparkline of its last two days; clicking opens Charts → Trends on it.
/// </summary>
public partial class HudBar : HFlowContainer
{
    static readonly Color LabelColor = new("#b8a490"), Value = new("#f3e6d8"), Warn = new("#f0a030"), Full = new("#7fb3e0"),
        Neg = new("#f08070"), Pos = new("#9fd28a"), Glow = new("#ffd27a"), Muted = new("#a8927e");

    /// <summary>A trend clicked: open Charts → Trends on it.</summary>
    public Action<string>? Clicked { get; set; }
    string _shape = "";
    readonly Dictionary<string, Item> _items = new();

    /// <summary>Groups wrap onto another line when the window's too narrow, as the web's.</summary>
    public HudBar()
    {
        AddThemeConstantOverride("h_separation", 18);
        AddThemeConstantOverride("v_separation", 2);
    }

    /// <summary>The bridge's "hud" message: the bar's groups of items.</summary>
    public void Set(JsonElement msg)
    {
        var groups = msg.GetProperty("groups").EnumerateArray().Select(g => g.EnumerateArray().ToArray()).ToArray();
        var shape = string.Join("|", groups.Select(g => string.Join(",", g.Select(i => i.GetProperty("trend").GetString()))));
        if (shape != _shape)
        {
            _shape = shape;
            foreach (var c in GetChildren())
            {
                RemoveChild(c);
                c.QueueFree();
            }
            _items.Clear();
            foreach (var g in groups)
            {
                var box = new HBoxContainer();
                box.AddThemeConstantOverride("separation", 12);
                AddChild(box);
                foreach (var i in g)
                {
                    var item = new Item(this);
                    box.AddChild(item);
                    _items[i.GetProperty("trend").GetString()!] = item;
                }
            }
        }
        foreach (var g in groups)
            foreach (var i in g)
                _items[i.GetProperty("trend").GetString()!].Fill(i);
    }

    /// <summary>One item: label, value and rate, with its tooltip.</summary>
    partial class Item : HBoxContainer
    {
        readonly HudBar _bar;
        readonly Label _label = new(), _value = new(), _rate = new();
        string _trend = "";
        JsonElement _data;

        public Item(HudBar bar)
        {
            _bar = bar;
            AddThemeConstantOverride("separation", 4);
            MouseFilter = MouseFilterEnum.Stop;
            MouseDefaultCursorShape = CursorShape.PointingHand;
            foreach (var (l, size) in new[] { (_label, 14), (_value, 15), (_rate, 12) })
            {
                l.AddThemeFontSizeOverride("font_size", size);
                l.MouseFilter = MouseFilterEnum.Ignore;
                l.VerticalAlignment = VerticalAlignment.Center;
                AddChild(l);
            }
            _label.AddThemeColorOverride("font_color", LabelColor);
        }

        public void Fill(JsonElement i)
        {
            _data = i.Clone();
            _trend = i.GetProperty("trend").GetString()!;
            _label.Text = i.GetProperty("label").GetString();
            _value.Text = i.GetProperty("value").GetString();
            var warn = i.GetProperty("warn").GetBoolean();
            var full = i.GetProperty("full").GetBoolean();
            _value.AddThemeColorOverride("font_color", warn ? Warn : full ? Full : Value);
            _rate.Visible = i.TryGetProperty("rate", out var rate);
            if (_rate.Visible)
            {
                _rate.Text = rate.GetProperty("text").GetString();
                _rate.AddThemeColorOverride("font_color", rate.GetProperty("tone").GetString() switch { "neg" => Neg, "pos" => Pos, "glow" => Glow, _ => Muted });
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
            Line(_data.GetProperty("title").GetString()!, 15, Value);
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
