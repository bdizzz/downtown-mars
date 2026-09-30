import type { Snapshot } from "../sim/snapshot";
import { roomDef } from "../sim/rooms";
import { conditionColor } from "../view/conditionView";
import { cssColor } from "../render2d/palette";

// Upkeep: the hole's overall condition, what each maintenance or cleaning
// room is repairing now, and the queue of rooms waiting their turn (those at
// 60% or below), worst first, each with its condition as a bar.

const pct = (v: number) => `${Math.round(v * 100)}%`;

function Condition({ value, progress }: { value: number; progress?: number | null }) {
  return (
    <div className="bar condition-bar" title={pct(value)}>
      <div style={{ width: pct(value), background: cssColor(conditionColor(value)) }} />
      {progress != null && <div className="repair" style={{ width: pct(progress) }} />}
    </div>
  );
}

export function MaintenancePanel({ s, onSelect, onClose }: { s: Snapshot; onSelect: (roomId: number) => void; onClose: () => void }) {
  const { overall, queue, lanes } = s.maintenance;
  const byId = new Map(s.layout.rooms.map((r) => [r.id, r]));
  const name = (id: number) => {
    const r = byId.get(id);
    return r ? (r.name ?? roomDef(r.type).name) : "";
  };
  const link = (id: number) => (
    <button className="link" onClick={() => onSelect(id)} title="Show it">
      {name(id)}
    </button>
  );
  return (
    <aside className="inspector construction maintenance">
      <header>
        <h2>Maintenance</h2>
        <button onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <p>
        <span className="k">Overall condition</span> {pct(overall)}
      </p>
      <Condition value={overall} />
      <p className="k">
        Rooms wear down. Below 50% they get people down, below 30% they slow, and at 0% they stop. Each maintenance room repairs one room at a time, worst first; cleaning services
        take only homes and other rooms people share.
      </p>
      <h3>At work</h3>
      {!lanes.length && <p className="k">No maintenance rooms yet: build one (Build → Services).</p>}
      <ol className="queue">
        {lanes.map((l) => (
          <li key={l.by}>
            <div className="row">
              <span>
                {l.kind === "all" ? "🛠" : "🧽"} {link(l.by)}
              </span>
              <span className="k">{l.target === null ? (l.working ? "waiting for work" : "not working") : null}</span>
              <span />
            </div>
            {l.target !== null && (
              <>
                <div className="row">
                  <span>{link(l.target)}</span>
                  <span className="k">{pct(l.progress ?? 0)} done</span>
                  <span />
                </div>
                <Condition value={l.condition ?? 0} progress={l.progress} />
              </>
            )}
          </li>
        ))}
      </ol>
      <h3>Queue</h3>
      {!queue.length && <p className="k">Nothing waiting: every room is above 60%.</p>}
      <ol className="queue">
        {queue.map((q) => (
          <li key={q.roomId}>
            <div className="row">
              {link(q.roomId)}
              <span className="k">{q.progress !== null ? `${pct(q.progress)} done · ` : ""}{pct(q.condition)}</span>
              <span />
            </div>
            <Condition value={q.condition} progress={q.progress} />
          </li>
        ))}
      </ol>
    </aside>
  );
}
