import { config } from "../sim/config";
import type { Snapshot } from "../sim/snapshot";

// Recent sim messages over the view, fading out after a game day.
const SHOW_TICKS = config.ticksPerDay;
const MAX_SHOWN = 4;

export function Messages({ s }: { s: Snapshot | null }) {
  if (!s) return null;
  const recent = s.messages.filter((m) => s.tick - m.tick < SHOW_TICKS).slice(-MAX_SHOWN);
  return (
    <div className="messages">
      {recent.map((m) => (
        <div key={`${m.tick}:${m.text}`} className={`msg ${m.kind}`} style={{ opacity: 1 - ((s.tick - m.tick) / SHOW_TICKS) ** 3 }}>
          {m.text}
        </div>
      ))}
    </div>
  );
}
