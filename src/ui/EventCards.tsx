import { useState } from "react";
import type { SimCommand } from "../sim/commands";
import { config } from "../sim/config";
import type { EventView, Snapshot } from "../sim/snapshot";
import { monthsText } from "../view/months";

// Events waiting for an answer (PLAN-M14): a card each, over the view at the
// top left, with its choices and how long you have. The game keeps running.
// A wager's choice (F-016) can take less than it asks: a stepper under it sets
// how much to commit. The odds are never shown.

const ICON: Record<string, string> = {
  aquifer: "💧",
  ore_vein: "⛏",
  silica_bed: "◇",
  lava_tube: "◠",
  gas_pocket: "⚠",
  microfossils: "✶",
  belt_ship: "🛰",
  celebration: "✦",
  meteorite_run: "☄",
};

const left = (ticks: number) => {
  const h = (ticks / config.ticksPerDay) * 24;
  return h >= 24 ? monthsText(h / 24, true) : `${Math.max(1, Math.round(h))} h`;
};

type Choice = EventView["choices"][number];

function ChoiceButton({ e, c, onCommand }: { e: EventView; c: Choice; onCommand: (cmd: SimCommand) => void }) {
  const st = c.stake;
  // How much to commit: as asked, or as much as there is.
  const [want, setWant] = useState<number | null>(null);
  const amount = st ? Math.max(st.min, Math.min(want ?? st.asked, st.max)) : 0;
  const ranged = !!st && st.min < st.asked && !c.refusal;
  const name = st?.name ?? "";
  const share = st && amount < st.asked ? amount / st.asked : undefined;
  return (
    <div className="choice-wrap">
      <button
        className="choice"
        disabled={!!c.refusal}
        title={c.refusal ?? c.hint}
        onClick={() => onCommand({ type: "answerEvent", eventId: e.id, choice: c.id, ...(share !== undefined ? { share } : {}) })}
      >
        {c.label}
        {st && !c.refusal && <span className="stake"> · {amount} {name}</span>}
        <span className="hint">{c.refusal ?? c.hint}</span>
      </button>
      {ranged && (
        <div className="stepper" title={`Commit ${st.min} to ${st.asked} ${name}`}>
          <button aria-label={`Less ${name}`} disabled={amount <= st.min} onClick={() => setWant(amount - 1)}>
            −
          </button>
          <span>
            {amount} of {st.asked} {name}
          </span>
          <button aria-label={`More ${name}`} disabled={amount >= Math.min(st.asked, st.max)} onClick={() => setWant(amount + 1)}>
            +
          </button>
        </div>
      )}
    </div>
  );
}

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
            <ChoiceButton key={c.id} e={e} c={c} onCommand={onCommand} />
          ))}
          <p className="k">Decide within {left(e.expiresTick - s.tick)}</p>
        </div>
      ))}
    </div>
  );
}
