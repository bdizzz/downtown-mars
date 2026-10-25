import type { Snapshot } from "../sim/snapshot";
import { milestonesView, type MilestoneRow } from "../view/milestones";

// Charts → Milestones (F-005 / T-056): what this hole has achieved, with when,
// and what's still ahead, with how far along; then what the other holes have
// reached. The text comes from view/milestones.ts, shared with Godot.

function Row({ m }: { m: MilestoneRow }) {
  const done = m.when !== undefined;
  return (
    <div className={`ms-row${done ? " done" : ""}`} title={m.hint || undefined}>
      <span className="mark" aria-label={done ? "Reached" : "Ahead"}>
        {done ? "★" : "☆"}
      </span>
      <span className="name">{m.title}</span>
      {done && m.when && <span className="k">{m.when}</span>}
      {m.progress && (
        <span className="ms-progress" aria-label={`${m.progress.value} of ${m.progress.at}`}>
          <span className="bar">
            <span style={{ width: `${Math.min(100, (m.progress.value / m.progress.at) * 100)}%` }} />
          </span>
          <span className="k">
            {m.progress.value}/{m.progress.at}
          </span>
        </span>
      )}
    </div>
  );
}

export function MilestonesPanel({ s, onClose }: { s: Snapshot; onClose: () => void }) {
  const v = milestonesView(s);
  return (
    <aside className="inspector milestones">
      <header>
        <h2>
          Milestones <span className="k">· {v.reached} of {v.total}</span>
        </h2>
        <button onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      {v.groups.map((g) => (
        <section key={g.id}>
          <h3>
            {g.label}{" "}
            <span className="k">
              {g.reached.length}/{g.reached.length + g.ahead.length}
            </span>
          </h3>
          {g.reached.map((m) => (
            <Row key={m.id} m={m} />
          ))}
          {g.ahead.map((m) => (
            <Row key={m.id} m={m} />
          ))}
        </section>
      ))}
      {v.network.length > 0 && (
        <section>
          <h3>Network</h3>
          {v.network.map((h) => (
            <div key={h.holeId} className="ms-hole">
              <p>
                {h.name} <span className="k">· {h.reached.length ? `${h.reached.length} reached` : "none yet"}</span>
              </p>
              {h.reached.map((m) => (
                <Row key={m.id} m={m} />
              ))}
            </div>
          ))}
        </section>
      )}
    </aside>
  );
}
