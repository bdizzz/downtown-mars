import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Snapshot } from "../sim/snapshot";
import { config } from "../sim/config";
import { signed } from "./format";
import { barItems, type BarItem } from "../view/hudItems";
import { Sparkline } from "./TrendChart";
import { points, seriesMeta } from "./trends";
import { monthsText } from "../view/months";

// The stocks a player watches (view/hudItems.ts). Pointing at one shows what it means and a sparkline
// of its last two days; clicking it opens Charts → Trends on it.

type OnTrend = (key: string) => void;

/** "Last 2 months", or "Last 5 hours" early on, for a span of ticks. */
function spanText(ticks: number): string {
  const hours = (ticks * 24) / config.ticksPerDay;
  return hours >= 24 ? `Last ${monthsText(hours / 24)}` : `Last ${Math.round(hours)} ${Math.round(hours) === 1 ? "hour" : "hours"}`;
}

/** The tooltip: a title, notes, and the series' last two days. */
function TipBody({ s, trend, title, notes }: { s: Snapshot; trend: string; title: string; notes: string[] }) {
  const meta = seriesMeta(trend);
  const h = s.history;
  const lines = meta && h ? meta.lines.map((l) => ({ label: l.label, color: l.color, dashed: l.dashed, values: points(h, l.id, "2d", config.ticksPerDay).values })) : [];
  const main = lines[0]?.values ?? [];
  const change = main.length > 1 ? main.at(-1)! - main[0]! : null;
  return (
    <>
      <strong>{title}</strong>
      {notes.map((n) => (
        <span key={n} className="tip-note">
          {n}
        </span>
      ))}
      {main.length > 1 ? (
        <>
          <Sparkline lines={lines} width={200} height={40} />
          {lines.length > 1 && (
            <span className="tip-legend">
              {lines.map((l) => (
                <i key={l.label} style={{ color: l.color }}>
                  {l.dashed ? "┄ " : "━ "}
                  {l.label}
                </i>
              ))}
            </span>
          )}
          <span className="tip-foot">
            {spanText((main.length - 1) * (h?.every ?? 10))}: {change !== null ? signed(change) : ""} · click for Trends
          </span>
        </>
      ) : (
        <span className="tip-foot">History builds up hour by hour · click for Trends</span>
      )}
    </>
  );
}

/** An item in the bar, with its tooltip and a click through to Trends. */
function Item({ s, trend, className, title, notes, onTrend, children }: { s: Snapshot; trend: string; className: string; title: string; notes: string[]; onTrend: OnTrend; children: ReactNode }) {
  const [at, setAt] = useState<DOMRect | null>(null);
  return (
    <span
      className={`${className} has-tip`}
      role="button"
      tabIndex={0}
      aria-label={`${title}: ${notes.join(". ")}`}
      onPointerEnter={(e) => setAt(e.currentTarget.getBoundingClientRect())}
      onPointerLeave={() => setAt(null)}
      onFocus={(e) => setAt(e.currentTarget.getBoundingClientRect())}
      onBlur={() => setAt(null)}
      onClick={() => {
        setAt(null);
        onTrend(trend);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTrend(trend);
        }
      }}
    >
      {children}
      {at &&
        createPortal(
          <div className="res-tip" style={{ left: Math.max(8, Math.min(at.left, window.innerWidth - 232)), top: at.bottom + 6 }} role="tooltip">
            <TipBody s={s} trend={trend} title={title} notes={notes} />
          </div>,
          document.body,
        )}
    </span>
  );
}

/** One item of the bar (view/hudItems.ts): label, value, and a rate or the like. */
function BarEntry({ item, s, onTrend }: { item: BarItem; s: Snapshot; onTrend: OnTrend }) {
  return (
    <Item s={s} trend={item.trend} className={`res${item.warn ? " warn" : ""}${item.full ? " full" : ""}`} title={item.title} notes={item.notes} onTrend={onTrend}>
      <span className="label">{item.label}</span>
      <span className="val">{item.value}</span>
      {item.rate && <span className={`rate${item.rate.tone ? ` ${item.rate.tone}` : ""}`}>{item.rate.text}</span>}
    </Item>
  );
}

export function ResourceBar({ s, onTrend }: { s: Snapshot | null; onTrend: OnTrend }) {
  if (!s) return <div className="resbar" />;
  return (
    <div className="resbar">
      {barItems(s).map((group, i) => (
        <span key={i} className="group">
          {group.map((item) => (
            <BarEntry key={item.trend} item={item} s={s} onTrend={onTrend} />
          ))}
        </span>
      ))}
    </div>
  );
}
