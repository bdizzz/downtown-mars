import type { History } from "../sim/history";
import { resourceDefs } from "../sim/resources";
import { CATEGORY_COLORS, cssColor } from "../render2d/palette";

// The charts' data: which series there are, how they're grouped and drawn,
// and the points for a time range, as amounts or as change per day.

export type Range = "2d" | "10d" | "all";
export const RANGES: { id: Range; label: string; hint: string }[] = [
  { id: "2d", label: "2 days", hint: "The last two days, hour by hour" },
  { id: "10d", label: "10 days", hint: "The last ten days, hour by hour" },
  { id: "all", label: "All", hint: "The whole game, a day at a time" },
];

export interface Points {
  values: number[];
  /** The tick each value belongs to (a day's average: the end of its day). */
  ticks: number[];
}

/** Hourly samples in a day, and in a range. */
const perDayOf = (h: History, tpd: number) => tpd / h.every;

/** One series over a range. "All" is daily averages, ending with the latest sample; with under three days, hourly. */
export function points(h: History, id: string, range: Range, tpd: number): Points {
  const hourly = h.hourly[id] ?? [];
  const hourTicks = (list: number[]) => list.map((_, i) => h.last - (list.length - 1 - i) * h.every);
  if (range === "all") {
    const daily = h.daily[id] ?? [];
    if (daily.length >= 3) {
      const ticks = daily.map((_, i) => h.dailyLast - (daily.length - 1 - i) * tpd);
      const last = hourly.at(-1);
      return last !== undefined && h.last > h.dailyLast ? { values: [...daily, last], ticks: [...ticks, h.last] } : { values: daily, ticks };
    }
    return { values: hourly, ticks: hourTicks(hourly) };
  }
  const n = range === "2d" ? 2 * perDayOf(h, tpd) : hourly.length;
  const values = hourly.slice(-n);
  return { values, ticks: hourTicks(values) };
}

/** Change per day between points, smoothed over a few of them (hourly changes are jumpy). */
export function perDay(p: Points, tpd: number, smooth = 1): Points {
  const { values, ticks } = p;
  if (values.length < 2) return { values: values.map(() => 0), ticks };
  const raw = values.map((_, i) => {
    const j = Math.max(1, i);
    return ((values[j]! - values[j - 1]!) * tpd) / Math.max(1, ticks[j]! - ticks[j - 1]!);
  });
  if (smooth <= 1) return { values: raw, ticks };
  const out = raw.map((_, i) => {
    const from = Math.max(0, i - smooth + 1);
    const win = raw.slice(from, i + 1);
    return win.reduce((a, b) => a + b, 0) / win.length;
  });
  return { values: out, ticks };
}

export interface Line {
  id: string;
  label: string;
  color: string;
  dashed?: boolean;
}

export interface SeriesMeta {
  /** What the row is (a series id, or a combined one like "power:flow"). */
  key: string;
  label: string;
  group: string;
  /** The series drawn: the first is the main one. */
  lines: Line[];
  unit?: string;
  /** Lines across the chart at meaningful values. */
  refs?: { at: number; label: string }[];
  /** Shown only once the hole has had some. */
  hideWhenEmpty?: boolean;
  /** Counts (people): whole numbers. */
  whole?: boolean;
}

const cat = (c: string) => cssColor(CATEGORY_COLORS[c] ?? 0xe07a3f);
const resName = (id: string) => resourceDefs.find((r) => r.id === id)?.name ?? id;
const res = (id: string, group: string, color: string, hideWhenEmpty = true): SeriesMeta => ({
  key: id,
  label: resName(id),
  group,
  lines: [{ id, label: resName(id), color }],
  hideWhenEmpty,
});

/** Every row in the charts, in order. */
export const SERIES: SeriesMeta[] = [
  {
    key: "population",
    label: "Colonists",
    group: "People",
    whole: true,
    lines: [
      { id: "population", label: "Colonists", color: "#e07a3f" },
      { id: "beds", label: "Beds", color: "#a88d7c", dashed: true },
    ],
  },
  {
    key: "happiness",
    label: "Happiness",
    group: "People",
    lines: [{ id: "happiness", label: "Happiness", color: "#f0c060" }],
    refs: [
      { at: 50, label: "full work, births" },
      { at: 45, label: "people leave below" },
    ],
  },
  { key: "health", label: "Health", group: "People", lines: [{ id: "health", label: "Health", color: "#d48092" }], refs: [{ at: 70, label: "warning" }] },
  {
    key: "employed",
    label: "Workers",
    group: "People",
    whole: true,
    lines: [
      { id: "employed", label: "Employed", color: "#6fb3c9" },
      { id: "workers", label: "Adults", color: "#a88d7c", dashed: true },
    ],
  },
  {
    key: "condition",
    label: "Condition",
    group: "People",
    unit: "%",
    lines: [{ id: "condition", label: "Condition", color: cat("services") }],
    refs: [
      { at: 50, label: "people unhappy" },
      { at: 30, label: "rooms slow" },
    ],
  },
  {
    key: "power:flow",
    label: "Power",
    group: "Power",
    unit: "/day",
    lines: [
      { id: "powerMade", label: "Made", color: cat("power") },
      { id: "powerUsed", label: "Used", color: "#e89a7a" },
    ],
  },
  { ...res("power", "Power", "#c9a456", false), label: "Battery" },
  res("o2", "Air", cat("air"), false),
  { ...res("co2", "Air", "#b0a090", false), refs: [{ at: 100, label: "harms health" }] },
  res("water", "Water", cat("water"), false),
  res("grayWater", "Water", "#8aa0a8"),
  res("blackWater", "Water", "#7a6a5e"),
  res("meals", "Food", cat("food"), false),
  res("rawFood", "Food", "#b8c060"),
  res("rations", "Food", "#d9a870"),
  res("soil", "Food", "#8a6a4a"),
  res("rock", "Materials", "#9c8a7a", false),
  res("brick", "Materials", "#c0604a"),
  res("marscrete", "Materials", "#a8a098"),
  res("glass", "Materials", "#a8d4f0"),
  res("fiber", "Materials", "#b9a36a"),
  res("metal", "Materials", "#b7bcc2"),
  res("machinery", "Materials", cat("industry")),
  res("electronics", "Materials", "#6fd0b0"),
  res("ore", "Materials", "#a0522d"),
  res("silica", "Materials", "#e0d8c0"),
  res("wafers", "Materials", "#9fb0e0"),
  res("organicWaste", "Waste", "#8a9a4a"),
  res("solidWaste", "Waste", "#8a7a6a"),
];

export const seriesMeta = (key: string) => SERIES.find((s) => s.key === key);

/** Has this series ever been above zero? */
export function everHad(h: History, id: string): boolean {
  return (h.daily[id] ?? []).some((v) => v > 0) || (h.hourly[id] ?? []).some((v) => v > 0);
}

/** A tidy scale for a chart's y axis: bounds rounded out to nice steps, and the ticks between. */
export function niceScale(lo: number, hi: number, ticks = 4): { lo: number; hi: number; step: number } {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { lo: 0, hi: 1, step: 0.25 };
  if (hi - lo < 1e-9) {
    const pad = Math.max(1, Math.abs(hi) * 0.1);
    lo -= pad;
    hi += pad;
  }
  const raw = (hi - lo) / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  return { lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step, step };
}
