import type { SimCommand } from "../sim/commands";
import { config } from "../sim/config";
import type { Snapshot } from "../sim/snapshot";
import { monthsText } from "../view/months";

// Events waiting for an answer (PLAN-M14): a card each, over the view at the
// top left, with its choices and how long you have. The game keeps running.

const ICON: Record<string, string> = {
  aquifer: "💧",
  ore_vein: "⛏",
  silica_bed: "◇",
  lava_tube: "◠",
  gas_pocket: "⚠",
  microfossils: "✶",
  belt_ship: "🛰",
  celebration: "✦",
};

const left = (ticks: number) => {
  const h = (ticks / config.ticksPerDay) * 24;
  return h >= 24 ? monthsText(h / 24, true) : `${Math.max(1, Math.round(h))} h`;
};

export function EventCards({ s, onCommand }: { s: Snapshot | null; onCommand: (cmd: SimCommand) => void }) {
  if (!s || !s.events.pending.length) return null;
  return (
    <div className="event-cards">
      {s.events.pending.map((e) => (
        <div key={e.id} className={`event-card ${e.kind}`}>
          <p className="title">
            <span className="icon">{ICON[e.kind] ?? "!"}</span> {e.title}
          </p>
          <p>{e.text}</p>
          {e.choices.map((c) => (
            <button
              key={c.id}
              className="choice"
              disabled={!!c.refusal}
              title={c.refusal ?? c.hint}
              onClick={() => onCommand({ type: "answerEvent", eventId: e.id, choice: c.id })}
            >
              {c.label}
              <span className="hint">{c.refusal ?? c.hint}</span>
            </button>
          ))}
          <p className="k">Decide within {left(e.expiresTick - s.tick)}</p>
        </div>
      ))}
    </div>
  );
}
