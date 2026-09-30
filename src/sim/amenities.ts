import type { SimConfig } from "./config";
import { conditionOutput } from "./condition";
import { isActive } from "./economy";
import { distancesFrom, pathsFor, STEP_M } from "./paths";
import type { Layout, RoomInstance } from "./placement";
import { roomDef, roomDefs } from "./rooms";
import type { SimState } from "./state";
import { falloff } from "./effects";

// What people use counts by how far they'd walk to it (milestone 11). A park,
// a plaza or a gym lifts the homes within its reach on foot, less the further
// they are; the nearest of each kind counts, so a second park next door adds
// nothing. Seats at galleys and canteens go to the homes nearest them first,
// as far as each reaches; the same nearest-first sharing serves clinics,
// schools and elder care (care.ts).

/** Walking distances (metres) from each home to what it can reach, kept until the layout changes. */
const walks = new WeakMap<Layout, { version: number; from: Map<number, Map<number, number>> }>();

/** The longest reach anything has, in metres: how far to look from each home. */
let longest: number | null = null;
function longestReachM(): number {
  if (longest === null) {
    longest = 0;
    for (const def of roomDefs) longest = Math.max(longest, def.reach ?? 0, def.amenity?.reach ?? 0);
    longest *= STEP_M;
  }
  return longest;
}
/** How far a room's service (seats, care, school places) reaches, in steps. Its amenity has its own reach. */
export function reachOf(type: string): number {
  return roomDef(type).reach ?? 0;
}

/**
 * Metres on foot from a room to everything within the longest reach there is.
 * A home on the surface (the landing pod) walks in through the entrance.
 */
export function walkFrom(layout: Layout, roomId: number): Map<number, number> {
  const room = layout.rooms.find((r) => r.id === roomId);
  if (room?.at.kind === "surface") {
    const door = layout.rooms.find((r) => r.at.kind === "ring" && roomDef(r.type).surfaceLink && !roomDef(r.type).cargoShaft);
    if (door && door.id !== roomId) return walkFrom(layout, door.id);
  }
  let hit = walks.get(layout);
  if (!hit || hit.version !== layout.version) {
    hit = { version: layout.version, from: new Map() };
    walks.set(layout, hit);
  }
  let d = hit.from.get(roomId);
  if (!d) {
    d = distancesFrom(pathsFor(layout), roomId, "walk", longestReachM());
    hit.from.set(roomId, d);
  }
  return d;
}

/** What amenities need to know: the layout, and how each room is running. */
type Where = Pick<SimState, "layout" | "roomStatus">;

/** How well a room is running, 0..1: its rate this tick (0 while stood down, broken or unbuilt). */
function running(state: Where, room: RoomInstance): number {
  return isActive(room) ? (state.roomStatus[room.id]?.rate ?? 0) : 0;
}

export interface AmenityFelt {
  comfort: number;
  health: number;
  /** Each kind of amenity counted: the room, how many steps away, and what it gave. */
  from: { roomId: number; type: string; steps: number; comfort: number; health: number }[];
}

/** The lift a home gets from the amenities within its reach on foot: the nearest (best) of each kind. */
export function amenityFelt(state: Where, home: RoomInstance): AmenityFelt {
  const byId = new Map(state.layout.rooms.map((r) => [r.id, r]));
  const best = new Map<string, AmenityFelt["from"][number]>();
  for (const [id, m] of walkFrom(state.layout, home.id)) {
    if (id === home.id) continue;
    const room = byId.get(id);
    const a = room && roomDef(room.type).amenity;
    if (!room || !a) continue;
    const steps = m / STEP_M;
    const k = running(state, room);
    const comfort = falloff(a.comfort ?? 0, a.reach, steps) * k;
    const health = falloff(a.health ?? 0, a.reach, steps) * k;
    if (!comfort && !health) continue;
    const had = best.get(room.type);
    if (!had || comfort + health > had.comfort + had.health) best.set(room.type, { roomId: id, type: room.type, steps, comfort, health });
  }
  const from = [...best.values()];
  return { comfort: from.reduce((s, f) => s + f.comfort, 0), health: from.reduce((s, f) => s + f.health, 0), from };
}

/**
 * Share out what services offer to the homes that want it, nearest first:
 * every pairing within the service's reach, shortest walk first, takes what
 * it can. Returns how much each home got, and how much each service gave.
 */
export function assignNearest(
  wants: { id: number; need: number }[],
  offers: { id: number; capacity: number; reachM: number }[],
  walk: (homeId: number) => Map<number, number>,
): { got: Map<number, number>; gave: Map<number, number> } {
  const pairs: { home: number; service: number; m: number }[] = [];
  const reach = new Map(offers.map((o) => [o.id, o.reachM]));
  for (const w of wants) {
    if (w.need <= 0) continue;
    for (const [id, m] of walk(w.id)) if (reach.has(id) && m <= reach.get(id)!) pairs.push({ home: w.id, service: id, m });
  }
  pairs.sort((a, b) => a.m - b.m || a.home - b.home || a.service - b.service);
  const need = new Map(wants.map((w) => [w.id, w.need]));
  const left = new Map(offers.map((o) => [o.id, o.capacity]));
  const got = new Map<number, number>();
  const gave = new Map<number, number>();
  for (const p of pairs) {
    const take = Math.min(need.get(p.home) ?? 0, left.get(p.service) ?? 0);
    if (take <= 0) continue;
    need.set(p.home, need.get(p.home)! - take);
    left.set(p.service, left.get(p.service)! - take);
    got.set(p.home, (got.get(p.home) ?? 0) + take);
    gave.set(p.service, (gave.get(p.service) ?? 0) + take);
  }
  return { got, gave };
}

/**
 * Seats at galleys and canteens, shared out to the homes within reach, nearest
 * first (by last update's residents). The homeless eat wherever there's a seat
 * left. Sets each home's share seated, and the hole's.
 */
export function updateDining(state: SimState, _cfg: SimConfig): void {
  const pop = state.population;
  const offers: { id: number; capacity: number; reachM: number }[] = [];
  let seats = 0;
  for (const r of state.layout.rooms) {
    const def = roomDef(r.type);
    if (!def.serves || !isActive(r)) continue;
    const st = state.roomStatus[r.id];
    const staffed = !st ? 0 : st.staffNeeded > 0 ? st.staff / st.staffNeeded : st.limit ? 0 : 1;
    const capacity = def.serves * staffed * conditionOutput(r).factor;
    seats += capacity;
    offers.push({ id: r.id, capacity, reachM: reachOf(r.type) * STEP_M });
  }
  const homes = state.happiness.pools.filter((p) => p.residents > 0).map((p) => ({ id: p.roomId, need: p.residents }));
  const { got, gave } = assignNearest(homes, offers, (id) => walkFrom(state.layout, id));
  const servedByHome: Record<number, number> = {};
  for (const h of homes) servedByHome[h.id] = Math.min(1, (got.get(h.id) ?? 0) / h.need);
  const spare = Math.max(0, seats - [...gave.values()].reduce((a, b) => a + b, 0));
  const homeless = state.happiness.homeless;
  const homelessServed = homeless > 0 ? Math.min(1, spare / homeless) : 1;
  const diners = homes.reduce((s, h) => s + h.need, 0) + homeless;
  const seated = [...got.values()].reduce((a, b) => a + b, 0) + Math.min(spare, homeless);
  pop.seats = seats;
  pop.servedByHome = servedByHome;
  pop.servedHomeless = homelessServed;
  pop.served = diners > 0 ? Math.min(1, seated / diners) : 1;
}
