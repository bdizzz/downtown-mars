import raw from "../../data/materials.json";
import conditionRaw from "../../data/condition.json";
import type { SimConfig } from "./config";
import { shortfall } from "./corridors";
import { isActive } from "./economy";
import { edgeById, edgeLengthM, isGalleryEdge } from "./edges";
import type { Layout, RoomInstance } from "./placement";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

// Room linings (docs/PLAN-M15.md): what a room's walls and floor are made of.
// Every room starts as bare rock, and absent fields mean just that, so old
// saves need nothing. A lining makes a room nicer to be in and slower to wear,
// by how much depending on the kind of room: homes feel the comfort in full,
// people rooms (the galley, restrooms, the clinic…) lift everyone's shared
// comfort, heavy rooms (industry, power, air, water) get none but wear slower
// still, and the rest only wear slower.

export type Material = "rock" | "marscrete" | "brick" | "metal";
export type Finish = "base" | "fine";
export type LiningKind = "home" | "people" | "heavy" | "other";

export interface WallStep {
  material: Material;
  finish: Finish;
  name: string;
  /** Per cell; a fine finish's is on top of its base step's. */
  cost: Record<string, number>;
  work: number;
  comfort: number;
  wear: number;
}

export interface FlooringDef {
  id: string;
  name: string;
  cost: Record<string, number>;
  work: number;
  comfort: number;
}

export const MATERIALS = raw as unknown as {
  walls: WallStep[];
  floorings: FlooringDef[];
  kinds: Record<LiningKind, { comfort: number; wearBenefit: number }>;
  byCategory: Record<string, LiningKind>;
  byRoom: Record<string, LiningKind>;
  shared: { scale: number; max: number };
  leastWear: number;
  refit: { output: number; comfort: number };
  salvage: { share: number; lost: string[]; stripWork: number };
  corridor: { perSegment: number };
  exempt: string[];
};

const cleanable = conditionRaw as unknown as { cleanable: { categories: string[]; rooms: string[] } };

/** The wall step for a material and finish (bare rock for anything unknown). */
export function wallStep(material: string | undefined, finish: string | undefined): WallStep {
  return MATERIALS.walls.find((w) => w.material === (material ?? "rock") && w.finish === (finish ?? "base")) ?? MATERIALS.walls[0]!;
}

/** A lining's id, as corridors store it and the views name its look: "brick", "brick_fine". */
export function liningId(step: WallStep): string {
  return step.finish === "fine" ? `${step.material}_fine` : step.material;
}

/** The wall step a lining id names, or null (a gallery tube, or anything unknown). */
export function liningById(id: string | undefined): WallStep | null {
  return MATERIALS.walls.find((w) => liningId(w) === id) ?? null;
}

export function flooringDef(id: string | undefined): FlooringDef | null {
  return id ? (MATERIALS.floorings.find((f) => f.id === id) ?? null) : null;
}

/** Can this room have a lining? Ring rooms with walls: not surface buildings, the entrance, stairs and lifts, or empty rooms. */
export function canLine(room: RoomInstance): boolean {
  return room.at.kind === "ring" && !MATERIALS.exempt.includes(room.type) && !roomDef(room.type).excavationOnly;
}

/** The room's walls: its material and finish (bare rock when it has none, or can't have one). */
export function liningOf(room: RoomInstance): WallStep {
  return canLine(room) ? wallStep(room.material, room.finish) : MATERIALS.walls[0]!;
}

/** The room's floor upgrade, if any (null: it matches the walls). */
export function flooringOf(room: RoomInstance): FlooringDef | null {
  return canLine(room) ? flooringDef(room.flooring) : null;
}

/** What kind of room this is, for what its lining does. */
export function liningKind(type: string): LiningKind {
  const def = roomDef(type);
  const own = MATERIALS.byRoom[type];
  if (own) return own;
  if ((def.houses ?? 0) > 0) return "home";
  if (cleanable.cleanable.rooms.includes(type) || cleanable.cleanable.categories.includes(def.category)) return "people";
  return MATERIALS.byCategory[def.category] ?? "other";
}

/** The comfort the room's walls and floor give, before its kind is taken into account. */
function rawComfort(room: RoomInstance): number {
  return liningOf(room).comfort + (flooringOf(room)?.comfort ?? 0);
}

/** The comfort a home's lining gives its own residents (0 for any other room). */
export function liningComfort(room: RoomInstance): number {
  const kind = liningKind(room.type);
  return kind === "home" ? rawComfort(room) * MATERIALS.kinds.home.comfort : 0;
}

/** What a room's walls do to its wear: a multiplier on its daily decay. */
export function liningWear(room: RoomInstance): number {
  const benefit = MATERIALS.kinds[liningKind(room.type)].wearBenefit;
  return Math.max(MATERIALS.leastWear, 1 - (1 - liningOf(room).wear) * benefit);
}

/** Everyone's comfort from the linings of the people rooms they share: their average, scaled, up to the most. */
export function sharedLiningComfort(state: SimState): number {
  let sum = 0;
  let n = 0;
  for (const r of state.layout.rooms) {
    if (!isActive(r) || r.building || !canLine(r) || liningKind(r.type) !== "people") continue;
    sum += rawComfort(r) * MATERIALS.kinds.people.comfort;
    n++;
  }
  return n ? Math.min(MATERIALS.shared.max, (sum / n) * MATERIALS.shared.scale) : 0;
}

/** "Brick: comfort +0.5, wears 15% slower", for the room panel. */
export function liningText(room: RoomInstance): string {
  const walls = liningOf(room);
  const floor = flooringOf(room);
  const kind = liningKind(room.type);
  const comfort = kind === "home" || kind === "people" ? rawComfort(room) * MATERIALS.kinds[kind].comfort : 0;
  const slower = Math.round((1 - liningWear(room)) * 100);
  const gives = [
    comfort > 0 ? `comfort +${Math.round(comfort * 100) / 100}${kind === "people" ? " (shared)" : ""}` : "",
    slower > 0 ? `wears ${slower}% slower` : "",
  ].filter(Boolean);
  return `${walls.name}${floor ? `, ${floor.name.toLowerCase()} floor` : ""}${gives.length ? `: ${gives.join(", ")}` : ""}`;
}

// ---- refits (docs/PLAN-M15.md, "Upgrading") ----

/** A lining's own cost and work per cell, counting its base step under a fine finish. */
function whole(step: WallStep): { cost: Record<string, number>; work: number } {
  const base = step.finish === "fine" ? wallStep(step.material, "base") : null;
  const cost: Record<string, number> = { ...(base?.cost ?? {}) };
  for (const [r, v] of Object.entries(step.cost)) cost[r] = (cost[r] ?? 0) + v;
  return { cost, work: step.work + (base?.work ?? 0) };
}

function times(cost: Record<string, number>, n: number): Record<string, number> {
  return Object.fromEntries(Object.entries(cost).map(([r, v]) => [r, v * n]));
}

/** What comes back from taking out lining worth this much: a share, rounded down, less what's lost. */
function salvageOf(cost: Record<string, number>): Record<string, number> {
  const s = MATERIALS.salvage;
  const out: Record<string, number> = {};
  for (const [r, v] of Object.entries(cost)) {
    const back = Math.floor(v * s.share + 1e-9);
    if (back > 0 && !s.lost.includes(r)) out[r] = back;
  }
  return out;
}

/** What refitting a room's walls to another step takes: paid on commit, its work-hours, and what comes back when it's done. */
export interface RefitPlan {
  to: WallStep;
  cost: Record<string, number>;
  work: number;
  salvage: Record<string, number>;
}

/** Refitting a room from its lining to another, per cell times its cells. Null if it's the lining the room has. */
export function refitPlan(room: RoomInstance, to: WallStep): RefitPlan | null {
  return refitBetween(liningOf(room), to, Math.max(1, room.cells.length));
}

/**
 * Refitting `n` cells of walls from one lining to another. Within a material
 * only the finish changes: up pays the finish, down takes it out. To another
 * material the old lining comes out (stripping takes a share of its work and
 * gives back a share of it) and the new one goes in whole, base and finish.
 * Null if it's the same lining.
 */
function refitBetween(from: WallStep, to: WallStep, n: number): RefitPlan | null {
  if (from === to) return null;
  const strip = MATERIALS.salvage.stripWork;
  if (from.material === to.material) {
    const fine = from.finish === "fine" ? from : to;
    return to.finish === "fine"
      ? { to, cost: times(fine.cost, n), work: fine.work * n, salvage: {} }
      : { to, cost: {}, work: fine.work * strip * n, salvage: salvageOf(times(fine.cost, n)) };
  }
  const out = whole(from);
  const inn = whole(to);
  return { to, cost: times(inn.cost, n), work: (out.work * strip + inn.work) * n, salvage: salvageOf(times(out.cost, n)) };
}

/**
 * Why this refit can't be ordered, or null. `credit` is what a refit already
 * queued for the room would give back (the new one replaces it).
 */
export function refitRefusal(room: RoomInstance, plan: RefitPlan | null, resources: Record<string, number>, credit: Record<string, number> = {}): string | null {
  if (!canLine(room)) return `${roomDef(room.type).name} can't have a lining`;
  if (room.planned || room.building) return "Build it first";
  if (!plan) return `It's ${liningOf(room).name.toLowerCase()} already`;
  const have = { ...resources };
  for (const [r, v] of Object.entries(credit)) have[r] = (have[r] ?? 0) + v;
  return shortfall(have, plan.cost);
}

/** Is a refit under way in this room (its job started)? It runs at part output, and a home's comfort dips. */
export function refitting(state: SimState, room: RoomInstance): boolean {
  return !!state.construction?.queue.some((j) => j.kind === "upgrade" && j.roomId === room.id && j.done > 0);
}

/** What a refit under way does to a home's comfort (0 when there's none). */
export function refitComfort(state: SimState, room: RoomInstance): number {
  return refitting(state, room) ? MATERIALS.refit.comfort : 0;
}

/** "in brick", "back to bare rock": how a refit reads in the queue and the news. */
export function refitWords(to: WallStep): string {
  return to === MATERIALS.walls[0] ? "back to bare rock" : `in ${to.name.toLowerCase()}`;
}

/** "Refit", or "Strip" when it's back to bare rock. */
export function refitVerb(to: WallStep): "Refit" | "Strip" {
  return to === MATERIALS.walls[0] ? "Strip" : "Refit";
}

// ---- corridors (T-142) ----

/** A corridor's lining: its finish read as a wall step (null for a gallery tube, which is glass). */
export function corridorLining(layout: Layout, edgeId: string): WallStep | null {
  return liningById(layout.corridors[edgeId]);
}

/** Is this corridor segment in a refit job already? */
export function relining(layout: Layout, edgeId: string): boolean {
  return layout.corridorsRelining?.[edgeId] !== undefined;
}

/** Refitting one corridor segment: as a room's walls, a 10 m segment counting as `corridor.perSegment` cells. Costs to a tenth. */
export function corridorRefitPlan(layout: Layout, edgeId: string, to: WallStep, cfg: SimConfig): RefitPlan | null {
  const e = edgeById(layout.hole, edgeId);
  const from = corridorLining(layout, edgeId);
  if (!e || !from) return null;
  const n = (edgeLengthM(layout.hole, e, cfg.geometry.roomDepthM) / 10) * MATERIALS.corridor.perSegment;
  const plan = refitBetween(from, to, n);
  if (!plan) return null;
  const cost = Object.fromEntries(Object.entries(plan.cost).map(([r, v]) => [r, Math.max(0.1, Math.round(v * 10) / 10)]));
  return { ...plan, cost };
}

/** Why this corridor segment can't be refitted in this lining, or null (not counting what it costs). */
export function corridorRefitRefusal(layout: Layout, edgeId: string, to: WallStep): string | null {
  if (!layout.corridors[edgeId]) return "No corridor here";
  const e = edgeById(layout.hole, edgeId);
  if (!e || isGalleryEdge(e)) return "A gallery tube is glass: it can't be lined";
  if (layout.corridorsBuilding?.[edgeId] !== undefined) return "Build it first";
  if (layout.corridorsFilling?.[edgeId] !== undefined) return "It's being filled in";
  if (relining(layout, edgeId)) return "Already being refitted";
  if (corridorLining(layout, edgeId) === to) return `It's ${to.name.toLowerCase()} already`;
  return null;
}
