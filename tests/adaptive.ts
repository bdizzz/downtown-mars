import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { elderCoverage, schoolCoverage } from "../src/sim/care";
import { beds } from "../src/sim/earth";
import { careCoverage } from "../src/sim/happiness";
import { roomDef } from "../src/sim/rooms";
import { bandwidth } from "../src/sim/construction";
import { countStage, cryptSpace } from "../src/sim/people";
import type { SimState } from "../src/sim/state";

// A scripted player that reacts: once a day it looks at what its hole is
// short of and builds the room that fixes it, in the first free spot on the
// gallery (ring 1) of any dug floor. Used after the fixed opening plans, so
// long playtests measure the game's systems rather than a stale build list.

/** Build a room wherever it fits: on the surface, or on ring 1 of the shallowest floor with room. */
export function placeAnywhere(hole: SimState, room: string, crop?: string): boolean {
  const def = roomDef(room);
  if (def.size === "surface") {
    for (let slot = 0; slot < hole.layout.surface.length; slot++) {
      if (applyCommand(hole, { type: "build", room, at: { kind: "surface", slot } }).ok) return true;
    }
    return false;
  }
  const [w, d] = config.shapes[def.size as keyof typeof config.shapes]![0]!;
  const slots = hole.layout.hole.ringSlots[0]!;
  for (let floor = 1; floor <= hole.layout.hole.floors; floor++) {
    for (let slot = 0; slot < slots; slot++) {
      const r = applyCommand(hole, { type: "build", room, at: { kind: "ring", floor, ring: 1, slot, w, d } });
      if (r.ok) {
        if (crop) applyCommand(hole, { type: "setCrop", roomId: r.roomId!, crop });
        return true;
      }
      // Can't afford it anywhere: stop looking.
      if (/^(Needs|Not enough|Unlocks)/.test(r.reason)) return false;
    }
  }
  return false;
}

const count = (hole: SimState, type: string) => hole.layout.rooms.filter((r) => r.type === type).length;
const limited = (hole: SimState, what: string) =>
  hole.layout.rooms.some((r) => !r.planned && hole.roomStatus[r.id]?.limit === what);

/** What this hole needs most right now, in order of urgency. */
export function wants(hole: SimState): { room: string; crop?: string }[] {
  const pop = hole.population.count;
  const res = hole.resources;
  const met = hole.population.needsMet;
  const out: { room: string; crop?: string }[] = [];
  if ((res.co2 ?? 0) > 30 || (met.o2 ?? 1) < 1 || count(hole, "life_support") * 30 < pop) out.push({ room: "life_support" });
  if (limited(hole, "power")) out.push({ room: "solar_array" });
  if ((met.water ?? 1) < 1 || limited(hole, "water")) {
    out.push({ room: count(hole, "water_recycler") * 36 < pop * 1.5 ? "water_recycler" : "water_tank" });
  }
  if (count(hole, "galley") * 25 < pop) out.push({ room: "galley" });
  if (count(hole, "farm") * 12 < pop * 0.6) out.push({ room: "farm", crop: "potatoes" });
  if (hole.population.sanitation < 0.99) out.push({ room: "restroom" });
  if ((res.soil ?? 0) < 20 && count(hole, "farm") > 0 && (res.organicWaste ?? 0) > 10) out.push({ room: "composter" });
  if (countStage(hole, "elder") > cryptSpace(hole)) out.push({ room: "crypt" });
  if (careCoverage(hole) < 1) out.push({ room: "clinic" });
  if (schoolCoverage(hole).missing > 0) out.push({ room: "school" });
  if (elderCoverage(hole).missing > 0) out.push({ room: "elder_care" });
  // More homes only while the hole is doing well, leaving room for births.
  if (beds(hole) - pop < 6 && hole.population.health >= 70 && hole.happiness.average >= 50) out.push({ room: "bunk_dorm" });
  return out;
}

/** Rooms a player would stand down first to free hands for air, food and water. */
const EXPENDABLE = ["machine_shop", "smelter", "rover_depot", "staging_bay"];

/** Once a day, build the most urgent thing it can staff, freeing hands from industry if air is short. */
/** Hours of work waiting in the construction queue, at today's bandwidth. */
function backlog(hole: SimState): number {
  return hole.construction.queue.reduce((h, j) => h + j.work - j.done, 0) / bandwidth(hole);
}

export function adapt(hole: SimState): string | null {
  let freeHands = hole.workforce.total - hole.workforce.employed;
  let list = wants(hole);
  // Air first: a life support already in the queue goes to the front.
  if (list[0]?.room === "life_support") {
    const queued = hole.construction.queue.find((j) => hole.layout.rooms.find((r) => r.id === j.roomId)?.type === "life_support");
    if (queued && hole.construction.queue[0] !== queued) applyCommand(hole, { type: "prioritize", jobId: queued.id });
  }
  // A long queue: more construction crews before anything else, and only essentials on top of it.
  const late = backlog(hole);
  if (late > 24 && count(hole, "construction_office") === 0) list = [{ room: "construction_office" }, ...list];
  if (late > 72) list = list.filter((w) => w.room === "life_support" || w.room === "construction_office");
  if (list[0]?.room === "life_support" && freeHands < roomDef("life_support").staff) {
    const spare = hole.layout.rooms.find((r) => EXPENDABLE.includes(r.type) && !r.paused && (hole.roomStatus[r.id]?.staff ?? 0) > 0);
    if (spare) {
      applyCommand(hole, { type: "setRoomControl", roomId: spare.id, paused: true });
      freeHands += hole.roomStatus[spare.id]!.staff;
    }
  }
  for (const w of list) {
    if (roomDef(w.room).staff > freeHands) continue; // it would stand empty
    if (placeAnywhere(hole, w.room, w.crop)) return w.room;
  }
  return null;
}
