import { useState } from "react";
import { config } from "../sim/config";
import { gameTime } from "../sim/clock";
import { num } from "./format";
import { niceScale, seriesNum } from "./trends";

// Line charts drawn as SVG: a small sparkline for tooltips and rows, and a
// detailed chart with axes, reference lines and a readout under the pointer.

export interface ChartLine {
  label: string;
  color: string;
  values: number[];
  dashed?: boolean;
}

/** A few lines on a shared scale, no axes; the first gets a soft fill. */
export function Sparkline({ lines, width = 120, height = 28 }: { lines: ChartLine[]; width?: number; height?: number }) {
  const all = lines.flatMap((l) => l.values);
  if (all.length < 2) return <svg className="spark" width={width} height={height} />;
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (hi - lo < 1e-6) {
    lo -= 1;
    hi += 1;
  }
  const pad = 2;
  const x = (i: number, n: number) => pad + (i / Math.max(1, n - 1)) * (width - 2 * pad);
  const y = (v: number) => height - pad - ((v - lo) / (hi - lo)) * (height - 2 * pad);
  const path = (vs: number[]) => vs.map((v, i) => `${i ? "L" : "M"}${x(i, vs.length).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const first = lines[0]!;
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={`${path(first.values)}L${x(first.values.length - 1, first.values.length)},${height - pad}L${pad},${height - pad}Z`} fill={first.color} opacity={0.14} />
      {lines.map((l) => (
        <path key={l.label} d={path(l.values)} fill="none" stroke={l.color} strokeWidth={1.4} strokeDasharray={l.dashed ? "3 2" : undefined} strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/** "Day 12, 14:00" for a tick, or just "Day 12" for daily points. */
export function whenText(tick: number, daily = false): string {
  const t = gameTime(tick, config);
  return daily ? `Day ${t.day}` : `Day ${t.day}, ${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
}

interface TrendProps {
  lines: ChartLine[];
  ticks: number[];
  refs?: { at: number; label: string }[];
  unit?: string;
  daily?: boolean;
  /** Counts (people): whole numbers. */
  whole?: boolean;
  /** Places after the point for the readout (the air's %). */
  decimals?: number;
}

const W = 300;
const H = 170;
const M = { l: 38, r: 8, t: 8, b: 20 };

export function TrendChart({ lines, ticks, refs = [], unit = "", daily = false, whole = false, decimals }: TrendProps) {
  const fmt = (v: number) => seriesNum({ whole, decimals }, v);
  const [hover, setHover] = useState<number | null>(null);
  const n = ticks.length;
  const all = lines.flatMap((l) => l.values);
  if (n < 2 || !all.length) return <p className="k trend-empty">Not enough history yet: it builds up an hour at a time.</p>;
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  // Reference lines near the data are worth showing; far ones would squash it.
  const span = Math.max(1, hi - lo);
  const shown = refs.filter((r) => r.at >= lo - span * 0.6 && r.at <= hi + span * 0.6);
  for (const r of shown) {
    lo = Math.min(lo, r.at);
    hi = Math.max(hi, r.at);
  }
  if (lo >= 0 && lo < span * 0.3) lo = 0;
  const s = niceScale(lo, hi);
  // Axis labels as precise as the steps between them (20.6, 20.8, 21 rather than 21, 21, 21).
  const axisPlaces = Math.max(0, Math.min(3, -Math.floor(Math.log10(s.step) + 1e-9)));
  const axisNum = (v: number) => (axisPlaces > 0 && Math.abs(v) < 1000 ? String(Number(v.toFixed(axisPlaces))) : num(v));
  const t0 = ticks[0]!;
  const t1 = ticks[n - 1]!;
  const x = (t: number) => M.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - M.l - M.r);
  const y = (v: number) => H - M.b - ((v - s.lo) / (s.hi - s.lo)) * (H - M.t - M.b);
  const path = (vs: number[]) => vs.map((v, i) => `${i ? "L" : "M"}${x(ticks[i]!).toFixed(1)},${y(v).toFixed(1)}`).join("");
  // The fill runs to zero where zero's on the chart (a rise and fall around it), else to the bottom.
  const base = Math.min(s.hi, Math.max(s.lo, 0));
  const yTicks: number[] = [];
  for (let v = s.lo; v <= s.hi + s.step * 0.01; v += s.step) yTicks.push(v);
  // A few day marks along the bottom.
  const tpd = config.ticksPerDay;
  const days = (t1 - t0) / tpd;
  const every = days <= 3 ? 0.5 : days <= 12 ? 2 : Math.ceil(days / 5 / 5) * 5;
  const xTicks: number[] = [];
  for (let d = Math.ceil(t0 / (every * tpd)) * every; d * tpd <= t1; d += every) xTicks.push(d * tpd);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const t = t0 + ((px - M.l) / (W - M.l - M.r)) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(ticks[i]! - t) < Math.abs(ticks[best]! - t)) best = i;
    setHover(best);
  };
  const at = hover ?? n - 1;

  return (
    <div className="trend">
      <p className="trend-readout">
        <span className="k">{hover === null ? "Now" : whenText(ticks[at]!, daily && at < n - 1)}</span>
        {lines.map((l) => (
          <span key={l.label} style={{ color: l.color }}>
            {lines.length > 1 ? `${l.label} ` : ""}
            {fmt(l.values[at] ?? 0)}
            {unit}
          </span>
        ))}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="trend-svg" onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label={`${lines.map((l) => l.label).join(" and ")} over time`}>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} className="grid" />
            <text x={M.l - 4} y={y(v) + 3} className="axis" textAnchor="end">
              {axisNum(v)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => {
          const g = gameTime(t, config);
          return (
            <text key={t} x={x(t)} y={H - 5} className="axis" textAnchor="middle">
              {days <= 3 ? `D${g.day} ${String(g.hour).padStart(2, "0")}h` : `D${g.day}`}
            </text>
          );
        })}
        {shown.map((r) => (
          <g key={r.label}>
            <line x1={M.l} x2={W - M.r} y1={y(r.at)} y2={y(r.at)} className="ref" />
            <text x={W - M.r - 2} y={y(r.at) - 3} className="ref-label" textAnchor="end">
              {r.label}
            </text>
          </g>
        ))}
        <path d={`${path(lines[0]!.values)}L${x(t1)},${y(base)}L${x(t0)},${y(base)}Z`} fill={lines[0]!.color} opacity={0.12} />
        {lines.map((l) => (
          <path key={l.label} d={path(l.values)} fill="none" stroke={l.color} strokeWidth={1.6} strokeDasharray={l.dashed ? "4 3" : undefined} strokeLinejoin="round" />
        ))}
        {hover !== null && (
          <g>
            <line x1={x(ticks[at]!)} x2={x(ticks[at]!)} y1={M.t} y2={H - M.b} className="cursor" />
            {lines.map((l) => (
              <circle key={l.label} cx={x(ticks[at]!)} cy={y(l.values[at] ?? 0)} r={2.8} fill={l.color} />
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
