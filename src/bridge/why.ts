import type { Snapshot } from "../sim/snapshot";
import type { Spot } from "../view/reachView";
import { dueTip } from "../view/tips";
import { whyContent, type WhyContent } from "../view/whyPanel";

// The "Why?" panel and the deputy's tips for the Godot viewer (F-018, T-178), from the web's own
// words (view/whyPanel.ts, view/tips.ts). Each Show me's spot carries the floor of the room it looks
// at first, so the viewer can go there. Sent when they change.

/** Show me, with the floor to go to (null: its focus isn't in the rings). */
export type FloorSpot = Spot & { floor: number | null };

export function withFloor(s: Snapshot, spot: Spot | null): FloorSpot | null {
  if (!spot) return null;
  const at = s.layout.rooms.find((r) => r.id === spot.focus)?.at;
  return { ...spot, floor: at?.kind === "ring" ? at.floor : null };
}

export interface WhyMessage extends Omit<WhyContent, "health" | "happiness"> {
  type: "why";
  health: Omit<WhyContent["health"], "items"> & { items: (Omit<WhyContent["health"]["items"][number], "spot"> & { spot: FloorSpot | null })[] };
  happiness: Omit<WhyContent["happiness"], "items"> & { items: (Omit<WhyContent["happiness"]["items"][number], "spot"> & { spot: FloorSpot | null })[] };
}

export function whyMessage(s: Snapshot): WhyMessage {
  const why = whyContent(s);
  const section = (sec: WhyContent["health"]) => ({ ...sec, items: sec.items.map((i) => ({ ...i, spot: withFloor(s, i.spot) })) });
  return { type: "why", health: section(why.health), happiness: section(why.happiness), worst: why.worst };
}

export interface TipMessage {
  type: "tip";
  /** The tip due now (the viewer shows it only with Tips on), or null. */
  tip: { id: string; name: string; text: string; hint: string; spot: FloorSpot | null } | null;
}

export function tipMessage(s: Snapshot): TipMessage {
  const t = dueTip(s);
  return { type: "tip", tip: t ? { id: t.id, name: t.name, text: t.text, hint: t.hint, spot: withFloor(s, t.spot) } : null };
}
