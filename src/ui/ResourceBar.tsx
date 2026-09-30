import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Snapshot } from "../sim/snapshot";
import { config } from "../sim/config";
import { daysLeft, num, resName, signed } from "./format";
import { isStorable } from "../sim/storage";
import { Sparkline } from "./TrendChart";
import { points, seriesMeta } from "./trends";

// The stocks a player watches, left to right: life, then food, then materials.
// Pointing at one shows what it means and a sparkline of its last two days;
// clicking it opens Charts → Trends on it.
const LIFE = ["o2", "water", "meals"] as const;
const FOOD = ["rations", "rawFood", "soil"] as const;
const MATERIALS = ["rock", "brick", "metal", "machinery", "electronics"] as const;
/** Shown only where there's some: they come from the ground under certain sites. */
const REGIONAL = ["ore", "silica"] as const;
const WARN_DAYS = 2;
/** Storage this full, with more coming in, shows as full. */
const FULL_AT = 0.97;

type OnTrend = (key: string) => void;

/** "Last 2 days", or "Last 5 hours" early on, for a span of ticks. */
function spanText(ticks: number): string {
  const hours = (ticks * 24) / config.ticksPerDay;
  return hours >= 24 ? `Last ${Math.round(hours / 24)} ${Math.round(hours / 24) === 1 ? "day" : "days"}` : `Last ${Math.round(hours)} ${Math.round(hours) === 1 ? "hour" : "hours"}`;
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

function Stock({ id, s, onTrend }: { id: string; s: Snapshot; onTrend: OnTrend }) {
  const v = s.resources[id] ?? 0;
  const cap = s.capacities[id] ?? 0;
  const rate = s.rates[id] ?? 0;
  const left = daysLeft(v, rate);
  const warn = left !== null && left < WARN_DAYS;
  // Dry goods: storage may be full (what arrives is lost) or missing altogether.
  const stored = isStorable(id) && Number.isFinite(cap);
  const full = stored && cap > 0 && v >= cap * FULL_AT && rate > 0;
  const none = stored && cap <= 0;
  const notes = [
    `${num(v)} of ${num(cap)} · ${signed(rate)} a day`,
    ...(left !== null ? [`Runs out in ${left.toFixed(1)} days`] : []),
    ...(!stored ? [] : none ? ["No storage set aside for it"] : full ? ["Storage full: more is lost"] : []),
  ];
  return (
    <Item s={s} trend={id} className={`res${warn ? " warn" : ""}${full || (none && rate > 0) ? " full" : ""}`} title={resName(id)} notes={notes} onTrend={onTrend}>
      <span className="label">{resName(id)}</span>
      <span className="val">{num(v)}</span>
      {Math.abs(rate) >= 0.05 && <span className={`rate ${rate < 0 ? "neg" : "pos"}`}>{signed(rate)}</span>}
    </Item>
  );
}

/** "38 adults, 4 children, 2 elders", leaving out stages nobody is in yet. */
function stagesText(st: { child: number; adult: number; elder: number }): string {
  const parts = [
    [st.adult, "adult", "adults"],
    [st.child, "child", "children"],
    [st.elder, "elder", "elders"],
  ] as const;
  return parts
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`)
    .join(", ") || "nobody";
}

export function ResourceBar({ s, onTrend }: { s: Snapshot | null; onTrend: OnTrend }) {
  if (!s) return <div className="resbar" />;
  const { made, used } = s.power;
  const co2 = s.resources.co2 ?? 0;
  const pop = s.population;
  const glow = s.afterglow.points >= 0.5;
  return (
    <div className="resbar">
      <span className="group">
        <Item
          s={s}
          trend="population"
          className={`res${pop.health < 70 ? " warn" : ""}`}
          title="Colonists"
          notes={[`${pop.count} in ${s.beds} beds: ${stagesText(s.stages)}`, `Health ${Math.round(pop.health)}, from oxygen, water, meals, sanitation and CO2`]}
          onTrend={onTrend}
        >
          <span className="label">Colonists</span>
          <span className="val">
            {pop.count}/{s.beds}
          </span>
          <span className="rate">♥ {Math.round(pop.health)}</span>
        </Item>
        <Item
          s={s}
          trend="happiness"
          className={`res${s.happiness.productivity < 1 ? " warn" : ""}`}
          title="Happiness"
          notes={[
            "The average, across every home",
            ...(glow ? [`+${Math.round(s.afterglow.points)} afterglow: the thrill of arrival, gone in ${Math.ceil(s.afterglow.daysLeft)} days`] : []),
            ...(s.happiness.productivity < 1 ? [`Rooms at ${Math.round(s.happiness.productivity * 100)}% from low morale`] : []),
            ...(s.happiness.homeless ? [`${s.happiness.homeless} homeless`] : []),
          ]}
          onTrend={onTrend}
        >
          <span className="label">Happy</span>
          <span className="val">{Math.round(s.happiness.average)}</span>
          {glow && <span className="rate glow">✦{Math.round(s.afterglow.points)}</span>}
        </Item>
        <Item
          s={s}
          trend="condition"
          className={`res${s.maintenance.overall < 0.5 ? " warn" : ""}`}
          title="Condition"
          notes={["Every room's, weighted by size", "Below 50% rooms get people down; below 30% they slow (Charts → Maintenance)"]}
          onTrend={onTrend}
        >
          <span className="label">Condition</span>
          <span className="val">{Math.round(s.maintenance.overall * 100)}%</span>
        </Item>
        <Item s={s} trend="employed" className="res" title="Workers" notes={[`${s.workforce.employed} of ${s.workforce.total} adults employed`]} onTrend={onTrend}>
          <span className="label">Workers</span>
          <span className="val">
            {s.workforce.employed}/{s.workforce.total}
          </span>
        </Item>
        <Item
          s={s}
          trend="power:flow"
          className={`res${used > made + 0.01 ? " warn" : ""}`}
          title="Power"
          notes={[`Made ${num(made)}, used ${num(used)} a day`, `Battery ${num(s.resources.power ?? 0)} of ${num(s.capacities.power ?? 0)}`]}
          onTrend={onTrend}
        >
          <span className="label">Power</span>
          <span className="val">
            {num(used)}/{num(made)}
          </span>
        </Item>
      </span>
      <span className="group">
        {LIFE.map((id) => (
          <Stock key={id} id={id} s={s} onTrend={onTrend} />
        ))}
        <Item s={s} trend="co2" className={`res${co2 > 60 ? " warn" : ""}`} title="CO2" notes={[`${num(co2)} in the air; above 100 harms health`]} onTrend={onTrend}>
          <span className="label">CO2</span>
          <span className="val">{num(co2)}</span>
        </Item>
      </span>
      <span className="group">
        {FOOD.map((id) => (
          <Stock key={id} id={id} s={s} onTrend={onTrend} />
        ))}
      </span>
      <span className="group">
        {MATERIALS.map((id) => (
          <Stock key={id} id={id} s={s} onTrend={onTrend} />
        ))}
        {REGIONAL.filter((id) => (s.resources[id] ?? 0) > 0 || s.holeDeposits.includes(id)).map((id) => (
          <Stock key={id} id={id} s={s} onTrend={onTrend} />
        ))}
      </span>
    </div>
  );
}
