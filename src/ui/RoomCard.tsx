import type React from "react";
import { CATEGORY_COLORS, cssColor } from "../render2d/palette";
import type { RoomDef } from "../sim/rooms";
import { roomCard } from "../view/roomCard";
import { Amounts } from "./Cost";

interface Props {
  def: RoomDef;
  resources: Record<string, number>;
  shape: [number, number];
  /** Why this hole can't have the room at all (e.g. no ore under it). */
  siteNote?: string | null;
  /** What goes on top of its cost (the lining it's to be built in), shown as one total. */
  extra?: Record<string, number>;
}

/**
 * What a player needs to decide on a room before placing it (view/roomCard.ts), at a glance: its
 * size and cost, a short table of facts, what it does to its neighbours as chips, and only the
 * notes that are particular to it.
 */
export function RoomCard({ def, resources, shape, siteNote, extra }: Props) {
  const card = roomCard(def, resources, siteNote, extra);
  return (
    <div className="room-card" style={{ "--cat": cssColor(CATEGORY_COLORS[def.category] ?? 0x888888) } as React.CSSProperties}>
      <header>
        <span className="swatch" />
        <h3>{card.name}</h3>
        <span className="size">
          {card.size}
          {!card.surface && ` · ${shape[0]}×${shape[1]}`}
        </span>
      </header>
      <p className="price">
        <Amounts amounts={card.amounts} have={resources} />
        <span className="k">{card.workHours} work-hours</span>
      </p>
      {card.facts.length > 0 && (
        <dl className="facts">
          {card.facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.amounts ? <Amounts amounts={f.amounts} /> : f.text}</dd>
            </div>
          ))}
        </dl>
      )}
      {card.effects.length > 0 && (
        <p className="fx">
          {card.effects.map((e, i) => (
            <span key={i} className={`fx-chip ${e.tone}`} title={e.tip}>
              {e.text}
            </span>
          ))}
        </p>
      )}
      {card.notes.map((l, i) => (
        <p key={i} className={`note ${l.tone ?? ""}`}>
          {l.text}
        </p>
      ))}
    </div>
  );
}
