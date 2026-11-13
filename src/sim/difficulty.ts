import raw from "../../data/difficulty.json";
import configRaw from "../../data/config.json";
import conditionRaw from "../../data/condition.json";
import constructionRaw from "../../data/construction.json";
import corridorsRaw from "../../data/corridors.json";
import eventsRaw from "../../data/events.json";
import materialsRaw from "../../data/materials.json";
import roomsRaw from "../../data/rooms.json";

// Difficulty (F-014): easy, normal or hard, chosen for a new game and saved
// with it. Each level is a set of multipliers (data/difficulty.json) on the
// game's own numbers. Rather than every system asking for its multiplier,
// setDifficulty rescales those numbers where they live, in the loaded data,
// from the values the data files hold; so the sim, the build palette's prices
// and the Godot bridge all see the same game. Normal puts every number back
// as written. A process runs one game at a time: the sim sets the level when
// a game is made or loaded, and the main thread from the snapshot.

export type Level = "easy" | "normal" | "hard";
export type Knob = keyof (typeof raw.factors)["normal"];

export const DIFFICULTY = raw as unknown as {
  default: Level;
  levels: { id: Level; name: string; hint: string }[];
  factors: Record<Level, Record<Knob, number>>;
};

export const LEVELS: Level[] = DIFFICULTY.levels.map((l) => l.id);

export function isLevel(v: unknown): v is Level {
  return typeof v === "string" && (LEVELS as string[]).includes(v);
}

/** A level's multiplier for one knob. */
export function factor(level: Level, knob: Knob): number {
  return DIFFICULTY.factors[level][knob];
}

/** How a scaled number is kept: whole (costs, thresholds, ticks), at most 1 (a chance), or as it comes. */
type Keep = "whole" | "chance" | "exact";

interface Target {
  obj: Record<string, number>;
  key: string;
  base: number;
  knob: Knob;
  keep: Keep;
}

type Obj = Record<string, unknown>;
const targets: Target[] = [];

function add(obj: unknown, key: string, knob: Knob, keep: Keep = "exact"): void {
  const o = obj as Record<string, number> | undefined;
  if (o && typeof o[key] === "number") targets.push({ obj: o, key, base: o[key], knob, keep });
}
/** Every number in a flat record ({ metal: 15, rock: 30 }). */
function addAll(obj: unknown, knob: Knob, keep: Keep = "exact"): void {
  if (obj && typeof obj === "object") for (const key of Object.keys(obj)) add(obj, key, knob, keep);
}
/** Every number in a record, however deep (the unlock thresholds). */
function addDeep(obj: unknown, knob: Knob, keep: Keep): void {
  if (!obj || typeof obj !== "object") return;
  for (const [key, v] of Object.entries(obj)) {
    if (typeof v === "number") add(obj, key, knob, keep);
    else addDeep(v, knob, keep);
  }
}

/** An event's bad outcomes (lost resources, low mood, wear) and how long it waits, wherever they sit in it. */
function addEvent(node: unknown): void {
  if (Array.isArray(node)) return node.forEach(addEvent);
  if (!node || typeof node !== "object") return;
  const o = node as Obj;
  for (const [key, v] of Object.entries(o)) {
    if (key === "patienceDays") add(o, key, "deadlines");
    else if (key === "resources" && v && typeof v === "object") {
      for (const [id, n] of Object.entries(v)) if (typeof n === "number" && n < 0) add(v, id, "eventSeverity", "whole");
    } else if (key === "mood") {
      if (typeof v === "number" && v < 0) add(o, key, "eventSeverity");
      else if (v && typeof v === "object" && ((v as Obj).amount as number) < 0) add(v, "amount", "eventSeverity");
    } else if (key === "conditionFloorAbove") add(o, key, "eventSeverity");
    else addEvent(v);
  }
}

const cfg = configRaw as unknown as Obj & {
  startingStock: Obj;
  digging: Obj;
  dome: Obj & { cost: Obj };
  windows: { costPer10m: Obj };
  colonists: { healthLossPerDay: Obj };
  air: { healthLossPerDay: Obj };
  happiness: Obj;
  weather: { dustStorm: Obj };
  earth: { rescue: Obj };
  unlocks: Obj;
};
const mat = materialsRaw as unknown as { walls: Obj[]; floorings: Obj[] };
const cor = corridorsRaw as unknown as { gallery: { cost: Obj }; bulkhead: { cost: Obj }; finishes: { cost: Obj }[] };

addAll(cfg.startingStock, "startingStock", "whole");

for (const r of roomsRaw.rooms as Obj[]) {
  addAll(r.cost, "buildCost", "whole");
  add(r, "buildHours", "buildTime");
}
for (const f of cor.finishes) addAll(f.cost, "buildCost", "whole");
addAll(cor.gallery.cost, "buildCost", "whole");
addAll(cor.bulkhead.cost, "buildCost", "whole");
for (const step of [...mat.walls, ...mat.floorings]) {
  addAll(step.cost, "buildCost", "whole");
  add(step, "work", "buildTime");
}
addAll(cfg.dome.cost, "buildCost", "whole");
addAll(cfg.windows.costPer10m, "buildCost", "whole");

addAll(constructionRaw.hoursBySize, "buildTime");
add(constructionRaw, "corridorHoursPer10m", "buildTime");
add(cfg.dome, "workHours", "buildTime");

add(cfg.digging, "ticksForFirstFloor", "digTime", "whole");
add(constructionRaw, "excavationHoursPerSlot", "digTime");

add(conditionRaw, "decayPerDay", "decay");

addAll(cfg.colonists.healthLossPerDay, "health");
add(cfg.colonists, "noSanitationHealthLossPerDay", "health");
addAll(cfg.air.healthLossPerDay, "health");
add(cfg.happiness, "base", "happiness");

add(cfg.weather.dustStorm, "chancePerDay", "hazards", "chance");
add(conditionRaw.breakdown, "chancePerDay", "hazards", "chance");

addEvent((eventsRaw as unknown as Obj).events);

addDeep(cfg.unlocks, "unlocks", "whole");
add(cfg.dome, "population", "unlocks", "whole");
add(cfg.earth.rescue, "chance", "rescue", "chance");

/** Each number a knob scales, as written and as it is now (for the tests). */
export function knobValues(knob: Knob): { base: number; now: number }[] {
  return targets.filter((t) => t.knob === knob).map((t) => ({ base: t.base, now: t.obj[t.key]! }));
}

let current: Level = "normal";

/** The level the loaded data is scaled to now. */
export function currentDifficulty(): Level {
  return current;
}

/** Scale the game's numbers to a level (normal: as the data files have them). */
export function setDifficulty(level: Level = "normal"): void {
  current = level;
  for (const t of targets) {
    const f = factor(level, t.knob);
    if (f === 1) {
      t.obj[t.key] = t.base;
      continue;
    }
    const v = t.base * f;
    // A cost or threshold that's there stays at least 1, so nothing turns free by rounding.
    t.obj[t.key] = t.keep === "whole" ? (t.base > 0 ? Math.max(1, Math.round(v)) : Math.round(v)) : t.keep === "chance" ? Math.min(1, v) : v;
  }
}
