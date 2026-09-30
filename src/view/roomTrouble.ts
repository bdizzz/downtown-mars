import type { RoomStatus } from "../sim/economy";

// What's wrong with a room, if anything, for the 3D view to show on it: an
// outline in a warning colour and an icon over its label. Slowed rooms
// (short of staff, low morale, the weather) are a warning; rooms short of what
// they run on are bad; paused rooms are idle. A room standing by because its
// output is full or stocked is doing its job, and shows nothing.

/** "work": a maintenance or cleaning crew is at it (a badge, no warning outline). */
export type TroubleLevel = "ok" | "warn" | "bad" | "idle" | "work";
export interface Trouble {
  level: TroubleLevel;
  icon: string;
}

const OK: Trouble = { level: "ok", icon: "" };

/** Icons for what a room can be short of; anything else gets a warning sign. */
const SHORT_OF: Record<string, string> = {
  power: "⚡",
  water: "💧",
  o2: "🫁",
  co2: "🫁",
  rawFood: "🌾",
  rations: "🥫",
  meals: "🍽",
  soil: "🪴",
  grayWater: "💧",
  ore: "⛏",
  metal: "🔩",
  silica: "🔩",
};

export function troubleOf(status: RoomStatus | undefined): Trouble {
  const limit = status?.limit;
  if (!limit) return OK;
  if (limit === "paused") return { level: "idle", icon: "⏸" };
  if (limit === "kit" || limit.startsWith("full:") || limit.startsWith("stocked:")) return OK;
  if (limit === "staff") return { level: "warn", icon: "👷" };
  if (limit === "morale") return { level: "warn", icon: "😞" };
  if (limit === "storm") return { level: "warn", icon: "🌪" };
  if (limit === "ordinance") return { level: "warn", icon: "📜" };
  if (limit === "worn") return { level: "warn", icon: "🔧" };
  if (limit === "broken") return { level: "bad", icon: "⛔" };
  return { level: "bad", icon: SHORT_OF[limit] ?? "⚠" };
}
