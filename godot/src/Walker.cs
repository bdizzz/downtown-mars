using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text.Json;
using Godot;

namespace DowntownMars;

/// <summary>
/// Walking in first person, by the web game's rules (src/view/walk.ts) on the bridge's walking maps
/// (src/bridge/walkmap.ts): a walker stands on open ground (gallery tubes, corridors, public rooms,
/// dug-out space) or in a room, going between them only through doorways; furniture is in the way;
/// stairs climb a floor. Steps slide along whatever blocks them. A port of walk.ts's step, clear and
/// stairs, with regions looked up on the map's grid rather than worked out.
/// </summary>
public class Walker
{
    /// <summary>One floor's map.</summary>
    public class Map
    {
        public int Floor, LayoutVersion, Size;
        public float Half, Cell, Radius, Clearance;
        public ushort[] Grid = Array.Empty<ushort>();
        /// <summary>Per region: open ground (0), a room's id (room), or a doorway's room id (door).</summary>
        public (bool open, int room, int door)[] Regions = Array.Empty<(bool, int, int)>();
        public List<(Vector2[] corners, Rect2 box)> Obstacles = new();
        public List<Flight> Flights = new();

        public static Map Parse(JsonElement m)
        {
            var map = new Map
            {
                Floor = m.GetProperty("floor").GetInt32(),
                LayoutVersion = m.GetProperty("layoutVersion").GetInt32(),
                Size = m.GetProperty("size").GetInt32(),
                Half = m.GetProperty("half").GetSingle(),
                Cell = m.GetProperty("cell").GetSingle(),
                Radius = m.GetProperty("walkerRadius").GetSingle(),
                Clearance = m.GetProperty("furnitureClearance").GetSingle(),
            };
            map.Regions = m.GetProperty("regions").EnumerateArray().Select(r =>
            {
                var s = r.GetString() ?? "";
                if (s == "open") return (true, 0, 0);
                if (s.StartsWith("room:")) return (false, int.Parse(s[5..]), 0);
                if (s.StartsWith("door:")) return (false, 0, int.Parse(s[5..]));
                return (false, 0, 0);
            }).ToArray();
            var runs = MemoryMarshal.Cast<byte, ushort>(Convert.FromBase64String(m.GetProperty("runs").GetString()!)).ToArray();
            map.Grid = new ushort[map.Size * map.Size];
            var at = 0;
            for (var i = 0; i + 1 < runs.Length; i += 2)
            {
                Array.Fill(map.Grid, runs[i + 1], at, Math.Min(runs[i], map.Grid.Length - at));
                at += runs[i];
            }
            foreach (var o in m.GetProperty("obstacles").EnumerateArray())
            {
                var corners = o.EnumerateArray().Select(c => new Vector2(c[0].GetSingle(), c[1].GetSingle())).ToArray();
                float x0 = corners.Min(c => c.X), y0 = corners.Min(c => c.Y), x1 = corners.Max(c => c.X), y1 = corners.Max(c => c.Y);
                map.Obstacles.Add((corners, new Rect2(x0, y0, x1 - x0, y1 - y0)));
            }
            foreach (var f in m.GetProperty("flights").EnumerateArray())
            {
                Vector2 V(string k) => new(f.GetProperty(k)[0].GetSingle(), f.GetProperty(k)[1].GetSingle());
                map.Flights.Add(new Flight(V("foot"), V("up"), V("across"), f.GetProperty("length").GetSingle(), f.GetProperty("half").GetSingle()));
            }
            return map;
        }

        /// <summary>The region at a point: 0 for rock, the open shaft and rooms you can't walk in.</summary>
        public int RegionAt(float x, float z)
        {
            var i = (int)MathF.Floor((x + Half) / Cell);
            var j = (int)MathF.Floor((z + Half) / Cell);
            return i < 0 || j < 0 || i >= Size || j >= Size ? 0 : Grid[j * Size + i];
        }

        /// <summary>Can a walker in one region step straight into the other? Within a region, or through a doorway (walk.ts joined).</summary>
        public bool Joined(int a, int b)
        {
            if (a == 0 || b == 0) return false;
            if (a == b) return true;
            bool Door(int d, int o) => Regions[d].door != 0 && (Regions[o].open || Regions[o].room == Regions[d].door);
            return Door(a, b) || Door(b, a);
        }
    }

    public record Flight(Vector2 Foot, Vector2 Up, Vector2 Across, float Length, float Half);

    const float FloorH = 4, Crust = 3;
    /// <summary>How far onto a flight you can step at its foot (or head), as a share of its length.</summary>
    const float StairEntry = 0.15f;
    const int SlideNotch = 10, SlideMost = 85;

    readonly Dictionary<int, Map> _maps = new();
    public int Floor { get; private set; }
    public Vector2 At { get; private set; }

    public void SetMap(Map map) => _maps[map.Floor] = map;
    public bool Has(int floor) => _maps.ContainsKey(floor);
    public void Forget() => _maps.Clear();
    public IEnumerable<int> Floors => _maps.Keys;
    Map? MapOf(int floor) => _maps.GetValueOrDefault(floor);

    /// <summary>The floor's base height, and how high a walker stands above it: up a flight, by how far up (walk.ts stairLift).</summary>
    public float Height
    {
        get
        {
            var lift = 0f;
            if (MapOf(Floor) is Map map)
                foreach (var fl in map.Flights)
                {
                    var (s, off) = Along(fl, At);
                    if (s >= 0 && s <= 1 && MathF.Abs(off) <= fl.Half) { lift = s * FloorH; break; }
                }
            return -Floor * FloorH - Crust + lift;
        }
    }

    /// <summary>Stand here if there's room; otherwise the nearest clear spot within a few metres. False if none (or no map yet).</summary>
    public bool Place(int floor, Vector2 at)
    {
        if (MapOf(floor) is not Map map) return false;
        for (var r = 0f; r <= 6; r += 0.25f)
            for (var a = 0; a < (r == 0 ? 1 : 24); a++)
            {
                var p = at + new Vector2(MathF.Cos(a * MathF.Tau / 24), MathF.Sin(a * MathF.Tau / 24)) * r;
                if (!Clear(map, p)) continue;
                Floor = floor;
                At = p;
                return true;
            }
        return false;
    }

    /// <summary>Is there room for a walker here: its centre and the edge of its footprint in one region (or a doorway joining two), and clear of furniture?</summary>
    static bool Clear(Map map, Vector2 p)
    {
        var here = map.RegionAt(p.X, p.Y);
        if (here == 0) return false;
        var k = map.Radius;
        foreach (var d in new[] { new Vector2(k, 0), new Vector2(-k, 0), new Vector2(0, k), new Vector2(0, -k) })
            if (!map.Joined(here, map.RegionAt(p.X + d.X, p.Y + d.Y))) return false;
        return !AgainstFurniture(map, p);
    }

    static bool AgainstFurniture(Map map, Vector2 p)
    {
        var k = map.Clearance;
        foreach (var (corners, box) in map.Obstacles)
        {
            if (p.X < box.Position.X - k || p.X > box.End.X + k || p.Y < box.Position.Y - k || p.Y > box.End.Y + k) continue;
            if (Inside(corners, p)) return true;
            for (var i = 0; i < corners.Length; i++)
                if (SegmentDistance(p, corners[i], corners[(i + 1) % corners.Length]) < k) return true;
        }
        return false;
    }

    static bool Inside(Vector2[] q, Vector2 p)
    {
        var sign = 0f;
        for (var i = 0; i < q.Length; i++)
        {
            var a = q[i];
            var b = q[(i + 1) % q.Length];
            var cross = (b.X - a.X) * (p.Y - a.Y) - (b.Y - a.Y) * (p.X - a.X);
            if (cross == 0) continue;
            if (sign == 0) sign = MathF.Sign(cross);
            else if (MathF.Sign(cross) != sign) return false;
        }
        return true;
    }

    static float SegmentDistance(Vector2 p, Vector2 a, Vector2 b)
    {
        var d = b - a;
        var t = Math.Clamp((p - a).Dot(d) / Math.Max(d.LengthSquared(), 1e-9f), 0, 1);
        return (p - a - d * t).Length();
    }

    static (float s, float off) Along(Flight fl, Vector2 p)
    {
        var d = p - fl.Foot;
        return (d.Dot(fl.Up) / fl.Length, d.Dot(fl.Across));
    }

    static bool Over(Flight fl, (float s, float off) a, float radius) => a.s >= 0 && a.s <= 1 && MathF.Abs(a.off) < fl.Half + radius;
    static bool Between(Flight fl, (float s, float off) a, float radius) => MathF.Abs(a.off) <= fl.Half - radius;

    /// <summary>A step that has to do with stairs: the floor it lands on, -1 if the rails stop it, or null with no stairs about (walk.ts onStairs).</summary>
    int? OnStairs(Map map, Vector2 from, Vector2 to)
    {
        var r = map.Radius;
        foreach (var fl in map.Flights)
        {
            var now = Along(fl, from);
            if (!(now.s >= 0 && now.s <= 1 && Between(fl, now, r))) continue;
            var next = Along(fl, to);
            if (!Between(fl, next, r) && next.s >= 0 && next.s <= 1) return -1;
            if (next.s > 1) return MapOf(map.Floor - 1) is Map above && Clear(above, to) ? map.Floor - 1 : -1;
            if (next.s >= 0) return map.Floor;
            return null;
        }
        foreach (var fl in map.Flights)
        {
            var next = Along(fl, to);
            if (Over(fl, next, r)) return next.s <= StairEntry && Between(fl, next, r) ? map.Floor : -1;
        }
        if (MapOf(map.Floor + 1) is Map below)
            foreach (var fl in below.Flights)
            {
                var next = Along(fl, to);
                if (Over(fl, next, r)) return next.s >= 1 - StairEntry && Between(fl, next, r) ? map.Floor + 1 : -1;
            }
        return null;
    }

    /// <summary>
    /// Step by d, sliding along whatever's in the way (walk.ts step): the whole step if clear; else turned
    /// a notch at a time and shortened to what it moves along the obstacle; else part of it; else nowhere.
    /// Stairs take the walker up or down a floor. False if there's no map for this floor yet.
    /// </summary>
    public bool Step(Vector2 d)
    {
        if (MapOf(Floor) is not Map map) return false;
        if (d == Vector2.Zero) return true;
        var from = map.RegionAt(At.X, At.Y);
        int? To(Vector2 p)
        {
            var stairs = OnStairs(map, At, p);
            if (stairs is int f) return f < 0 ? null : f;
            if (!Clear(map, p)) return null;
            var there = map.RegionAt(p.X, p.Y);
            return from == 0 || map.Joined(from, there) ? map.Floor : null;
        }
        bool Try(Vector2 s)
        {
            if (To(At + s) is not int f) return false;
            At += s;
            Floor = f;
            return true;
        }
        if (Try(d)) return true;
        for (var deg = SlideNotch; deg <= SlideMost; deg += SlideNotch)
        {
            var a = Mathf.DegToRad(deg);
            var k = MathF.Cos(a);
            foreach (var sign in new[] { 1, -1 })
                if (Try(d.Rotated(sign * a) * k)) return true;
        }
        foreach (var part in new[] { 0.5f, 0.25f })
            if (Try(d * part)) return true;
        return true;
    }
}
