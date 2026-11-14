import { config } from "../src/sim/config";
import { checkPlacement, spanRange, type Spot } from "../src/sim/placement";
import { placeAt } from "../src/sim/snap";
import type { SimState } from "../src/sim/state";
import { createWorld, type World } from "../src/sim/world";
import { starts } from "./adaptive";
import { run, type Plan, type PlanAt } from "./bot";

// The by-area player (F-004): the one-hole bot's opening, but every room placed
// the way a player places one now, by its target area at an angle, with no slot
// grid at all. Rooms go wall to wall from the first free angle on their ring, or
// snap in by a given angle; the same room on rings 1, 2 and 3 takes a narrower
// angle the further out, at the same area. Writes the "area" dev game
// (scripts/saves.ts), so the views can be checked on a hole built by area.

type Ring = Extract<Spot, { kind: "ring" }>;

/** The first angle on this ring the room fits at its target area, `depth` rings deep. */
const next =
  (floor: number, ring: number, depth = 1): PlanAt =>
  (s: SimState, room: string): Ring | null => {
    const span = spanRange(s.layout.hole, room, ring, depth).target;
    for (const start of starts(s, room, floor, ring, span)) {
      const at: Ring = { kind: "ring", floor, ring, depth, start };
      if (checkPlacement(s.layout, room, at).ok) return at;
    }
    return null;
  };

/** Centred on an angle (in turns), at its target area (snapping off, so rooms on different rings share a middle). */
const near =
  (floor: number, ring: number, turn: number, depth = 1): PlanAt =>
  (s: SimState, room: string): Ring | null => {
    if (floor > s.layout.hole.floors) return null;
    const p = placeAt(s.layout, room, floor, ring, depth, Math.round(turn * config.geometry.notchesPerTurn), false);
    const at: Ring = { kind: "ring", floor, ring, depth, start: p.start, span: p.span };
    return checkPlacement(s.layout, room, at).ok ? at : null;
  };

/** A fill room stretched to `times` its target area, centred on an angle (in turns). */
const fill =
  (floor: number, ring: number, turn: number, times: number): PlanAt =>
  (s: SimState, room: string): Ring | null => {
    if (floor > s.layout.hole.floors) return null;
    const span = Math.round(spanRange(s.layout.hole, room, ring, 1).target * times);
    const start = Math.round(turn * config.geometry.notchesPerTurn - span / 2);
    const at: Ring = { kind: "ring", floor, ring, depth: 1, start, span };
    return checkPlacement(s.layout, room, at).ok ? at : null;
  };

const surface = (slot: number): Spot => ({ kind: "surface", slot });

/** The plan, from the full landing kit (a new game's). */
export const AREA_PLAN: Plan[] = [
  // The critical set on floor 1, wall to wall round ring 1 from the entrance.
  { room: "galley", at: next(1, 1) },
  { room: "restroom", at: next(1, 1) },
  { room: "bunk_dorm", at: next(1, 1) },
  { room: "site_office", at: next(1, 1) },
  // Food on floor 2: one farm along ring 1, one two rings deep behind it (the same 400 m², narrower).
  { room: "farm", at: next(2, 1), crop: "potatoes" },
  { room: "farm", at: next(2, 2, 2), crop: "soybeans" },
  { room: "solar_array", at: surface(5) },
  { room: "clinic", at: next(1, 1) },
  { room: "admin_office", at: next(1, 2) },
  // Homes and services for arrivals.
  { room: "bunk_dorm", at: next(2, 1) },
  { room: "galley", at: next(2, 1) },
  { room: "restroom", at: next(2, 1) },
  { room: "solar_array", at: surface(6) },
  // The same room ring by ring, at one angle: 100 m² each, narrower further out.
  { room: "restroom", at: near(3, 1, 0.5) },
  { room: "restroom", at: near(3, 2, 0.5) },
  { room: "restroom", at: near(3, 3, 0.5) },
  { room: "galley", at: near(3, 1, 0.3) },
  { room: "galley", at: near(3, 2, 0.3) },
  { room: "galley", at: near(3, 3, 0.3) },
  // Fill rooms take whatever area they're stretched to.
  { room: "tiny_plaza", at: fill(3, 1, 0.7, 1.5) },
  { room: "bunk_dorm", at: next(3, 1) },
  { room: "solar_array", at: surface(7) },
];

/** Plays the by-area plan for `days` in a new game (its first hole, from a new game's landing kit), and returns the world. */
export function runByArea(days: number, seed = config.seed): World & { builtAt: Record<number, number> } {
  const world = createWorld(config, seed);
  const { state, builtAt } = run(days, config.landingKits.newGame, AREA_PLAN, world.holes[0]!);
  world.tick = state.tick;
  return Object.assign(world, { builtAt });
}
