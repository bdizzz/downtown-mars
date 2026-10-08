import type { SimCommand } from "../sim/commands";
import { config } from "../sim/config";
import { ordinanceDefs } from "../sim/ordinances";
import type { Snapshot } from "../sim/snapshot";
import { visitDef } from "../sim/visits";
import { monthsText } from "../view/months";

interface Props {
  s: Snapshot;
  onCommand: (cmd: SimCommand) => void;
  onClose: () => void;
}

const days = (ticks: number) => {
  const d = ticks / config.ticksPerDay;
  return d >= 1 ? monthsText(d, true) : `${Math.max(1, Math.round(d * 24))} h`;
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("");

const PROMISE_TEXT: Record<string, string> = {
  noiseFixed: "Fix the noise",
  clinicBuilt: "Build a clinic",
};

export function Office({ s, onCommand, onClose }: Props) {
  const slotsFree = s.ordinanceSlots - s.ordinances.length;
  const notable = (id: number) => s.notables.find((n) => n.id === id);

  return (
    <aside className="inspector office">
      <header>
        <h2>Administration</h2>
        <button onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      <h3>Waiting room</h3>
      {s.office.waiting.length === 0 && <p className="k">Nobody is waiting.</p>}
      {s.office.waiting.map((v) => {
        const n = notable(v.notableId);
        return (
          <div key={v.id} className="visit">
            <div className="who">
              <span className="face">{n ? initials(n.name) : "?"}</span>
              <span>
                <strong>{n?.name}</strong>
                <br />
                <span className="k">
                  {n?.role} · {n?.traits.join(", ")} · loyalty {n?.loyalty}
                </span>
              </span>
            </div>
            <p className="title">{v.title}</p>
            <p>{v.text}</p>
            <p className="k">Leaves in {days(v.leavesTick - s.tick)}</p>
            {visitDef(v.kind).choices.map((c) => {
              const needsSlot = !!c.enact && !s.ordinances.includes(c.enact) && slotsFree <= 0;
              return (
                <button
                  key={c.id}
                  className="choice"
                  disabled={needsSlot}
                  title={needsSlot ? "No free ordinance slot" : c.hint}
                  onClick={() => onCommand({ type: "answerVisit", visitId: v.id, choice: c.id })}
                >
                  {c.label}
                  <span className="hint">{needsSlot ? "No free ordinance slot" : c.hint}</span>
                </button>
              );
            })}
          </div>
        );
      })}

      {s.office.promises.length > 0 && (
        <>
          <h3>Promises</h3>
          {s.office.promises.map((p, i) => (
            <p key={i}>
              {PROMISE_TEXT[p.check] ?? p.check} for {notable(p.notableId)?.name}
              <span className="k"> · {days(p.dueTick - s.tick)} left</span>
            </p>
          ))}
        </>
      )}

      <h3>
        Ordinances <span className="k">{s.ordinances.length}/{s.ordinanceSlots} slots</span>
      </h3>
      {ordinanceDefs.map((o) => {
        const on = s.ordinances.includes(o.id);
        return (
          <div key={o.id} className="ordinance">
            <span>
              <strong>{o.name}</strong>
              <br />
              <span className="k">{o.description}</span>
            </span>
            <button
              className={on ? "on" : ""}
              disabled={!on && slotsFree <= 0}
              onClick={() => onCommand({ type: "setOrdinance", id: o.id, enacted: !on })}
            >
              {on ? "Repeal" : "Enact"}
            </button>
          </div>
        );
      })}

      <h3>Notables</h3>
      {s.notables.map((n) => (
        <div key={n.id} className="notable">
          <span className="face small">{initials(n.name)}</span>
          <span className="grow">
            {n.name}
            <br />
            <span className="k">
              {n.role} · {n.traits.join(", ")}
            </span>
          </span>
          <span className="loyalty" title={`Loyalty ${n.loyalty}`}>
            <span style={{ width: `${n.loyalty}%` }} />
          </span>
        </div>
      ))}
    </aside>
  );
}
