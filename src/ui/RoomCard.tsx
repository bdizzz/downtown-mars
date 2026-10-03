import type { RoomDef } from "../sim/rooms";
import { roomCard } from "../view/roomCard";

interface Props {
  def: RoomDef;
  resources: Record<string, number>;
  shape: [number, number];
  onRotate?: () => void;
  /** Why this hole can't have the room at all (e.g. no ore under it). */
  siteNote?: string | null;
}

/** Everything a player needs to decide where a room goes, before placing it (view/roomCard.ts). */
export function RoomCard({ def, resources, shape, onRotate, siteNote }: Props) {
  const card = roomCard(def, resources, siteNote);
  return (
    <div className="room-card">
      <h3>{card.name}</h3>
      <p className="k">
        {card.size}
        {!card.surface && ` · ${shape[0]} wide × ${shape[1]} deep`}
        {onRotate && (
          <button className="rotate" onClick={onRotate} title="Rotate (R)">
            ⟳ rotate
          </button>
        )}
      </p>
      <p className="cost">
        {card.cost.map((c) => (
          <span key={c.text} className={c.short ? "short" : ""}>
            {c.text}
          </span>
        ))}
      </p>
      {card.lines.map((l, i) => (
        <p key={i} className={l.tone}>
          {l.text}
        </p>
      ))}
    </div>
  );
}
