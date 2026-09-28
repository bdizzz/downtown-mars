import type { SimCommand } from "../sim/commands";
import type { Snapshot } from "../sim/snapshot";
import { hoursText, num } from "./format";

// The construction queue: what's being built, in order, how far along, and
// when each will be done at today's bandwidth. Jobs can be moved to the front.

export function ConstructionPanel({ s, onCommand, onSelect, onClose }: { s: Snapshot; onCommand: (c: SimCommand) => void; onSelect: (roomId: number) => void; onClose: () => void }) {
  const { bandwidth, jobs } = s.construction;
  return (
    <aside className="inspector construction">
      <header>
        <h2>Construction</h2>
        <button onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <p>
        <span className="k">Bandwidth</span> {num(bandwidth)} work-hours an hour
      </p>
      <p className="k">
        One job at a time, in order. Construction offices add bandwidth; staff them well.
      </p>
      {!jobs.length && <p className="k">Nothing in the queue.</p>}
      <ol className="queue">
        {jobs.map((j, i) => (
          <li key={j.id}>
            <div className="row">
              {j.roomId !== undefined ? (
                <button className="link" onClick={() => onSelect(j.roomId!)} title="Show it">
                  {j.label}
                </button>
              ) : (
                <span>{j.label}</span>
              )}
              <span className="k">{j.hoursLeft === null ? "waits for its floor" : hoursText(j.hoursLeft)}</span>
              {i > 0 && (
                <button className="up" onClick={() => onCommand({ type: "prioritize", jobId: j.id })} title="Priority construction: move it to the front">
                  ⤒
                </button>
              )}
            </div>
            <div className="bar">
              <div style={{ width: `${Math.round(j.progress * 100)}%` }} />
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
