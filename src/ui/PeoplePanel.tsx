import type { Snapshot } from "../sim/snapshot";
import { num } from "./format";

// The hole's people: who they are by life stage, what's coming, and why
// children are or aren't being born.

const MOVES = {
  child: (n: number) => `${n} ${n === 1 ? "child grows" : "children grow"} up`,
  adult: (n: number) => `${n} ${n === 1 ? "adult retires" : "adults retire"}`,
  elder: (n: number) => `${n} ${n === 1 ? "elder passes" : "elders pass"} away`,
};

function days(d: number): string {
  return d < 1 ? "today" : `in ${Math.round(d)} ${Math.round(d) === 1 ? "day" : "days"}`;
}

export function PeoplePanel({ s, onClose }: { s: Snapshot; onClose: () => void }) {
  const { child, adult, elder } = s.stages;
  const total = Math.max(1, child + adult + elder);
  const b = s.births;
  const checks: [boolean, string][] = [
    [!b.blockers.includes("No working clinic"), "A working clinic"],
    [!b.blockers.some((x) => x.startsWith("Happiness")), `Happiness 55 or more (now ${Math.round(s.happiness.average)})`],
    [!b.blockers.includes("No free beds"), `A free bed (${s.population.count}/${s.beds})`],
  ];
  return (
    <aside className="inspector people">
      <header>
        <h2>People</h2>
        <button onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <div className="stages" role="img" aria-label={`${child} children, ${adult} adults, ${elder} elders`}>
        <div className="child" style={{ width: `${(child / total) * 100}%` }} />
        <div className="adult" style={{ width: `${(adult / total) * 100}%` }} />
        <div className="elder" style={{ width: `${(elder / total) * 100}%` }} />
      </div>
      <p className="legend">
        <span>
          <i className="child" /> {child} {child === 1 ? "child" : "children"}
        </span>
        <span>
          <i className="adult" /> {adult} {adult === 1 ? "adult" : "adults"}
        </span>
        <span>
          <i className="elder" /> {elder} {elder === 1 ? "elder" : "elders"}
        </span>
      </p>
      <p className="k">
        Adults work ({s.workforce.employed} of {s.workforce.total} employed). Children and elders don't, but need beds, food, water and air.
      </p>

      {s.leavingFor && (
        <p className="warn">
          Morale is low: colonists are leaving for {s.leavingFor}, a few each day. Raise happiness above 45 to keep them.
        </p>
      )}

      <h3>Births</h3>
      {b.blockers.length === 0 ? (
        <p>About one child every {Math.max(1, Math.round(1 / Math.max(b.perDay, 1e-6)))} days.</p>
      ) : (
        <p className="warn">No births for now.</p>
      )}
      <ul className="checks">
        {checks.map(([ok, text]) => (
          <li key={text} className={ok ? "ok" : ""}>
            {ok ? "✓" : "✗"} {text}
          </li>
        ))}
      </ul>
      <p className="k">{b.born ? `${b.born} born here so far.` : "Nobody born here yet."}</p>

      <h3>School and care</h3>
      <p>
        <span className="k">Children</span>{" "}
        {s.care.school.who === 0
          ? "none yet"
          : s.care.school.missing > 0
            ? `${num(s.care.school.missing)} of ${s.care.school.who} without a school place: their families are unhappy`
            : `all ${s.care.school.who} in school`}
      </p>
      <p>
        <span className="k">Elders</span>{" "}
        {s.care.elders.who === 0
          ? "none yet"
          : s.care.elders.missing > 0
            ? `${num(s.care.elders.missing)} of ${s.care.elders.who} without care: health suffers`
            : `all ${s.care.elders.who} cared for`}
      </p>

      <h3>Coming up</h3>
      <ul className="upcoming">
        {s.upcoming.map((u, i) => (
          <li key={i}>
            {MOVES[u.stage](u.count)} {days(u.daysLeft)}
          </li>
        ))}
      </ul>
    </aside>
  );
}
