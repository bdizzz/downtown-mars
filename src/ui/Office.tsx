import type { SimCommand } from "../sim/commands";
import { config } from "../sim/config";
import { ordinanceDefs } from "../sim/ordinances";
import type { Snapshot } from "../sim/snapshot";
import { causeLabel, visitDef } from "../sim/visits";
import { monthsText } from "../view/months";
import type { Spot } from "../view/reachView";
import { causeSpot } from "../view/whyPanel";
import { Portrait } from "./Portrait";

interface Props {
  s: Snapshot;
  onCommand: (cmd: SimCommand) => void;
  /** The cause Show me is on (its key), or null; and turning it on or off, as in the "Why?" panel. */
  shown: string | null;
  onShow: (id: string | null, spot: Spot | null) => void;
  onClose: () => void;
}

const days = (ticks: number) => {
  const d = ticks / config.ticksPerDay;
  return d >= 1 ? monthsText(d, true) : `${Math.max(1, Math.round(d * 24))} h`;
};

const PROMISE_TEXT: Record<string, string> = {
  noiseFixed: "Fix the noise",
  clinicBuilt: "Build a clinic",
};

/** Show me for a visit about a diagnosis cause: the homes and rooms behind it, while it lasts. */
function ShowMe({ s, cause, shown, onShow }: { s: Snapshot; cause: string; shown: boolean; onShow: Props["onShow"] }) {
  const spot = causeSpot(s, cause);
  if (!spot) return null;
  return (
    <button className={`why-show${shown ? " on" : ""}`} onClick={() => onShow(shown ? null : cause, shown ? null : spot)} aria-pressed={shown}>
      {shown ? "Showing" : "Show me"}
    </button>
  );
}

export function Office({ s, onCommand, shown, onShow, onClose }: Props) {
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
              <Portrait who={n} />
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
            {v.cause && <ShowMe s={s} cause={v.cause} shown={shown === v.cause} onShow={onShow} />}
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
              {p.cause ? `Fix the ${causeLabel(p.cause)}` : (PROMISE_TEXT[p.check] ?? p.check)} for {notable(p.notableId)?.name}
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
          <Portrait who={n} small />
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
