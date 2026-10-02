import type { Snapshot } from "../sim/snapshot";
import { peopleReport } from "../view/colony";

// The hole's people: who they are by life stage, what's coming, and why
// children are or aren't being born (the words: view/colony.ts).

export function PeoplePanel({ s, onClose }: { s: Snapshot; onClose: () => void }) {
  const { child, adult, elder } = s.stages;
  const total = Math.max(1, child + adult + elder);
  const r = peopleReport(s);
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
      <p className="k">{r.work}</p>

      {r.leaving && <p className="warn">{r.leaving}</p>}

      <h3>Births</h3>
      <p className={r.births.ok ? "" : "warn"}>{r.births.text}</p>
      <ul className="checks">
        {r.checks.map(([ok, text]) => (
          <li key={text} className={ok ? "ok" : ""}>
            {ok ? "✓" : "✗"} {text}
          </li>
        ))}
      </ul>
      <p className="k">{r.born}</p>

      <h3>School, care and meals</h3>
      {r.care.map((c) => (
        <p key={c.label}>
          <span className="k">{c.label}</span> {c.text}
        </p>
      ))}

      <h3>The departed</h3>
      <p>{r.departed}</p>
      {r.grief && <p className="warn">{r.grief}</p>}

      <h3>Coming up</h3>
      <ul className="upcoming">
        {r.upcoming.map((u, i) => (
          <li key={i}>{u}</li>
        ))}
      </ul>
    </aside>
  );
}
