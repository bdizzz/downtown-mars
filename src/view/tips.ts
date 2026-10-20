import raw from "../../data/tutorial.json";
import { config } from "../sim/config";
import type { Snapshot } from "../sim/snapshot";
import type { Spot } from "./reachView";
import { causeSpot } from "./whyPanel";

// The deputy's tips (F-018, T-177): the first time a problem shows up, a one-time card explains the
// mechanic behind the fix (bulkheads when smell reaches homes, restrooms when sanitation slips,
// scrubbers when CO2 rises...). Each tip names the diagnosis causes that bring it; the first one due,
// in data order, shows until the player reads it ("seeTip"), and the save remembers it. Shared by the
// web's card (ui/TipCard.tsx) and the Godot viewer's.

export interface TipDef {
  id: string;
  /** "health:<id>" (draining the hole's health) or "happiness:<id>" (costing tipPoints or more). */
  causes: string[];
  text: string;
  hint: string;
}

const DATA = raw as unknown as { tipPoints: number; fromDay: number; tips: TipDef[] };
export const TIPS = DATA.tips;

export interface Tip {
  id: string;
  /** The deputy's name, and what they say. */
  name: string;
  text: string;
  hint: string;
  /** The cause that brought it ("happiness:smell"), and Show me for it, if there's anything to show. */
  cause: string;
  spot: Spot | null;
}

/** Whether a cause is there now: draining health at all, or costing happiness tipPoints or more. */
function present(s: Snapshot, key: string): boolean {
  const [kind, id] = key.split(":");
  if (kind === "health") return s.diagnosis.health.causes.some((c) => c.id === id);
  return s.diagnosis.happiness.causes.some((c) => c.id === id && c.amount <= -DATA.tipPoints);
}

/** The tip to show now, or null: the first not yet seen whose cause is there. */
export function dueTip(s: Snapshot): Tip | null {
  if (s.tick < DATA.fromDay * config.ticksPerDay) return null;
  const seen = new Set(s.tipsSeen);
  for (const t of TIPS) {
    if (seen.has(t.id)) continue;
    const cause = t.causes.find((c) => present(s, c));
    if (!cause) continue;
    const name = s.notables[0]?.name ?? "your deputy";
    return { id: t.id, name, text: t.text.replaceAll("{name}", name), hint: t.hint, cause, spot: causeSpot(s, cause) };
  }
  return null;
}
