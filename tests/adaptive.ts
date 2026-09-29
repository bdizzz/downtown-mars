import { maintenanceQueue } from "../src/sim/condition";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { elderCoverage, schoolCoverage } from "../src/sim/care";
import { beds } from "../src/sim/earth";
import { careCoverage } from "../src/sim/happiness";
import { roomDef } from "../src/sim/rooms";
import { bandwidth } from "../src/sim/construction";
import { network } from "../src/sim/network";
import { allocated, spaceOf, STORABLE, storageCaps } from "../src/sim/storage";
import { countStage, cryptSpace } from "../src/sim/people";
import type { SimState } from "../src/sim/state";
import { floorLinked } from "../src/sim/corridors";
import { footprint } from "../src/sim/placement";

// A scripted player that reacts: once a day it looks at what its hole is
// short of and builds the room that fixes it, in the first free spot on the
// gallery (ring 1) of any floor its stairs reach (keeping ring 1's last slot
// for the stairs themselves, which follow the drill down). Used after the fixed opening plans, so
// long playtests measure the game's systems rather than a stale build list.

/** The ring-1 slot every scripted player keeps for its stairs: the last one. */
export const stairSlot = (hole: SimState) => hole.layout.hole.ringSlots[0]! - 1;

/**
 * Stairs down to the deepest dug floor: a stack in ring 1's last slot, one
 * floor at a time, starting from floor 1 (next to the entrance's floor).
 * Returns true if it queued a piece.
 */
export function ensureStairs(hole: SimState): boolean {
  if (!wantsDeeper(hole)) return false;
  const slot = stairSlot(hole);
  const stairs = hole.layout.rooms.find((r) => r.type === "stairwell" && r.at.kind === "ring" && r.at.ring === 1 && r.at.slot === slot);
  const floors = stairs ? [...stairs.cells, ...(stairs.pendingCells ?? [])].map((c) => c.floor) : [];
  const bottom = floors.length ? Math.max(...floors) : 1;
  if (bottom >= hole.layout.hole.floors) return false;
  return applyCommand(hole, { type: "build", room: "stairwell", at: { kind: "ring", floor: bottom, ring: 1, slot, w: 1, d: 1 } }).ok;
}

/** Does the hole need its stairs to go deeper: a room waiting on a floor they don't reach, or ring 1 full where they do? */
function wantsDeeper(hole: SimState): boolean {
  const l = hole.layout;
  if (l.rooms.some((r) => r.at.kind === "ring" && r.cells.some((c) => !floorLinked(l, c.floor)))) return true;
  const slot = stairSlot(hole);
  for (let floor = 1; floor <= l.hole.floors; floor++) {
    if (!floorLinked(l, floor)) continue;
    for (let s = 0; s < l.hole.ringSlots[0]!; s++) if (s !== slot && !l.grid[floor - 1]?.[0]?.[s]) return false;
  }
  return true;
}

/**
 * Short of rock: dig out an empty room for it (unless one's already being dug),
 * in the rock of ring 3 and out, on floors the stairs reach. Returns true if it queued one.
 */
export function quarry(hole: SimState): boolean {
  const l = hole.layout;
  if (hole.construction.queue.some((j) => roomDef(l.rooms.find((r) => r.id === j.roomId)?.type ?? "entrance").excavationOnly)) return false;
  const [w, d] = config.shapes.M![0]!;
  for (let floor = 1; floor <= l.hole.floors; floor++) {
    if (!floorLinked(l, floor)) continue;
    for (let ring = l.hole.unlockedRings; ring >= 2; ring--) {
      for (let slot = 0; slot < l.hole.ringSlots[ring - 1]!; slot += 2) {
        const r = applyCommand(hole, { type: "build", room: "empty_room_m", at: { kind: "ring", floor, ring, slot, w, d } });
        if (r.ok) return true;
      }
    }
  }
  return false;
}

/** Build a room wherever it fits: on the surface, or on ring 1 of the shallowest floor the stairs reach, with room. */
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
    if (!floorLinked(hole.layout, floor)) continue; // no way down yet
    for (let slot = 0; slot < slots; slot++) {
      if (footprint(hole.layout.hole, floor, 1, slot, w, d).some((c) => c.ring === 1 && c.slot === stairSlot(hole))) continue;
      const r = applyCommand(hole, { type: "build", room, at: { kind: "ring", floor, ring: 1, slot, w, d } });
      if (r.ok) {
        if (crop) applyCommand(hole, { type: "setCrop", roomId: r.roomId!, crop });
        return true;
      }
      // Can't afford it anywhere: stop looking (short of rock, dig some out).
      if (/more rock/.test(r.reason)) quarry(hole);
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
  } else if (pop >= 30 && (res.water ?? 0) < pop * 4 && count(hole, "water_recycler") * 36 < pop * 1.5) {
    // Water down to about two days' worth: stop leaning on Earth before it runs dry between drops.
    out.push({ room: "water_recycler" });
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

/**
 * Keep storage ahead of the goods: anything filling up (or coming in with
 * nowhere to go) gets free space in a storage room; with none free, a
 * warehouse goes on the list. Once a day.
 */
export function tendStorage(hole: SimState): boolean {
  const caps = storageCaps(hole);
  const day = hole.ledger.days.at(-1) ?? hole.ledger.current;
  const inflow = (id: string) => Object.values(day[id]?.in ?? {}).reduce((a, b) => a + b, 0);
  // Gathering a seed kit: room for the kit on top of what the hole needs.
  const kit = hole.gatheringKit ? network.seedKit.goods : {};
  const tight = STORABLE.filter((id) => {
    const cap = caps[id] ?? 0;
    if (!Number.isFinite(cap)) return false;
    if ((kit[id] ?? 0) * 2.5 > cap) return true;
    return inflow(id) > 0 && (hole.resources[id] ?? 0) >= cap * 0.75 - 1;
  });
  let needMore = false;
  for (const id of tight) {
    const room = hole.layout.rooms.find((r) => !r.building && !r.planned && spaceOf(r) - allocated(r) >= 10);
    if (!room) {
      needMore = true;
      continue;
    }
    const give = Math.min(spaceOf(room) - allocated(room), 60);
    applyCommand(hole, { type: "setAllocation", roomId: room.id, allocation: { ...(room.allocation ?? {}), [id]: (room.allocation?.[id] ?? 0) + give } });
  }
  // Nothing free: more storage (unless one's already on the way).
  const onTheWay = hole.layout.rooms.some((r) => r.building && spaceOf(r) > 0);
  if (needMore && !onTheWay) return placeStorage(hole);
  return false;
}

/** A warehouse out of the way (ring 3, then ring 2, of any dug floor), with a corridor carved to it. */
function placeStorage(hole: SimState): boolean {
  const [w, d] = config.shapes.M![0]!;
  for (const ring of [3, 2]) {
    if (ring > hole.layout.hole.unlockedRings) continue;
    for (let floor = 1; floor <= hole.layout.hole.floors; floor++) {
      if (!floorLinked(hole.layout, floor)) continue;
      for (let slot = 0; slot < hole.layout.hole.ringSlots[ring - 1]!; slot++) {
        const r = applyCommand(hole, { type: "build", room: "warehouse", at: { kind: "ring", floor, ring, slot, w, d } });
        if (r.ok) {
          applyCommand(hole, { type: "connectRoom", roomId: r.roomId!, finish: "rock" });
          return true;
        }
        if (/^(Needs|Not enough)/.test(r.reason)) return false;
      }
    }
  }
  return false;
}

/**
 * Keep rooms in repair: a maintenance room once rooms start wearing, and
 * another whenever the queue grows longer than the crews can keep up with. Once a day.
 */
export function tendUpkeep(hole: SimState): boolean {
  const queue = maintenanceQueue(hole).length;
  const crews = count(hole, "maintenance") + count(hole, "cleaning_service");
  if (queue < 3 || queue <= crews * 2) return false;
  if (!placeAnywhere(hole, "maintenance")) return false;
  // Upkeep comes first: it takes its crew ahead of ordinary rooms.
  const built = hole.layout.rooms.filter((r) => r.type === "maintenance").at(-1)!;
  applyCommand(hole, { type: "setPriority", roomId: built.id, priority: "high" });
  return true;
}
