import { config } from "../sim/config";
import { ordinanceDefs, ordinanceSlots } from "../sim/ordinances";
import type { SimState } from "../sim/state";
import { visitDef } from "../sim/visits";
import { monthsText } from "../view/months";

// The office for the Godot viewer, as the web's (ui/Office.tsx) lays it out: who's waiting, with
// what they want and the answers you can give; promises to keep; ordinances, enacted or not, with
// the slots for them; and the notables, with their loyalty. Sent when any of it changes.

const days = (ticks: number) => {
  const d = ticks / config.ticksPerDay;
  return d >= 1 ? monthsText(d, true) : `${Math.max(1, Math.round(d * 24))} h`;
};

const PROMISE_TEXT: Record<string, string> = {
  noiseFixed: "Fix the noise",
  clinicBuilt: "Build a clinic",
};

export interface OfficeMessage {
  type: "office";
  waiting: {
    id: number;
    who: string;
    about: string;
    title: string;
    text: string;
    leaves: string;
    choices: { id: string; label: string; hint: string; refusal: string | null }[];
  }[];
  promises: string[];
  ordinances: { id: string; name: string; description: string; on: boolean; refusal: string | null }[];
  slots: { used: number; of: number };
  notables: { name: string; about: string; loyalty: number }[];
}

export function office(state: SimState): OfficeMessage {
  const slotsFree = ordinanceSlots(state) - state.ordinances.length;
  const notable = (id: number) => state.notables.find((n) => n.id === id);
  return {
    type: "office",
    waiting: state.office.waiting.map((v) => {
      const n = notable(v.notableId);
      return {
        id: v.id,
        who: n?.name ?? "Someone",
        about: n ? `${n.role} · ${n.traits.join(", ")} · loyalty ${n.loyalty}` : "",
        title: v.title,
        text: v.text,
        leaves: `Leaves in ${days(v.leavesTick - state.tick)}`,
        choices: visitDef(v.kind).choices.map((c) => {
          const needsSlot = !!c.enact && !state.ordinances.includes(c.enact) && slotsFree <= 0;
          return { id: c.id, label: c.label, hint: c.hint, refusal: needsSlot ? "No free ordinance slot" : null };
        }),
      };
    }),
    promises: state.office.promises.map((p) => `${PROMISE_TEXT[p.check] ?? p.check} for ${notable(p.notableId)?.name ?? "someone"} · ${days(p.dueTick - state.tick)} left`),
    ordinances: ordinanceDefs.map((o) => {
      const on = state.ordinances.includes(o.id);
      return { id: o.id, name: o.name, description: o.description, on, refusal: !on && slotsFree <= 0 ? "No free ordinance slot" : null };
    }),
    slots: { used: state.ordinances.length, of: ordinanceSlots(state) },
    notables: state.notables.map((n) => ({ name: n.name, about: `${n.role} · ${n.traits.join(", ")}`, loyalty: n.loyalty })),
  };
}

/** What changes the office (the time left only by the game hour, so it isn't sent every tick). */
export function officeKey(state: SimState): string {
  const hour = Math.floor(state.tick / (config.ticksPerDay / 24));
  return JSON.stringify([state.holeId, hour, state.office.waiting.map((v) => v.id), state.office.promises.length, state.ordinances, ordinanceSlots(state), state.notables.map((n) => n.loyalty)]);
}
