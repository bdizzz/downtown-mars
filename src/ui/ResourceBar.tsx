import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Snapshot } from "../sim/snapshot";
import { config } from "../sim/config";
import { signed } from "./format";
import { barItems, GROUPS, whyLines, type BarItem, type Why } from "../view/hudItems";
import { Sparkline } from "./TrendChart";
import { points, seriesMeta } from "./trends";
import { monthsText } from "../view/months";
import { Icon } from "./Icon";

// The resource grid: the stocks a player watches (view/hudItems.ts), each a small cell of icon,
// value and trend arrow, amber or red when it's a worry or trouble. Pointing at one shows its name,
// what it means and a sparkline of its last two days; clicking (or tapping) it opens Charts → Trends on it
// (Health and Happiness: the "Why?" panel).

type OnTrend = (key: string) => void;

/** "Last 2 months", or "Last 5 hours" early on, for a span of ticks. */
function spanText(ticks: number): string {
  const hours = (ticks * 24) / config.ticksPerDay;
  return hours >= 24 ? `Last ${monthsText(hours / 24)}` : `Last ${Math.round(hours)} ${Math.round(hours) === 1 ? "hour" : "hours"}`;
}

/** A card's reasons as a ledger: where it's heading, then each cause's points, a bar for its weight and its name, in groups, and the fix. */
function WhyLedger({ why }: { why: Why }) {
  return (
    <div className="tip-why">
      <span className="why-head">{why.head}</span>
      {why.groups.map((g) => (
        <div key={g.title} className="why-group">
          <span className="why-title">{g.title}</span>
          {g.rows.map((r) => (
            <span key={r.label} className={`why-row ${r.tone}`}>
              <b className="why-amt">{r.amount}</b>
              <span className="why-bar">
                <i style={{ width: `${Math.max(8, r.share * 100)}%` }} />
              </span>
              <span className="why-label">
                {r.label}
                {r.detail && <em> · {r.detail}</em>}
              </span>
            </span>
          ))}
        </div>
      ))}
      {why.fix && (
        <span className="why-fix">
          <b>Fix</b> {why.fix}
        </span>
      )}
    </div>
  );
}

/** The tooltip: a title, notes, its reasons, and the series' last two days. */
function TipBody({ s, trend, title, notes, why }: { s: Snapshot; trend: string; title: string; notes: string[]; why?: Why }) {
  const meta = seriesMeta(trend);
  const h = s.history;
  const lines = meta && h ? meta.lines.map((l) => ({ label: l.label, color: l.color, dashed: l.dashed, values: points(h, l.id, "2d", config.ticksPerDay).values })) : [];
  const main = lines[0]?.values ?? [];
  const change = main.length > 1 ? main.at(-1)! - main[0]! : null;
  // Health and Happiness open the "Why?" panel (F-018); the rest, Trends.
  const click = trend === "health" || trend === "happiness" ? "click for why" : "click for Trends";
  return (
    <>
      <strong>{title}</strong>
      {notes.map((n) => (
        <span key={n} className="tip-note">
          {n}
        </span>
      ))}
      {why && <WhyLedger why={why} />}
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
            {spanText((main.length - 1) * (h?.every ?? 10))}: {change !== null ? signed(change) : ""} · {click}
          </span>
        </>
      ) : (
        <span className="tip-foot">History builds up hour by hour · {click}</span>
      )}
    </>
  );
}

/** An item in the bar, with its tooltip and a click through to Trends. */
function Item({ s, id, trend, className, title, notes, why, onTrend, children }: { s: Snapshot; id: string; trend: string; className: string; title: string; notes: string[]; why?: Why; onTrend: OnTrend; children: ReactNode }) {
  const [at, setAt] = useState<DOMRect | null>(null);
  return (
    <span
      className={`${className} has-tip`}
      data-hud={id}
      role="button"
      tabIndex={0}
      aria-label={`${title}: ${[...notes, ...(why ? whyLines(why) : [])].join(". ")}`}
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
          <div className={`res-tip${why ? " wide" : ""}`} style={{ left: Math.max(8, Math.min(at.left, window.innerWidth - (why ? 272 : 232))), top: at.bottom + 6 }} role="tooltip">
            <TipBody s={s} trend={trend} title={title} notes={notes} why={why} />
          </div>,
          document.body,
        )}
    </span>
  );
}

/** One cell of the grid (view/hudItems.ts): icon, value, a rising or falling arrow, and the afterglow. Stocks keep
 *  the arrow's room when steady, so cells don't shuffle; the colony's stats have no arrows. */
function BarEntry({ item, s, onTrend, arrows }: { item: BarItem; s: Snapshot; onTrend: OnTrend; arrows: boolean }) {
  return (
    <Item s={s} id={item.id} trend={item.trend} className={`res ${item.level}`} title={`${item.title} · ${item.value}`} notes={item.notes} why={item.why} onTrend={onTrend}>
      <Icon id={item.icon} />
      <span className="val">{item.value}</span>
      {item.sub ? <span className={`rate ${item.sub.tone}`}>{item.sub.text}</span> : item.dir ? <Icon id={item.dir} size={9} className={`dir ${item.dir}`} /> : arrows && <span className="dir" />}
    </Item>
  );
}

/** `fresh`: just revealed by the guided tutorial (T-084), so it glows as it appears. */
export function ResourceBar({ s, onTrend, fresh = false }: { s: Snapshot | null; onTrend: OnTrend; fresh?: boolean }) {
  if (!s) return <div className="resbar" data-hud="resources" />;
  return (
    <div className={`resbar${fresh ? " fresh" : ""}`} data-hud="resources">
      {barItems(s).map((group, i) => (
        <span key={i} className="group" data-hud={`group:${GROUPS[i]!.toLowerCase()}`} role="group" aria-label={GROUPS[i]}>
          <span className="group-label" aria-hidden="true">
            {GROUPS[i]}
          </span>
          {/* Its own box so that on phones the cells wrap beside the label, not under it (T-140). */}
          <span className="group-cells">
            {group.map((item) => (
              <BarEntry key={item.id} item={item} s={s} onTrend={onTrend} arrows={i > 0} />
            ))}
          </span>
        </span>
      ))}
    </div>
  );
}
