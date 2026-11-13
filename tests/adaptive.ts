import { airPct } from "../src/sim/air";
import { maintenanceQueue } from "../src/sim/condition";
import { capacities, roomSpec } from "../src/sim/economy";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { careCoverage, elderCoverage, schoolCoverage } from "../src/sim/care";
import { beds } from "../src/sim/earth";
import { roomDef } from "../src/sim/rooms";
import { canLine } from "../src/sim/materials";
import { bandwidth } from "../src/sim/construction";
import { network } from "../src/sim/network";
import { freeSpace, spaceOf, storageRooms } from "../src/sim/storage";
import { countStage, cryptSpace } from "../src/sim/people";
import type { SimState } from "../src/sim/state";
import { floorLinked } from "../src/sim/corridors";
import { spanRange, type RoomInstance } from "../src/sim/placement";
import { piecesOn } from "../src/sim/space";
import { missingCost } from "../src/sim/costs";
import { effectOnRoom } from "../src/sim/effects";
import { crowdedAir } from "../src/sim/happiness";
import { eventDef } from "../src/sim/events";
import { outsideEdges } from "../src/sim/edges";
import { viewAcross, wallOf, type Across } from "../src/sim/windows";
import { notchOf, ringAt } from "./spots";

// A scripted player that reacts: once a day it looks at what its hole is
// short of and builds the room that fixes it, in the first free spot on the
// gallery (ring 1) of any floor its stairs reach (keeping ring 1's last slot
// for the stairs themselves, which follow the drill down). Used after the fixed opening plans, so
// long playtests measure the game's systems rather than a stale build list.

/** The ring-1 slot of the grid every scripted player keeps for its stairs: the last one. */
export const stairSlot = (hole: SimState) => hole.layout.hole.ringSlots[0]! - 1;

const N = config.geometry.notchesPerTurn;
/** The angles kept for the stairs on ring 1: the grid's last slot. */
const stairRange = (hole: SimState) => ({ a0: notchOf(1, stairSlot(hole)), a1: N });

/**
 * Where a room of this type could start on a floor and ring, at its target area (PLAN-M17): wall to wall
 * from the start of each stretch no room holds, as a player packing a ring would. Ring 1 keeps the stairs' spot.
 */
export function starts(hole: SimState, type: string, floor: number, ring: number, span = spanRange(hole.layout.hole, type, ring, 1).target): number[] {
  const list = piecesOn(hole.layout, floor, ring);
  const keep = stairRange(hole);
  const taken = (p: { a0: number; a1: number; room: number }) => !!p.room || (ring === 1 && p.a0 >= keep.a0 && p.a1 <= keep.a1);
  // The free stretches, each from where it starts (after something taken) for as long as it runs.
  const runs: [number, number][] = [];
  const first = list.findIndex(taken);
  if (first < 0) runs.push([0, ring === 1 ? keep.a0 : N]);
  else {
    let run: [number, number] | null = null;
    for (let k = 1; k <= list.length; k++) {
      const p = list[(first + k) % list.length]!;
      if (taken(p)) {
        if (run) runs.push(run);
        run = null;
      } else if (run) run[1] += p.a1 - p.a0;
      else run = [p.a0, p.a0 + p.a1 - p.a0];
    }
  }
  const out: number[] = [];
  for (const [a, b] of runs) for (let x = a; x + span <= b; x += span) out.push(x % N);
  return out;
}

/**
 * Stairs down to the deepest dug floor: a stack in ring 1's last slot, one
 * floor at a time, starting from floor 1 (next to the entrance's floor).
 * Returns true if it queued a piece.
 */
export function ensureStairs(hole: SimState): boolean {
  if (!wantsDeeper(hole)) return false;
  const slot = stairSlot(hole);
  const stairs = hole.layout.rooms.find((r) => r.type === "stairwell" && r.at.kind === "ring" && r.at.ring === 1 && r.at.start === notchOf(1, slot));
  const floors = stairs ? [...stairs.cells, ...(stairs.pendingCells ?? [])].map((c) => c.floor) : [];
  const bottom = floors.length ? Math.max(...floors) : 1;
  if (bottom >= hole.layout.hole.floors) return false;
  return applyCommand(hole, { type: "build", room: "stairwell", at: ringAt(bottom, 1, slot) }).ok;
}

/** Does the hole need its stairs to go deeper: a room waiting on a floor they don't reach, or no room for a two-slot room on ring 1 where they do? */
function wantsDeeper(hole: SimState): boolean {
  const l = hole.layout;
  if (l.rooms.some((r) => r.at.kind === "ring" && r.cells.some((c) => !floorLinked(l, c.floor)))) return true;
  // Room on ring 1 for a medium room, somewhere the stairs reach?
  for (let floor = 1; floor <= l.hole.floors; floor++) {
    if (floorLinked(l, floor) && starts(hole, "bunk_dorm", floor, 1).length) return false;
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
  for (let floor = 1; floor <= l.hole.floors; floor++) {
    if (!floorLinked(l, floor)) continue;
    for (let ring = l.hole.unlockedRings; ring >= 2; ring--) {
      // Empty space is a fill room: twice its 100 m² at a go.
      const span = 2 * spanRange(l.hole, "empty_room_s", ring, 1).target;
      for (const start of starts(hole, "empty_room_s", floor, ring, span)) {
        const r = applyCommand(hole, { type: "build", room: "empty_room_s", at: { kind: "ring", floor, ring, start, span } });
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
  // Ring 1 of the shallowest floor with room; failing that, ring 2 behind it, with a corridor carved to it.
  for (const ring of [1, 2]) {
    for (let floor = 1; floor <= hole.layout.hole.floors; floor++) {
      if (!floorLinked(hole.layout, floor)) continue; // no way down yet
      for (const start of starts(hole, room, floor, ring)) {
        const r = applyCommand(hole, { type: "build", room, at: { kind: "ring", floor, ring, start } });
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
export function wants(hole: SimState): { room: string; crop?: string; holds?: string; near?: Need }[] {
  const pop = hole.population.count;
  const res = hole.resources;
  const met = hole.population.needsMet;
  const out: { room: string; crop?: string; holds?: string; near?: Need }[] = [];
  // The air: oxygen thin with no electrolyzer to make more (or every one flat out), then CO2
  // building up or too few scrubbers for everyone. A dip after digging just needs time to refill.
  const scrubs = roomDef("life_support").scrubs!.co2!;
  const splitters = hole.layout.rooms.filter((r) => r.type === "electrolyzer");
  const flatOut = splitters.length > 0 && splitters.every((r) => (hole.roomStatus[r.id]?.rate ?? 0) > 0.99);
  if (splitters.length === 0 || (airPct(hole, config, "o2") < config.air.o2Low && flatOut)) out.push({ room: "electrolyzer" });
  if (airPct(hole, config, "co2") > 0.5 || count(hole, "life_support") * scrubs < pop) out.push({ room: "life_support" });
  // Short of power: the solar arrays rest by night, so first enough battery to carry the night
  // (half a day's use, with a little over), then arrays to fill it by day.
  if (limited(hole, "power")) {
    const perDay = hole.layout.rooms.filter((r) => !r.planned && !r.building).reduce((n, r) => n + (roomSpec(r, config).uses.power ?? 0), 0);
    out.push({ room: (capacities(hole, config).power ?? 0) < perDay * 0.6 ? "battery_bank" : "solar_array" });
  }
  // Maintenance eats machinery: another machine shop once there's barely any left for building.
  const shops = count(hole, "machine_shop");
  if (shops > 0 && (res.machinery ?? 0) < 6 && shops * roomDef("machine_shop").makes.machinery! < count(hole, "maintenance") * roomDef("maintenance").uses.machinery! + 1) out.push({ room: "machine_shop" });
  // Water is a loop: enough recyclers to treat the gray water people and rooms make, and gray
  // tanks to ride out the gaps (full ones overflow, losing the water for good). Clean water short with treatment to spare: a clean tank.
  const treats = count(hole, "water_recycler") * roomDef("water_recycler").uses.grayWater!;
  const grayMade = pop * (config.colonists.needsPerDay.water ?? 0) * 1.25;
  if (treats < grayMade) out.push({ room: "water_recycler" });
  else if ((res.grayWater ?? 0) >= capacities(hole, config).grayWater! - 1) out.push({ room: "water_tank", holds: "grayWater" });
  else if ((met.water ?? 1) < 1 || limited(hole, "water")) out.push({ room: "water_tank" });
  if (count(hole, "galley") * 25 < pop) out.push({ room: "galley" });
  else if (shortHome(hole, "seats")) out.push({ room: "galley", near: "seats" });
  if (count(hole, "farm") * 12 < pop * 0.6) out.push({ room: "farm", crop: "potatoes" });
  // Restrooms within reach (T-006): near the home that's shortest of one.
  if (hole.population.sanitation < 0.99) out.push({ room: "restroom", near: "sanitation" });
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
  const airFor = count(hole, "life_support") * scrubs;
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

/** What a home can be short of, within reach: seats, restrooms, or clinic, school or elder-care places. */
type Need = "seats" | "sanitation" | "care" | "school" | "elders";

/** The home with the smallest share of a need met within reach, if any is short. */
function shortHome(hole: SimState, need: Need): RoomInstance | undefined {
  const pop = hole.population;
  const by: Record<string, number> =
    need === "seats" ? (pop.servedByHome ?? {}) : need === "sanitation" ? (pop.sanitationByHome ?? {}) : Object.fromEntries(Object.entries(pop.care?.byHome ?? {}).map(([id, c]) => [id, c[need]]));
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
  const angle = home.at.start + home.at.span / 2;
  const byAngle = (floor: number, ring: number) => {
    const half = spanRange(hole.layout.hole, type, ring, 1).target / 2;
    const gap = (s: number) => Math.min(Math.abs(s + half - angle) % N, N - (Math.abs(s + half - angle) % N));
    return starts(hole, type, floor, ring).sort((a, b) => gap(a) - gap(b) || a - b);
  };
  const floors = [home.at.floor, home.at.floor - 1, home.at.floor + 1].filter((f) => f >= 1 && floorLinked(hole.layout, f));
  for (const ring of [1, 2]) {
    for (const floor of floors) {
      for (const start of byAngle(floor, ring)) {
        const r = applyCommand(hole, { type: "build", room: type, at: { kind: "ring", floor, ring, start } });
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

/** The air's rooms: the CO2 scrubber and the electrolyzer. They jump the queue and skip the kit's savings. */
const AIR = ["life_support", "electrolyzer"];

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
  // Air first: a scrubber or electrolyzer already in the queue goes to the front.
  const air = list[0] && AIR.includes(list[0].room) ? list[0].room : null;
  if (air) {
    const queued = hole.construction.queue.find((j) => hole.layout.rooms.find((r) => r.id === j.roomId)?.type === air);
    if (queued && hole.construction.queue[0] !== queued) applyCommand(hole, { type: "prioritize", jobId: queued.id });
  }
  // A long queue: more construction crews before anything else, and only essentials on top of it.
  const late = backlog(hole);
  if (late > 24 && count(hole, "construction_office") === 0) list = [{ room: "construction_office" }, ...list];
  if (late > 72) list = list.filter((w) => AIR.includes(w.room) || w.room === "construction_office");
  // Gray water overflowing with no recycler at all (T-148): the first is as urgent as air.
  const grayFull = (hole.resources.grayWater ?? 0) >= (capacities(hole, config).grayWater ?? Infinity) - 1;
  const urgent = air ?? (grayFull && count(hole, "water_recycler") === 0 ? "water_recycler" : null);
  if (urgent && freeHands < roomDef(urgent).staff) {
    const spare = hole.layout.rooms.find((r) => EXPENDABLE.includes(r.type) && !r.paused && (hole.roomStatus[r.id]?.staff ?? 0) > 0);
    if (spare) {
      applyCommand(hole, { type: "setRoomControl", roomId: spare.id, paused: true });
      freeHands += hole.roomStatus[spare.id]!.staff;
    }
  }
  for (const w of list) {
    if (roomDef(w.room).staff > freeHands) continue; // it would stand empty
    if (!AIR.includes(w.room) && Object.keys(roomDef(w.room).cost).some((id) => saving.includes(id))) continue;
    const home = w.near ? shortHome(hole, w.near) : undefined;
    const placed = w.room === "ventilation_hub" ? ventilate(hole) : home ? placeNear(hole, w.room, home) : placeAnywhere(hole, w.room, w.crop);
    if (placed) {
      if (w.holds) applyCommand(hole, { type: "setHolds", roomId: hole.layout.rooms.at(-1)!.id, holds: w.holds });
      return w.room;
    }
  }
  return null;
}

/**
 * Keep storage ahead of the goods: every room allows everything, so the
 * space is shared, and rock could crowd out the food. With the rooms getting
 * full (or a seed kit needing room), a warehouse goes on the list. Once a day.
 */
export function tendStorage(hole: SimState): boolean {
  const rooms = storageRooms(hole.layout);
  const space = rooms.reduce((n, r) => n + spaceOf(r), 0);
  const free = rooms.reduce((n, r) => n + freeSpace(r), 0);
  // Gathering a seed kit: room for the kit on top of what the hole needs.
  const kit = hole.gatheringKit ? Object.values(network.seedKit.goods).reduce((a, b) => a + b, 0) : 0;
  const tight = free < space * FREE_SHARE + kit * 1.5;
  // More storage, unless one's already on the way.
  const onTheWay = hole.layout.rooms.some((r) => r.building && spaceOf(r) > 0);
  if (tight && !onTheWay) return placeStorage(hole);
  return false;
}

/** The share of its storage space the bot keeps free. */
const FREE_SHARE = 0.35;

/** A warehouse out of the way (ring 3, then ring 2, of any dug floor), with a corridor carved to it. */
function placeStorage(hole: SimState): boolean {
  for (const ring of [3, 2]) {
    if (ring > hole.layout.hole.unlockedRings) continue;
    for (let floor = 1; floor <= hole.layout.hole.floors; floor++) {
      if (!floorLinked(hole.layout, floor)) continue;
      for (const start of starts(hole, "warehouse", floor, ring)) {
        const r = applyCommand(hole, { type: "build", room: "warehouse", at: { kind: "ring", floor, ring, start } });
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
    const own = new Set(room.cells.map((c) => `${c.floor}:${c.ring}:${c.a0}`));
    const walls = outsideEdges(layout, room.cells)
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

/**
 * Refit one home when the crews have nothing else queued: in brick once there's brick to spare (over 60),
 * or else smoothed (rock over 120: the first month's bot makes no brick, so refits still get played). Once a day.
 */
export function tendLinings(hole: SimState): boolean {
  if (hole.construction?.queue.length) return false;
  const brick = (hole.resources.brick ?? 0) > 60;
  if (!brick && (hole.resources.rock ?? 0) <= 120) return false;
  const home = hole.layout.rooms.find((r) => roomDef(r.type).houses && canLine(r) && !r.planned && !r.building && (brick ? r.material !== "brick" : !r.material && !r.finish));
  return !!home && applyCommand(hole, { type: "upgradeRoom", roomId: home.id, material: brick ? "brick" : "rock", finish: brick ? "base" : "fine" }).ok;
}

/** Answer whatever events are waiting: the first choice it can afford (a festival only with food to spare). Once a day. */
export function tendEvents(hole: SimState): void {
  // A festival only with food to spare (a feast is 30); otherwise a toast.
  const plenty = (hole.resources.meals ?? 0) + (hole.resources.rations ?? 0) >= 120;
  for (const e of [...(hole.events?.pending ?? [])]) {
    for (const c of eventDef(e.kind).choices) {
      if (c.festival && !plenty) continue;
      if (applyCommand(hole, { type: "answerEvent", eventId: e.id, choice: c.id }).ok) break;
    }
  }
}
