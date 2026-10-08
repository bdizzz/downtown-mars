import { useState } from "react";
import type { Snapshot } from "../sim/snapshot";
import { config } from "../sim/config";
import { num, signed } from "./format";
import { Sparkline, TrendChart, type ChartLine } from "./TrendChart";
import { everHad, perDay, points, RANGES, SERIES, seriesMeta, type Range, type SeriesMeta, seriesNum } from "./trends";

// Charts → Trends: how everything has been changing. One series up close
// (amounts, or change per day) over the last two days, ten days or the whole
// game; below it, every series as a sparkline to pick from.

type Mode = "amount" | "rate";

function linesFor(s: Snapshot, meta: SeriesMeta, range: Range, mode: Mode): { lines: ChartLine[]; ticks: number[] } {
  const h = s.history!;
  const tpd = config.ticksPerDay;
  let ticks: number[] = [];
  const lines = meta.lines.map((l) => {
    let p = points(h, l.id, range, tpd);
    if (mode === "rate") p = perDay(p, tpd, range === "all" ? 1 : 6);
    ticks = p.ticks;
    return { label: l.label, color: l.color, dashed: l.dashed, values: p.values };
  });
  return { lines, ticks };
}

export function TrendsPanel({ s, onClose, initial }: { s: Snapshot; onClose: () => void; initial?: string }) {
  const [key, setKey] = useState(initial ?? "happiness");
  const [range, setRange] = useState<Range>("10d");
  const [mode, setMode] = useState<Mode>("amount");
  const h = s.history;
  const meta = seriesMeta(key) ?? SERIES[0]!;
  const header = (
    <header>
      <h2>Trends</h2>
      <button onClick={onClose} aria-label="Close">
        ×
      </button>
    </header>
  );
  if (!h || !(h.hourly.population?.length ?? 0)) {
    return (
      <aside className="inspector trends">
        {header}
        <p className="k">Nothing recorded yet: the first sample comes within the game hour.</p>
      </aside>
    );
  }
  const flow = meta.key === "power:flow";
  const { lines, ticks } = linesFor(s, meta, range, mode);
  const daily = range === "all" && (h.daily[meta.lines[0]!.id]?.length ?? 0) >= 3;
  const main = lines[0]!.values;
  const first = main[0] ?? 0;
  const now = main.at(-1) ?? 0;
  const groups = [...new Set(SERIES.map((x) => x.group))];

  return (
    <aside className="inspector trends">
      {header}
      <div className="seg" role="group" aria-label="Time range">
        {RANGES.map((r) => (
          <button key={r.id} className={range === r.id ? "on" : ""} onClick={() => setRange(r.id)} title={r.hint} aria-pressed={range === r.id}>
            {r.label}
          </button>
        ))}
      </div>

      <h3 className="trend-title">{meta.label}</h3>
      {!flow && (
        <div className="seg small" role="group" aria-label="Show">
          <button className={mode === "amount" ? "on" : ""} onClick={() => setMode("amount")} aria-pressed={mode === "amount"}>
            Amount
          </button>
          <button className={mode === "rate" ? "on" : ""} onClick={() => setMode("rate")} aria-pressed={mode === "rate"} title="How fast it was rising or falling, per month">
            Change per month
          </button>
        </div>
      )}
      <TrendChart
        lines={lines}
        ticks={ticks}
        daily={daily}
        refs={mode === "rate" && !flow ? [{ at: 0, label: "steady" }] : meta.refs}
        unit={mode === "rate" && !flow ? "/month" : (meta.unit ?? "")}
        whole={mode === "amount" && meta.whole}
        decimals={mode === "amount" ? meta.decimals : undefined}
      />
      {mode === "amount" && (
        <p className="k trend-sum">
          {seriesNum(meta, first)} → {seriesNum(meta, now)}
          {meta.unit === "%" ? "%" : ""} ({signed(now - first)}) · low {seriesNum(meta, Math.min(...main))}, high {seriesNum(meta, Math.max(...main))}
        </p>
      )}

      {groups.map((g) => {
        const rows = SERIES.filter((x) => x.group === g && (!x.hideWhenEmpty || x.lines.some((l) => everHad(h, l.id))));
        if (!rows.length) return null;
        return (
          <section key={g} className="trend-group">
            <h3>{g}</h3>
            {rows.map((row) => {
              const r = linesFor(s, row, range, "amount");
              const v = r.lines[0]!.values;
              const delta = (v.at(-1) ?? 0) - (v[0] ?? 0);
              return (
                <button key={row.key} className={`trend-row${row.key === meta.key ? " on" : ""}`} onClick={() => setKey(row.key)} aria-pressed={row.key === meta.key}>
                  <span className="name">{row.label}</span>
                  <Sparkline lines={r.lines} width={96} height={22} />
                  <span className="val">
                    {seriesNum(row, v.at(-1) ?? 0)}
                    {row.unit === "%" ? "%" : ""}
                  </span>
                  <span className="delta">{Math.abs(delta) < 0.05 ? "·" : `${delta > 0 ? "▲" : "▼"} ${num(Math.abs(delta))}`}</span>
                </button>
              );
            })}
          </section>
        );
      })}
    </aside>
  );
}
