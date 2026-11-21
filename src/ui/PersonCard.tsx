import { useEffect, useState } from "react";
import type { PersonView } from "../sim/personView";
import { personCard } from "../view/personCard";
import { PanelHeader } from "./PanelHeader";

// One colonist's card (#528): who they are, where they sleep and work, their
// walks, needs, family and what's making them happy or not. Opened from a
// walker in the 3D view or a row of the people list; asked of the worker
// again every couple of seconds while it's open. The words: view/personCard.ts.

interface Props {
  personId: number;
  /** Asks the worker for their card (null: they've gone). */
  load: (id: number) => Promise<PersonView | null>;
  /** The tick, to ask again as the game runs. */
  tick: number;
  onPerson: (id: number) => void;
  onRoom: (id: number) => void;
  onBack: () => void;
  onClose: () => void;
}

export function PersonCard({ personId, load, tick, onPerson, onRoom, onBack, onClose }: Props) {
  const [p, setP] = useState<PersonView | null | undefined>(undefined);
  // Every 20 ticks (2 game hours) is plenty: needs and happiness move slowly.
  const beat = Math.floor(tick / 20);
  useEffect(() => {
    let live = true;
    void load(personId).then((v) => live && setP(v));
    return () => {
      live = false;
    };
  }, [personId, beat, load]);
  const card = p ? personCard(p) : null;
  return (
    <aside className="inspector people person">
      <PanelHeader title={card?.name ?? "Person"} onClose={onClose} />
      <button className="link back" onClick={onBack}>
        ← Everyone
      </button>
      {p === null && <p className="k">They're no longer in this hole.</p>}
      {card && (
        <>
          <p className="k">{card.subtitle}</p>
          <dl className="facts">
            {card.facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>
                  {f.roomId !== undefined ? (
                    <button className="link" onClick={() => onRoom(f.roomId!)}>
                      {f.text}
                    </button>
                  ) : (
                    f.text
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <h3>Needs</h3>
          {card.needs.map((n) => (
            <div key={n.label} className="need">
              <span className="k">{n.label}</span>
              <span className="meter" title={n.value.toFixed(1)}>
                <i style={{ left: "50%", width: `${Math.abs(n.share - 0.5) * 100}%`, transform: n.share < 0.5 ? "translateX(-100%)" : undefined }} className={n.share < 0.5 ? "low" : "high"} />
              </span>
              <span className="k">{n.text}</span>
            </div>
          ))}
          {card.reasons.length > 0 && (
            <>
              <h3>Why they feel this way</h3>
              <ul className="reasons">
                {card.reasons.map((r) => (
                  <li key={r.text} className={r.good ? "ok" : "warn"}>
                    {r.text}
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3>Family here</h3>
          {card.family.length === 0 && <p className="k">No family in this hole.</p>}
          <ul className="family">
            {card.family.map((f) => (
              <li key={f.id}>
                <button className="link" onClick={() => onPerson(f.id)}>
                  {f.text}
                </button>
              </li>
            ))}
          </ul>
          {card.note && <p className="warn">{card.note}</p>}
        </>
      )}
    </aside>
  );
}
