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
  // A dust storm dims the solar arrays (weather.ts).
  if (limit === "storm") return "dimmed by the dust storm";
  if (limit.startsWith("stocked:")) return `standing by: ${resName(limit.slice(8)).toLowerCase()} stocked`;
  if (limit.startsWith("full:")) return `idling: ${resName(limit.slice(5)).toLowerCase()} storage full`;
  // Life support stops making oxygen once the air is at its target (economy.ts).
  if (limit.startsWith("air:")) return `idling: the air's ${resName(limit.slice(4)).toLowerCase()} is at its target`;
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
  return !!st && st.rate < 0.999 && !st.limit?.startsWith("full:") && !st.limit?.startsWith("air:") && st.limit !== "paused" && st.limit !== "kit" && st.limit !== "standby" && !st.limit?.startsWith("stocked:");
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
  if (st?.limit?.startsWith("stocked:")) return `Standing by: ${resName(st.limit.slice(8)).toLowerCase()} is stocked to ${num(room.stopAt ?? 0)}`;
  if (st) return `Running at ${Math.round(st.rate * 100)}%${st.limit ? ` · ${limitText(st.limit)}` : ""}`;
  return "";
}
