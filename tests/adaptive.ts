import { maintenanceQueue } from "../src/sim/condition";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { careCoverage, elderCoverage, schoolCoverage } from "../src/sim/care";
import { beds } from "../src/sim/earth";
import { roomDef } from "../src/sim/rooms";
import { bandwidth } from "../src/sim/construction";
import { network } from "../src/sim/network";
import { allocated, spaceOf, STORABLE, storageCaps } from "../src/sim/storage";
import { countStage, cryptSpace } from "../src/sim/people";
import type { SimState } from "../src/sim/state";
import { floorLinked } from "../src/sim/corridors";
import { footprint, type RoomInstance } from "../src/sim/placement";
import { missingCost } from "../src/sim/costs";
import { effectOnRoom } from "../src/sim/effects";
import { crowdedAir } from "../src/sim/happiness";
import { outsideEdges } from "../src/sim/edges";
import { viewAcross, wallOf, type Across } from "../src/sim/windows";

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

/** Does the hole need its stairs to go deeper: a room waiting on a floor they don't reach, or no room for a two-slot room on ring 1 where they do? */
function wantsDeeper(hole: SimState): boolean {
  const l = hole.layout;
  if (l.rooms.some((r) => r.at.kind === "ring" && r.cells.some((c) => !floorLinked(l, c.floor)))) return true;
  const slot = stairSlot(hole);
  const n = l.hole.ringSlots[0]!;
  const free = (floor: number, s: number) => s !== slot && !l.grid[floor - 1]?.[0]?.[s];
  for (let floor = 1; floor <= l.hole.floors; floor++) {
    if (!floorLinked(l, floor)) continue;
    for (let s = 0; s < n; s++) if (free(floor, s) && free(floor, (s + 1) % n)) return false;
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

/** Build a room wherever it fits: on the surface, or on ring 1 of the shallowest floor the stairs reach, with room (else ring 2, connected by a corridor). */
export function placeAnywhere(hole: SimState, room: string, crop?: string): boolean {
  const def = roomDef(room);
  if (def.size === "surface") {
    for (let slot = 0; slot < hole.layout.surface.length; slot++) {
      if (applyCommand(hole, { type: "build", room, at: { kind: "surface", slot } }).ok) return true;
    }
    return false;
  }
  const [w, d] = config.shapes[def.size as keyof typeof config.shapes]![0]!;
  // Ring 1 of the shallowest floor with room; failing that, ring 2 behind it, with a corridor carved to it.
  for (const ring of [1, 2]) {
    const slots = hole.layout.hole.ringSlots[ring - 1]!;
    for (let floor = 1; floor <= hole.layout.hole.floors; floor++) {
      if (!floorLinked(hole.layout, floor)) continue; // no way down yet
      for (let slot = 0; slot < slots; slot++) {
        if (footprint(hole.layout.hole, floor, ring, slot, w, d).some((c) => c.ring === 1 && c.slot === stairSlot(hole))) continue;
        const r = applyCommand(hole, { type: "build", room, at: { kind: "ring", floor, ring, slot, w, d } });
        if (r.ok) {
          if (crop) applyCommand(hole, { type: "setCrop", roomId: r.roomId!, crop });
          if (ring > 1) applyCommand(hole, { type: "connectRoom", roomId: r.roomId!, finish: "rock" });
          return true;
        }
        // Can't afford it anywhere: stop looking (short of rock, dig some out).
        if (/more rock/.test(r.reason)) quarry(hole);
        if (/^(Needs|Not enough|Unlocks)/.test(r.reason)) return false;
      }
    }
  }
  return false;
}

const count = (hole: SimState, type: string) => hole.layout.rooms.filter((r) => r.type === type).length;
const limited = (hole: SimState, what: string) =>
  hole.layout.rooms.some((r) => !r.planned && hole.roomStatus[r.id]?.limit === what);

/** What this hole needs most right now, in order of urgency. */
export function wants(hole: SimState): { room: string; crop?: string; near?: Need }[] {
  const pop = hole.population.count;
  const res = hole.resources;
  const met = hole.population.needsMet;
  const out: { room: string; crop?: string; near?: Need }[] = [];
  if ((res.co2 ?? 0) > 30 || (met.o2 ?? 1) < 1 || count(hole, "life_support") * 30 < pop) out.push({ room: "life_support" });
  if (limited(hole, "power")) out.push({ room: "solar_array" });
  // Maintenance eats machinery: another machine shop once there's barely any left for building.
  const shops = count(hole, "machine_shop");
  if (shops > 0 && (res.machinery ?? 0) < 6 && shops * roomDef("machine_shop").makes.machinery! < count(hole, "maintenance") * roomDef("maintenance").uses.machinery! + 1) out.push({ room: "machine_shop" });
  if ((met.water ?? 1) < 1 || limited(hole, "water")) {
    out.push({ room: count(hole, "water_recycler") * 36 < pop * 1.5 ? "water_recycler" : "water_tank" });
  } else if (pop >= 30 && (res.water ?? 0) < pop * 4 && count(hole, "water_recycler") * 36 < pop * 1.5) {
    // Water down to about two days' worth: stop leaning on Earth before it runs dry between drops.
    out.push({ room: "water_recycler" });
  }
  if (count(hole, "galley") * 25 < pop) out.push({ room: "galley" });
  else if (shortHome(hole, "seats")) out.push({ room: "galley", near: "seats" });
  if (count(hole, "farm") * 12 < pop * 0.6) out.push({ room: "farm", crop: "potatoes" });
  if (hole.population.sanitation < 0.99) out.push({ room: "restroom" });
  if ((res.soil ?? 0) < 20 && count(hole, "farm") > 0 && (res.organicWaste ?? 0) > 10) out.push({ room: "composter" });
  if (countStage(hole, "elder") > cryptSpace(hole)) out.push({ room: "crypt" });
  // Services within reach: near the home that's shortest of them.
  if (careCoverage(hole) < 1) out.push({ room: "clinic", near: "care" });
  if (schoolCoverage(hole).missing > 0) out.push({ room: "school", near: "school" });
  if (elderCoverage(hole).missing > 0) out.push({ room: "elder_care", near: "elders" });
  if (staleHome(hole)) out.push({ room: "ventilation_hub" });
  // Glass running low, and homes still without windows: a glassworks of its own.
  if ((res.glass ?? 0) < 20 && count(hole, "glassworks") === 0 && hole.layout.rooms.some((r) => roomDef(r.type).houses && !r.planned && !r.windows?.length && r.at.kind === "ring")) out.push({ room: "glassworks" });
  // More homes only while the hole is doing well, leaving room for births.
  // …and only with the air for a dorm's worth more, or the means to build it: beds without air to breathe are no use.
  const airFor = count(hole, "life_support") * roomDef("life_support").makes.o2!;
  const canBreathe = airFor >= pop + roomDef("bunk_dorm").houses! || missingCost(res, "life_support") === null;
  // Better homes once they're unlocked and affordable (bunks are crowded); bunks otherwise.
  const home = (hole.unlocks ?? []).includes("basicHomes") && missingCost(res, "apartment") === null ? "apartment" : "bunk_dorm";
  if (beds(hole) - pop < 6 && hole.population.health >= 70 && hole.happiness.average >= 50 && canBreathe) out.push({ room: home });
  return out;
}

/** The home with the stalest air, if any is bad enough to fix. */
function staleHome(hole: SimState): RoomInstance | undefined {
  const homes = hole.layout.rooms.filter((r) => r.at.kind === "ring" && !r.building && (roomDef(r.type).houses ?? 0) > 0);
  // The air at home: the network's, and stuffiness from crowding.
  const air = (r: RoomInstance) => effectOnRoom(hole.effects.field, "airQuality", r) + crowdedAir(hole, r);
  return homes.filter((r) => air(r) < -0.4).sort((a, b) => air(a) - air(b))[0];
}

/** A ventilation hub as close to the stale home as it'll go. */
function ventilate(hole: SimState): boolean {
  const home = staleHome(hole);
  return !!home && placeNear(hole, "ventilation_hub", home);
}

/** What a home can be short of, within reach: seats, or clinic, school or elder-care places. */
type Need = "seats" | "care" | "school" | "elders";

/** The home with the smallest share of a need met within reach, if any is short. */
function shortHome(hole: SimState, need: Need): RoomInstance | undefined {
  const pop = hole.population;
  const by: Record<string, number> =
    need === "seats" ? (pop.servedByHome ?? {}) : Object.fromEntries(Object.entries(pop.care?.byHome ?? {}).map(([id, c]) => [id, c[need]]));
  const worst = Object.entries(by).filter(([, v]) => v < 0.98).sort((a, b) => a[1] - b[1])[0];
  const home = worst ? hole.layout.rooms.find((r) => r.id === Number(worst[0])) : undefined;
  // The pod's people walk in from the entrance: a galley near that.
  if (home?.at.kind === "surface") return hole.layout.rooms.find((r) => r.type === "entrance");
  return home;
}

/**
 * A room as close to another as it'll go: ring 1 of its floor, then of the floors around it, then
 * ring 2 (with a corridor carved to it). Nearest by angle first.
 */
function placeNear(hole: SimState, type: string, home: RoomInstance): boolean {
  if (home.at.kind !== "ring") return false;
  const [w, d] = config.shapes[roomDef(type).size as keyof typeof config.shapes]![0]!;
  const angle = (home.at.slot + 0.5) / hole.layout.hole.ringSlots[home.at.ring - 1]!;
  const byAngle = (ring: number) => {
    const n = hole.layout.hole.ringSlots[ring - 1]!;
    const gap = (s: number) => Math.min(Math.abs((s + 0.5) / n - angle), 1 - Math.abs((s + 0.5) / n - angle));
    return [...Array(n).keys()].sort((a, b) => gap(a) - gap(b));
  };
  const floors = [home.at.floor, home.at.floor - 1, home.at.floor + 1].filter((f) => f >= 1 && floorLinked(hole.layout, f));
  for (const ring of [1, 2]) {
    for (const floor of floors) {
      for (const slot of byAngle(ring)) {
        if (footprint(hole.layout.hole, floor, ring, slot, w, d).some((c) => c.ring === 1 && c.slot === stairSlot(hole))) continue;
        const r = applyCommand(hole, { type: "build", room: type, at: { kind: "ring", floor, ring, slot, w, d } });
        if (r.ok) {
          if (ring > 1) applyCommand(hole, { type: "connectRoom", roomId: r.roomId!, finish: "rock" });
          return true;
        }
        if (/^(Needs|Not enough)/.test(r.reason)) return false;
      }
    }
  }
  return false;
}

/** Rooms a player would stand down first to free hands for air, food and water. */
const EXPENDABLE = ["machine_shop", "smelter", "rover_depot", "staging_bay"];

/** Once a day, build the most urgent thing it can staff, freeing hands from industry if air is short. */
/** Hours of work waiting in the construction queue, at today's bandwidth. */
function backlog(hole: SimState): number {
  return hole.construction.queue.reduce((h, j) => h + j.work - j.done, 0) / bandwidth(hole);
}

/** `saving`: goods the player is saving up (a seed kit's); rooms that cost them wait, air excepted. */
export function adapt(hole: SimState, saving: string[] = []): string | null {
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
    if (w.room !== "life_support" && Object.keys(roomDef(w.room).cost).some((id) => saving.includes(id))) continue;
    const home = w.near ? shortHome(hole, w.near) : undefined;
    const placed = w.room === "ventilation_hub" ? ventilate(hole) : home ? placeNear(hole, w.room, home) : placeAnywhere(hole, w.room, w.crop);
    if (placed) return w.room;
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

/**
 * Windows in every home that has none: the wall with the best view (the
 * shaft, then a plaza, then a corridor), if there's metal for it. Once a day.
 */
export function tendWindows(hole: SimState): boolean {
  const layout = hole.layout;
  const rank = config.windows.view;
  let any = false;
  for (const room of layout.rooms) {
    if (!roomDef(room.type).houses || room.planned || room.windows?.length) continue;
    const own = new Set(room.cells.map((c) => `${c.floor}:${c.ring}:${c.slot}`));
    const walls = outsideEdges(layout.hole, room.cells)
      .map((e) => ({ e, across: viewAcross(layout, e, own) }))
      .filter((w): w is { e: (typeof w)["e"]; across: Across } => w.across !== null)
      .sort((a, b) => rank[b.across] - rank[a.across]);
    const best = walls[0];
    if (!best) continue;
    const wall = wallOf(layout, room, best.e.id) ?? [];
    const edges = wall.map((e) => e.id);
    if (applyCommand(hole, { type: "setWindows", roomId: room.id, edges, on: true }).ok) any = true;
  }
  return any;
}
