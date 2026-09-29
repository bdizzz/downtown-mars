import raw from "../../data/condition.json";
import furnitureData from "../../data/furniture.json";
import type { SimConfig } from "./config";
import { isActive } from "./economy";
import { postMessage } from "./messages";
import type { RoomInstance } from "./placement";
import { roomDef, type RoomSize } from "./rooms";
import type { SimState } from "./state";

// Room condition and upkeep. Every room but a few (the entrance, stairs,
// the service rooms themselves) starts at 100% when it's built and wears
// down day by day. Worn rooms work slower (below 30%), stop altogether at 0,
// and make people unhappy (below 50%). Maintenance and cleaning services fix
// them: each service room is a lane that takes the worst room it may work
// on from the hole-wide queue (rooms at 60% or below) and repairs it back to
// 100%, at a pace set by its staff. A lane that stops hands its room back,
// part-done, to the front of the queue. Now and then something in a room
// breaks and knocks its condition down.
//
// Decay and breakdowns are decided without the hole's random stream, so
// upkeep never changes anything else's luck.

export const CONDITION = raw as unknown as {
  decayPerDay: number;
  heavyCategories: string[];
  heavyDecay: number;
  queueBelow: number;
  wornBelow: number;
  wornOutput: number;
  unhappyBelow: number;
  exempt: string[];
  cleanable: { categories: string[]; rooms: string[] };
  repairHoursBySize: Record<RoomSize, number>;
  leastRepair: number;
  laneWorkPerHour: number;
  happiness: { homeComfort: number; sharedComfort: number; cleanableWeight: number; otherWeight: number };
  breakdown: { chancePerDay: number; drop: [number, number]; earliestDay: number };
};

/** Which rooms a service room may repair: any, or only the cleanable (people-heavy) ones. */
export type Maintains = "all" | "cleanable";

export interface MaintenanceState {
  /** Each working service room's current job: the room it's repairing. */
  lanes: Record<number, { target: number }>;
}

/** Does this room have a condition at all? */
export function hasCondition(room: RoomInstance): boolean {
  const def = roomDef(room.type);
  return !CONDITION.exempt.includes(room.type) && !def.excavationOnly && !def.maintains;
}

/** A room's condition, 0..1 (1 for rooms without one, and for old saves). */
export function conditionOf(room: RoomInstance): number {
  return hasCondition(room) ? (room.condition ?? 1) : 1;
}

/** People-heavy rooms: homes, the galley, restrooms, the clinic and the like. Cleaning services tend these, and their wear upsets people more. */
export function isCleanable(type: string): boolean {
  return CONDITION.cleanable.rooms.includes(type) || CONDITION.cleanable.categories.includes(roomDef(type).category);
}

/** Can a service room of this kind work on that room? */
function mayWork(kind: Maintains, room: RoomInstance): boolean {
  return kind === "all" || isCleanable(room.type);
}

/** Rooms that wear: built, with a condition. */
function wearing(state: SimState): RoomInstance[] {
  return state.layout.rooms.filter((r) => isActive(r) && !r.building && hasCondition(r));
}

/** Rooms being worked on right now, by room id: the service room working it. */
export function beingRepaired(state: SimState): Map<number, number> {
  const out = new Map<number, number>();
  for (const [by, lane] of Object.entries(state.maintenance?.lanes ?? {})) out.set(lane.target, Number(by));
  return out;
}

/** The queue, in order: rooms at or below the threshold that no lane is working on. Part-repaired rooms first, then the worst. */
export function maintenanceQueue(state: SimState): RoomInstance[] {
  const busy = beingRepaired(state);
  return wearing(state)
    .filter((r) => !busy.has(r.id) && conditionOf(r) <= CONDITION.queueBelow)
    .sort((a, b) => Number(!!b.repair) - Number(!!a.repair) || conditionOf(a) - conditionOf(b) || a.id - b.id);
}

/** Work-hours to bring a room back to 100%: by its size and how worn it is. */
export function repairWork(room: RoomInstance): number {
  const hours = CONDITION.repairHoursBySize[roomDef(room.type).size] ?? CONDITION.repairHoursBySize.S;
  return hours * Math.max(CONDITION.leastRepair, 1 - conditionOf(room));
}

/** What a room's condition does to its output: slowed when worn, stopped at 0. */
export function conditionOutput(room: RoomInstance): { factor: number; limit?: "worn" | "broken" } {
  const c = conditionOf(room);
  if (c <= 0) return { factor: 0, limit: "broken" };
  if (c < CONDITION.wornBelow) return { factor: CONDITION.wornOutput, limit: "worn" };
  return { factor: 1 };
}

/** A deterministic 0..1 for this hole on this day (and a salt, for more than one draw). */
function roll(state: SimState, day: number, salt: number): number {
  let h = state.holeId * 2246822519 + day * 3266489917 + salt * 668265263;
  for (const ch of state.name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const furniture = furnitureData as unknown as { items: Record<string, { name: string; mount?: number; size: number[] }>; rooms: Record<string, string[]> };
/** Things in a room that can break: its standing furniture that's more than a rug. */
function breakables(type: string): string[] {
  return (furniture.rooms[type] ?? []).filter((id) => {
    const item = furniture.items[id];
    return item && item.mount === undefined && (item.size[2] ?? 0) > 0.3;
  });
}

/** A room's name for messages: its own, or its type's, with its floor. */
function where(room: RoomInstance): string {
  const name = room.name ?? roomDef(room.type).name;
  return room.at.kind === "ring" ? `${name} (floor ${room.at.floor})` : name;
}

export function stepCondition(state: SimState, cfg: SimConfig): void {
  const tpd = cfg.ticksPerDay;
  const ms = (state.maintenance ??= { lanes: {} });
  const busy = beingRepaired(state);

  // Wear: a little each tick, faster for heavy rooms; nothing while being repaired.
  for (const r of wearing(state)) {
    if (busy.has(r.id)) continue;
    const heavy = CONDITION.heavyCategories.includes(roomDef(r.type).category) ? CONDITION.heavyDecay : 1;
    r.condition = Math.max(0, (r.condition ?? 1) - (CONDITION.decayPerDay * heavy) / tpd);
  }

  // Breakdowns: once a day, maybe, something in one room.
  if (state.tick % tpd === 0) {
    const day = state.tick / tpd;
    const b = CONDITION.breakdown;
    const rooms = wearing(state).filter((r) => !busy.has(r.id) && breakables(r.type).length && conditionOf(r) > 0);
    if (day >= b.earliestDay && rooms.length && roll(state, day, 0) < b.chancePerDay) {
      const room = rooms[Math.floor(roll(state, day, 1) * rooms.length)]!;
      const things = breakables(room.type);
      const item = furniture.items[things[Math.floor(roll(state, day, 2) * things.length)]!]!;
      const drop = b.drop[0] + (b.drop[1] - b.drop[0]) * roll(state, day, 3);
      room.condition = Math.max(0, conditionOf(room) - drop);
      postMessage(state, cfg, `The ${item.name.toLowerCase()} in ${where(room)} broke down: it's down to ${Math.round(room.condition * 100)}%.`, "warn");
    }
  }

  // Lanes: each working service room repairs one room at a time.
  const byId = new Map(state.layout.rooms.map((r) => [r.id, r]));
  for (const svc of state.layout.rooms) {
    const kind = roomDef(svc.type).maintains;
    if (!kind) continue;
    const lane = ms.lanes[svc.id];
    const rate = isActive(svc) && !svc.building ? (state.roomStatus[svc.id]?.rate ?? 0) : 0;
    // Not working: whatever it had goes back to the front of the queue, part-done.
    if (rate <= 0) {
      delete ms.lanes[svc.id];
      continue;
    }
    let target = lane ? byId.get(lane.target) : undefined;
    if (lane && (!target || !hasCondition(target) || !isActive(target))) {
      delete ms.lanes[svc.id];
      target = undefined;
    }
    if (!target) {
      target = maintenanceQueue(state).find((r) => mayWork(kind, r));
      if (!target) continue;
      ms.lanes[svc.id] = { target: target.id };
      target.repair ??= { done: 0, work: repairWork(target) };
    }
    const job = (target.repair ??= { done: 0, work: repairWork(target) });
    job.done += (CONDITION.laneWorkPerHour * rate * 24) / tpd;
    if (job.done >= job.work - 1e-9) {
      target.condition = 1;
      delete target.repair;
      delete ms.lanes[svc.id];
    }
  }
  // Lanes whose service room is gone.
  for (const id of Object.keys(ms.lanes)) if (!byId.has(Number(id))) delete ms.lanes[Number(id)];
}

/** The hole's overall condition: every room's, weighted by its size (1 when there are none). */
export function overallCondition(state: SimState): number {
  let sum = 0;
  let weight = 0;
  for (const r of wearing(state)) {
    const w = Math.max(1, r.cells.length || r.surfaceCells.length);
    sum += conditionOf(r) * w;
    weight += w;
  }
  return weight ? sum / weight : 1;
}

/** How worn the rooms people share are: 0 (fine) to 1 (every one at 0%), weighted toward the people-heavy ones. Homes count for their own residents instead. */
export function sharedWear(state: SimState): number {
  const h = CONDITION.happiness;
  let sum = 0;
  let weight = 0;
  for (const r of wearing(state)) {
    if (roomDef(r.type).houses) continue;
    const w = isCleanable(r.type) ? h.cleanableWeight : h.otherWeight;
    sum += w * Math.max(0, (CONDITION.unhappyBelow - conditionOf(r)) / CONDITION.unhappyBelow);
    weight += w;
  }
  return weight ? sum / weight : 0;
}

/** A home's own wear, as lost comfort: 0 at or above half condition, up to the most at 0%. */
export function homeWearComfort(room: RoomInstance): number {
  const c = conditionOf(room);
  return c >= CONDITION.unhappyBelow ? 0 : -CONDITION.happiness.homeComfort * ((CONDITION.unhappyBelow - c) / CONDITION.unhappyBelow);
}

export interface MaintenanceView {
  /** The hole's overall condition, 0..1. */
  overall: number;
  /** The queue as shown: rooms at or below the threshold, in order, with how far along a returned one is. */
  queue: { roomId: number; condition: number; progress: number | null }[];
  /** Each service room, and what it's working on. */
  lanes: { by: number; kind: Maintains; target: number | null; condition: number | null; progress: number | null; working: boolean }[];
}

export function maintenanceView(state: SimState): MaintenanceView {
  const byId = new Map(state.layout.rooms.map((r) => [r.id, r]));
  const lanes = state.layout.rooms
    .filter((r) => roomDef(r.type).maintains && !r.building && isActive(r))
    .map((svc) => {
      const lane = state.maintenance?.lanes[svc.id];
      const t = lane ? byId.get(lane.target) : undefined;
      return {
        by: svc.id,
        kind: roomDef(svc.type).maintains!,
        target: t?.id ?? null,
        condition: t ? conditionOf(t) : null,
        progress: t?.repair ? t.repair.done / t.repair.work : null,
        working: (state.roomStatus[svc.id]?.rate ?? 0) > 0,
      };
    });
  return {
    overall: overallCondition(state),
    queue: maintenanceQueue(state).map((r) => ({ roomId: r.id, condition: conditionOf(r), progress: r.repair ? r.repair.done / r.repair.work : null })),
    lanes,
  };
}
