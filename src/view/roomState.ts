import { floorLinked } from "../sim/corridors";
import type { RoomStatus } from "../sim/economy";
import type { Layout, RoomInstance } from "../sim/placement";
import { num, resName } from "../ui/format";

// How a room is doing, in words: the inspector's first line (ui/Inspector.tsx), and the Godot
// viewer's room panel (src/bridge/inspect.ts).

/** Why a room runs below full rate, in words. */
export function limitText(limit: string | undefined): string {
  if (!limit) return "";
  if (limit === "staff") return "short of staff";
  if (limit === "paused") return "paused";
  if (limit === "kit") return "idle until you ask for a seed kit";
  if (limit === "standby") return "standing by: nothing to repair";
  // Unhappy colonists work slower (economy.ts).
  if (limit === "morale") return "slowed by low morale";
  // Condition (condition.ts).
  if (limit === "worn") return "slowed: worn out, below 30% condition";
  if (limit === "broken") return "stopped: broken down (0% condition)";
  // Refits (construction.ts, materials.ts).
  if (limit === "refit") return "half speed while it's refitted";
  // Solar arrays rest by night and ease up and down through dawn and dusk (weather.ts).
  if (limit === "night") return "dark until dawn: no sun on the panels";
  if (limit === "twilight") return "low sun: easing through dawn or dusk";
  // A dust storm dims the solar arrays (weather.ts).
  if (limit === "storm") return "dimmed by the dust storm";
  // An ordinance (quiet hours) slows noisy rooms (economy.ts).
  if (limit === "ordinance") return "slowed by an ordinance: noisy rooms work slower";
  if (limit.startsWith("stocked:")) return `standing by: ${resName(limit.slice(8)).toLowerCase()} stocked`;
  if (limit.startsWith("full:")) return `idling: ${resName(limit.slice(5)).toLowerCase()} storage full`;
  // Air rooms stand by when the air doesn't need them (economy.ts): the electrolyzer once
  // oxygen is at its target, a scrubber once CO2 is down to what the farms are left.
  if (limit === "air:co2") return "standing by: CO2 is down to the scrub floor";
  if (limit.startsWith("air:")) return `standing by: the air's ${resName(limit.slice(4)).toLowerCase()} is at its target`;
  // A waste-clearing room that has cleared everything there is (economy.ts).
  if (limit.startsWith("clear:")) return `keeping up: treating all the ${resName(limit.slice(6)).toLowerCase()} there is`;
  // Used water has nowhere to go (economy.ts).
  return `short of ${nameOf(limit)}`;
}

/** A resource's name, or the reason as given if it isn't one (so a new reason can't break the panel). */
function nameOf(id: string): string {
  try {
    return resName(id).toLowerCase();
  } catch {
    return id;
  }
}

/** Idling because output storage is full is fine; shortages and missing access aren't. */
export function isProblem(room: { planned: boolean; connected: boolean }, st: { rate: number; limit?: string } | undefined): boolean {
  if (!room.planned && !room.connected) return true;
  return !!st && st.rate < 0.999 && !st.limit?.startsWith("full:") && !st.limit?.startsWith("air:") && st.limit !== "paused" && st.limit !== "kit" && st.limit !== "standby" && st.limit !== "night" && st.limit !== "twilight" && !st.limit?.startsWith("stocked:") && !st.limit?.startsWith("clear:");
}

/** The room's state in a line: a blueprint, building, cut off, paused, standing by, or running (and what holds it back). */
export function roomState(layout: Layout, room: RoomInstance, st: RoomStatus | undefined): string {
  if (room.planned) return "Blueprint: builds when its floor is dug";
  if (room.building) return "Under construction";
  if (!room.connected) {
    const floor = room.cells[0]?.floor ?? 1;
    return floor > 1 && !floorLinked(layout, floor) ? `No access: no stairs reach floor ${floor} from the entrance` : "No access: connect it with a corridor";
  }
  if (st?.limit === "paused") return "Paused: its crew is free for other work";
  if (st?.limit === "kit") return "Idle until you ask for a seed kit";
  if (st?.limit === "standby") return "Standing by: nothing to repair";
  if (st?.limit?.startsWith("air:") && st.rate < 0.001) return limitText(st.limit).replace(/^s/, "S");
  if (st?.limit?.startsWith("stocked:")) return `Standing by: ${resName(st.limit.slice(8)).toLowerCase()} is stocked to ${num(room.stopAt ?? 0)}`;
  if (st) return `Running at ${Math.round(st.rate * 100)}%${st.limit ? ` · ${limitText(st.limit)}` : ""}`;
  return "";
}

/** The five colors the room panel speaks in (F-019): running, idle by choice, slowed, stopped or cut off, not built yet. */
export type Tone = "good" | "idle" | "warn" | "bad" | "info";

/** Limits that are a room resting by design, not a problem (the ones `isProblem` lets pass). */
const RESTING = ["paused", "kit", "standby", "night", "twilight"];
const RESTING_PREFIX = ["stocked:", "full:", "air:", "clear:"];
/** Limits that slow a room without stopping it. */
const SLOWED = ["staff", "morale", "worn", "refit", "storm", "ordinance"];

/** A room's status color: the pill in the panel's header, and (later) the 3D view's labels. */
export function roomTone(room: { planned: boolean; building?: unknown; connected: boolean }, st: { rate: number; limit?: string } | undefined): Tone {
  if (room.planned || room.building) return "info";
  if (!room.connected) return "bad";
  if (!st) return "idle";
  const limit = st.limit;
  if (!limit) return st.rate < 0.999 ? "warn" : "good";
  if (RESTING.includes(limit) || RESTING_PREFIX.some((p) => limit.startsWith(p))) return "idle";
  // At full rate a leftover limit holds nothing back (as isProblem has it).
  if (st.rate >= 0.999) return "good";
  if (SLOWED.includes(limit)) return "warn";
  // Broken, or short of an input.
  return "bad";
}

/** The status pill's few words: "Running", "Short of water", "Building 40%" (the full sentence is `roomState`). */
export function statusWord(room: RoomInstance, st: RoomStatus | undefined, progress?: number): string {
  if (room.planned) return "Blueprint";
  if (room.building) return progress === undefined ? "Building" : `Building ${Math.round(progress * 100)}%`;
  if (!room.connected) return "Cut off";
  if (!st) return "";
  const limit = st.limit;
  if (!limit || roomTone(room, st) === "good") return "Running";
  if (limit === "paused") return "Paused";
  if (limit === "kit") return "Idle";
  if (limit === "night") return "Night";
  if (limit === "twilight") return "Low sun";
  if (limit === "storm") return "Dimmed";
  if (limit === "staff") return "Short of staff";
  if (limit === "morale" || limit === "worn" || limit === "ordinance") return "Slowed";
  if (limit === "refit") return "Refitting";
  if (limit === "broken") return "Broken";
  if (limit === "standby" || limit.startsWith("stocked:") || limit.startsWith("air:")) return "Standing by";
  if (limit.startsWith("full:")) return "Storage full";
  if (limit.startsWith("clear:")) return "Keeping up";
  return `Short of ${nameOf(limit)}`;
}
