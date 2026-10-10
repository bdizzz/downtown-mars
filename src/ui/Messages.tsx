import { useState } from "react";
import { RichText } from "./RoomName";
import { config } from "../sim/config";
import type { Snapshot } from "../sim/snapshot";

// Recent sim messages over the view, fading out after a game day. Each has a
// × that closes it at once; the rest of the stack closes up.
const SHOW_TICKS = config.ticksPerDay;
const MAX_SHOWN = 4;

export function Messages({ s }: { s: Snapshot | null }) {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  if (!s) return null;
  const key = (m: Snapshot["messages"][number]) => `${m.holeId ?? 0}:${m.tick}:${m.text}`;
  const recent = s.messages.filter((m) => s.tick - m.tick < SHOW_TICKS && !dismissed.has(key(m))).slice(-MAX_SHOWN);
  const dismiss = (k: string) =>
    setDismissed((d) => {
      // Keep only keys that could still show, so the set never grows.
      const live = new Set(s.messages.filter((m) => s.tick - m.tick < SHOW_TICKS).map(key));
      return new Set([...d, k].filter((x) => live.has(x)));
    });
  return (
    <div className="messages">
      {recent.map((m) => (
        <div key={key(m)} className={`msg ${m.kind}`} style={{ opacity: 1 - ((s.tick - m.tick) / SHOW_TICKS) ** 3 }}>
          <span className="text">
            {m.holeId !== undefined && m.holeId !== s.holeId && <strong className="from">{m.holeName}: </strong>}
            <RichText text={m.text} s={s} />
          </span>
          <button className="dismiss" title="Dismiss" aria-label="Dismiss" onClick={() => dismiss(key(m))}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
