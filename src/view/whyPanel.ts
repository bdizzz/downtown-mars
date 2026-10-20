import type { Cause } from "../sim/diagnosis";
import { DIAGNOSIS } from "../sim/diagnosis";
import type { RoomInstance } from "../sim/placement";
import { roomName } from "../sim/roomName";
import type { Snapshot } from "../sim/snapshot";
import type { Spot } from "./reachView";
import { placeText } from "./roomPanel";

// The "Why?" panel (F-018, T-173): what's hurting the hole's health and its happiness, cause by cause and
// biggest first, each with its fix and the rooms and homes to show; then the unhappiest homes. Text only,
// shared by the web's panel (ui/WhyPanel.tsx) and, later, the Godot viewer's.

export interface WhyItem {
  id: string;
  /** "−7.5 a month", "−12 points". */
  amount: string;
  text: string;
  fix?: string;
  /** "From the Smelter, the Pump" for a neighbour effect. */
  from?: string;
  /** A pull down (bad), or a lift. */
  bad: boolean;
  spot: Spot | null;
}

export interface WhySection {
  /** "Health 34, falling 13.5 a month". */
  headline: string;
  /** One more line under it: what it means. */
  note: string;
  items: WhyItem[];
}

export interface WhyHome {
  roomId: number;
  name: string;
  happiness: number;
  /** What hurts it most: "no galley seat −8, noise −5". */
  text: string;
}

export interface WhyContent {
  health: WhySection;
  happiness: WhySection;
  worst: WhyHome[];
}

/** A number to a tenth at most, signed: "−7.5", "+10". */
const tenth = (v: number) => `${v < 0 ? "−" : "+"}${Math.round(Math.abs(v) * 10) / 10}`;

/** Rooms named in a cause's "from", at most. */
const FROM_SHOWN = 3;

/**
 * Show me for a cause: its rooms and homes, looking first at the biggest source (or the worst home). Only
 * rooms in the rings can be lit up; null when there's nothing to show, or the cause is felt by everyone alike.
 */
export function spotFor(s: Snapshot, c: Pick<Cause, "id" | "rooms" | "homes">): Spot | null {
  if (DIAGNOSIS.happiness[c.id]?.shared) return null;
  const inRings = new Set(s.layout.rooms.filter((r) => r.at.kind === "ring").map((r) => r.id));
  const rooms = (c.rooms ?? []).filter((id) => inRings.has(id));
  const homes = (c.homes ?? []).filter((id) => inRings.has(id));
  const focus = rooms[0] ?? homes[0];
  return focus === undefined ? null : { rooms, homes, focus };
}

/** Show me for a cause by its key ("health:meals", "happiness:smell"), as visits and tips name them; null when it's gone or there's nothing to show. */
export function causeSpot(s: Snapshot, key: string): Spot | null {
  const [kind, id] = key.split(":");
  const causes = kind === "health" ? s.diagnosis.health.causes : s.diagnosis.happiness.causes;
  const c = causes.find((x) => x.id === id);
  return c ? spotFor(s, c) : null;
}

function fromText(s: Snapshot, ids: number[] | undefined): string | undefined {
  if (!ids?.length) return undefined;
  const byId = new Map(s.layout.rooms.map((r) => [r.id, r]));
  const names = ids
    .slice(0, FROM_SHOWN)
    .map((id) => byId.get(id))
    .filter((r): r is RoomInstance => !!r)
    .map((r) => `${roomName(r)} (${placeText(r)})`);
  return names.length ? `From ${names.join(", ")}${ids.length > FROM_SHOWN ? ` and ${ids.length - FROM_SHOWN} more` : ""}` : undefined;
}

export function whyContent(s: Snapshot): WhyContent {
  const d = s.diagnosis;
  const hp = d.health;
  const health: WhySection = {
    headline: hp.recovering
      ? `Health ${Math.round(hp.value)}${hp.perDay > 0 ? `, recovering ${tenth(hp.perDay)} a month` : ""}`
      : `Health ${Math.round(hp.value)}, falling ${tenth(hp.perDay).slice(1)} a month`,
    note: hp.recovering
      ? "Nothing is draining it. Health recovers only while nothing does."
      : "It recovers only once nothing drains it, so every cause below has to go.",
    items: hp.causes.map((c) => ({ id: c.id, amount: `${tenth(c.amount)} a month`, text: c.text, ...(c.fix ? { fix: c.fix } : {}), bad: true, spot: spotFor(s, c) })),
  };
  const hap = d.happiness;
  // The base is the same for every hole: not a cause to act on.
  const shown = hap.causes.filter((c) => c.id !== "base" && Math.abs(c.amount) >= 0.5);
  const down = shown.filter((c) => c.amount < 0);
  const up = shown.filter((c) => c.amount > 0).reverse();
  const happiness: WhySection = {
    headline: `Happiness ${Math.round(hap.average)}, heading for ${Math.round(hap.target)}`,
    note: "Each cause in points of happiness, across every resident. Pulls down first, then what lifts it.",
    items: [...down, ...up].map((c) => {
      const from = fromText(s, c.rooms);
      return {
        id: c.id,
        amount: `${tenth(c.amount)} points`,
        text: c.text,
        ...(c.amount < 0 && c.fix ? { fix: c.fix } : {}),
        ...(from ? { from } : {}),
        bad: c.amount < 0,
        spot: spotFor(s, c),
      };
    }),
  };
  const byId = new Map(s.layout.rooms.map((r) => [r.id, r]));
  const worst = hap.worst
    .filter((w) => byId.has(w.roomId))
    .map((w) => {
      const room = byId.get(w.roomId)!;
      return {
        roomId: w.roomId,
        name: `${roomName(room)}, ${placeText(room)}`,
        happiness: Math.round(w.happiness),
        text: w.causes.map((c) => `${DIAGNOSIS.happiness[c.id]?.label ?? c.id} ${tenth(c.amount)}`).join(", ") || "nothing much",
      };
    });
  return { health, happiness, worst };
}
