import { config } from "../sim/config";
import { averageFlows } from "../sim/ledger";
import type { SimState } from "../sim/state";
import { gameTime } from "../sim/clock";
import { num, signed } from "../ui/format";
import { everHad, perDay, points, RANGES, SERIES, seriesMeta, seriesNum, type Range, type SeriesMeta } from "../ui/trends";
import { FLOW_TABS, flowColor, river, waterNote } from "../view/flows";

// The Godot viewer's charts, worked out as the web's are (ui/trends.ts, ui/TrendsPanel.tsx and
// view/flows.ts): trends for one series up close, with every series as a sparkline to pick from;
// and the flow panel's rivers for a tab. Godot only draws them.

type Mode = "amount" | "rate";

/** At most this many points per sparkline (the rows are small). */
const SPARK_POINTS = 48;

const when = (tick: number, daily: boolean) => {
  const t = gameTime(tick, config);
  return daily ? `Day ${t.day}` : `Day ${t.day}, ${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
};

function linesFor(state: SimState, meta: SeriesMeta, range: Range, mode: Mode) {
  const h = state.history!;
  const tpd = config.ticksPerDay;
  let ticks: number[] = [];
  const lines = meta.lines.map((l) => {
    let p = points(h, l.id, range, tpd);
    if (mode === "rate") p = perDay(p, tpd, range === "all" ? 1 : 6);
    ticks = p.ticks;
    return { label: l.label, color: l.color, dashed: !!l.dashed, values: p.values };
  });
  return { lines, ticks };
}

const thin = (values: number[]) => {
  if (values.length <= SPARK_POINTS) return values;
  const step = values.length / SPARK_POINTS;
  return Array.from({ length: SPARK_POINTS }, (_, i) => values[Math.min(values.length - 1, Math.round(i * step))]!);
};

export interface TrendsMessage {
  type: "trends";
  key: string;
  range: Range;
  mode: Mode;
  ranges: { id: Range; label: string }[];
  empty?: string;
  title?: string;
  /** Whether this series can be shown as change per day (not the power flow, already per day). */
  rates?: boolean;
  chart?: { lines: { label: string; color: string; dashed: boolean; values: number[] }[]; from: string; to: string; refs: { at: number; label: string }[]; unit: string; whole: boolean };
  sum?: string;
  groups?: { name: string; rows: { key: string; label: string; lines: { color: string; dashed: boolean; values: number[] }[]; value: string; delta: string }[] }[];
}

export function trends(state: SimState, key: string, range: Range, mode: Mode): TrendsMessage {
  const base = { type: "trends" as const, key, range, mode, ranges: RANGES.map((r) => ({ id: r.id, label: r.label })) };
  const h = state.history;
  if (!h || !(h.hourly.population?.length ?? 0)) return { ...base, empty: "Nothing recorded yet: the first sample comes within the game hour." };
  const meta = seriesMeta(key) ?? SERIES[0]!;
  const flow = meta.key === "power:flow";
  const shown = flow ? "amount" : mode;
  const { lines, ticks } = linesFor(state, meta, range, shown);
  const daily = range === "all" && (h.daily[meta.lines[0]!.id]?.length ?? 0) >= 3;
  const main = lines[0]!.values;
  const first = main[0] ?? 0;
  const now = main.at(-1) ?? 0;
  const groups = [...new Set(SERIES.map((x) => x.group))].map((g) => ({
    name: g,
    rows: SERIES.filter((x) => x.group === g && (!x.hideWhenEmpty || x.lines.some((l) => everHad(h, l.id)))).map((row) => {
      const r = linesFor(state, row, range, "amount");
      const v = r.lines[0]!.values;
      const delta = (v.at(-1) ?? 0) - (v[0] ?? 0);
      return {
        key: row.key,
        label: row.label,
        lines: r.lines.map((l) => ({ color: l.color, dashed: l.dashed, values: thin(l.values) })),
        value: `${seriesNum(row, v.at(-1) ?? 0)}${row.unit === "%" ? "%" : ""}`,
        delta: Math.abs(delta) < 0.05 ? "·" : `${delta > 0 ? "▲" : "▼"} ${num(Math.abs(delta))}`,
      };
    }),
  }));
  return {
    ...base,
    mode: shown,
    key: meta.key,
    title: meta.label,
    rates: !flow,
    chart: {
      lines,
      from: ticks.length ? when(ticks[0]!, daily) : "",
      to: ticks.length ? when(ticks.at(-1)!, daily) : "",
      refs: shown === "rate" ? [{ at: 0, label: "steady" }] : (meta.refs ?? []),
      unit: shown === "rate" ? "/day" : (meta.unit ?? ""),
      whole: shown === "amount" && !!meta.whole,
    },
    sum: shown === "amount" ? `${seriesNum(meta, first)} → ${seriesNum(meta, now)}${meta.unit === "%" ? "%" : ""} (${signed(now - first)}) · low ${seriesNum(meta, Math.min(...main))}, high ${seriesNum(meta, Math.max(...main))}` : undefined,
    groups: groups.filter((g) => g.rows.length),
  };
}

export interface FlowsMessage {
  type: "flows";
  tab: string;
  tabs: { id: string; name: string }[];
  note: string;
  recycled?: string;
  rivers: { name: string; summary: string; empty?: string; ins: { label: string; value: number; color: string }[]; outs: { label: string; value: number; color: string }[] }[];
}

export function flows(state: SimState, tab: string): FlowsMessage {
  const f = averageFlows(state, config);
  const current = FLOW_TABS.find((t) => t.id === tab) ?? FLOW_TABS[0]!;
  const water = current.id === "water" ? waterNote(f) : null;
  return {
    type: "flows",
    tab: current.id,
    tabs: FLOW_TABS.map((t) => ({ id: t.id, name: t.name })),
    note: `Per game day, averaged over the last ${config.economy.ledgerDays} days. Overflow is what was made or delivered with nowhere to store it.`,
    ...(water !== null ? { recycled: water } : {}),
    rivers: current.resources.map((r) => {
      const rv = river(r, f[r]);
      const stock = state.resources[r] ?? 0;
      const net = rv.totalIn - rv.totalOut;
      const empty = !rv.ins.length && !rv.outs.length;
      return {
        name: rv.name,
        summary: empty ? "" : `in ${num(rv.totalIn)} · out ${num(rv.totalOut)} a day · ${net >= 0 ? "+" : "−"}${num(Math.abs(net))} net · ${num(stock)} stored`,
        ...(empty ? { empty: `Nothing moving yet. In store: ${num(stock)}` } : {}),
        ins: rv.ins.map(([label, value]) => ({ label, value, color: flowColor(label) })),
        outs: rv.outs.map(([label, value]) => ({ label, value, color: flowColor(label) })),
      };
    }),
  };
}
