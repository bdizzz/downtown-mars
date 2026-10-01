import raw from "../../data/corridors.json";
import type { SimConfig } from "./config";
import { cellEdges, edgeById, edgeLengthM, edgeSides, edgeVertices, galleryEdges, isGalleryEdge, outsideEdges, sharedEdges, type Edge } from "./edges";
import { ringSize, type Hole } from "./geometry";
import { resourceDef } from "./resources";
import { roomDef } from "./rooms";
import type { Cell, Layout, RoomInstance } from "./placement";
import { emptyCells } from "./excavation";

// Corridors run along the borders between cells, carved out of the rooms and
// rock on either side. They join up at shared vertices. Along the shaft wall
// they're gallery tubes: glass-walled walkways on the shaft side, built like
// any corridor (floor 1 starts with its gallery all the way round). The shaft
// itself is Mars air: people and goods come and go through the entrance on floor 1,
// and reach deeper floors by stairs and elevators, which join what they touch
// on every floor they span. Everything linked to the surface that way is
// reachable. Public rooms (plazas) count every side as a corridor, and so
// does empty space (excavated cells with no room). A room is connected if it
// opens onto a reachable corridor (a gallery tube counts) or public space.

export interface FinishDef {
  id: string;
  name: string;
  hint: string;
  /** Per 10 m of corridor. */
  cost: Record<string, number>;
  color: string;
  accent: string;
}

export const corridors = raw as unknown as {
  widthM: number;
  blocksEffects: string[];
  defaultFinish: string;
  /** The gallery tube: every corridor along the shaft wall is one, whatever finish was asked for. */
  gallery: FinishDef;
  /** A sealed door fitted across a built corridor segment. */
  bulkhead: { name: string; hint: string; cost: Record<string, number> };
  finishes: FinishDef[];
};

/** The finish a corridor on this edge gets: a gallery tube on the shaft wall, else the one asked for. */
export function finishFor(e: Edge, finish: string): string {
  return isGalleryEdge(e) ? corridors.gallery.id : finish;
}

export const CORRIDORS = "Corridors";

export function finishDef(id: string): FinishDef {
  if (id === corridors.gallery.id) return corridors.gallery;
  return corridors.finishes.find((f) => f.id === id) ?? corridors.finishes[0]!;
}

export function isFinish(id: string): boolean {
  return corridors.finishes.some((f) => f.id === id);
}

const roomIdAt = (layout: Layout, c: Cell | null) => (c ? (layout.grid[c.floor - 1]?.[c.ring - 1]?.[c.slot] ?? 0) : 0);

/** Why a corridor can't go on this edge, or null if it can. */
export function corridorRefusal(layout: Layout, edgeId: string): string | null {
  const hole = layout.hole;
  const e = edgeById(hole, edgeId);
  if (!e) return "Not a border";
  if (e.floor < 1 || e.floor > hole.floors + 1) return "That floor isn't dug yet";
  if (layout.corridors[edgeId]) return "Already a corridor";
  // A gallery tube hangs on the shaft wall, beside whatever ring 1 has there.
  if (isGalleryEdge(e)) return null;
  // Through rock is fine, but only where the hole reaches: both sides in unlocked rings.
  const sides = edgeSides(hole, e);
  if (sides.some((c) => !c || c.ring > hole.unlockedRings)) return `Ring ${hole.unlockedRings + 1}+ needs reinforcement frames`;
  const [a, b] = sides.map((c) => roomIdAt(layout, c));
  if (a && a === b) return "That's the middle of a room";
  return null;
}

/** What a corridor on this edge costs, in the finish. */
export function corridorCost(hole: Hole, e: Edge, finish: string, cfg: SimConfig): Record<string, number> {
  const scale = edgeLengthM(hole, e, cfg.geometry.roomDepthM) / 10;
  return Object.fromEntries(Object.entries(finishDef(finishFor(e, finish)).cost).map(([id, v]) => [id, Math.max(0.1, Math.round(v * scale * 10) / 10)]));
}

export function totalCost(hole: Hole, ids: string[], finish: string, cfg: SimConfig): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ids) {
    const e = edgeById(hole, id);
    if (!e) continue;
    for (const [r, v] of Object.entries(corridorCost(hole, e, finish, cfg))) out[r] = Math.round(((out[r] ?? 0) + v) * 10) / 10;
  }
  return out;
}

export function shortfall(resources: Record<string, number>, cost: Record<string, number>): string | null {
  const short = Object.entries(cost).filter(([id, v]) => (resources[id] ?? 0) + 1e-9 < v);
  if (!short.length) return null;
  return "Needs " + short.map(([id, v]) => `${Math.ceil((v - (resources[id] ?? 0)) * 10) / 10} more ${resourceDef(id).name.toLowerCase()}`).join(", ");
}

// ---- access ----

class Sets {
  private parent = new Map<string, string>();
  find(x: string): string {
    let p = this.parent.get(x) ?? x;
    if (p !== x) {
      p = this.find(p);
      this.parent.set(x, p);
    }
    return p;
  }
  /** Every key it has seen. */
  keys(): IterableIterator<string> {
    return this.parent.keys();
  }
  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

/** Where people and goods come from: the surface, through the entrance (or a cargo elevator). */
const SURFACE = "surface";
/** Join an edge's two ends. */
function join(sets: Sets, hole: Hole, e: Edge): void {
  const [v0, v1] = edgeVertices(hole, e);
  sets.union(v0, v1);
}

/** The corridor network: which vertices reach the shaft. Planned floors don't count yet. */
function network(layout: Layout): { sets: Sets; publicEdges: Map<string, number> } {
  const hole = layout.hole;
  const sets = new Sets();
  for (const id of Object.keys(layout.corridors)) {
    if (layout.corridorsBuilding?.[id] !== undefined) continue; // not built yet
    const e = edgeById(hole, id);
    if (e && e.floor <= hole.floors) join(sets, hole, e);
  }
  // Public rooms: every outside edge is walkable; a room spanning floors links them.
  const publicEdges = new Map<string, number>();
  for (const room of layout.rooms) {
    if (room.planned || room.building || room.at.kind !== "ring" || !roomDef(room.type).public) continue;
    let first: string | null = null;
    for (const e of outsideEdges(hole, openTo(room))) {
      join(sets, hole, e);
      publicEdges.set(e.id, room.id);
      const [v0] = edgeVertices(hole, e);
      if (first) sets.union(first, v0);
      else first = v0;
    }
    // The entrance opens onto the surface.
    if (first && roomDef(room.type).surfaceLink) sets.union(first, SURFACE);
  }
  // Old saves: the shaft still links every floor's shaft wall to the surface.
  if (layout.openShaft) for (let f = 1; f <= hole.floors; f++) for (const e of galleryEdges(hole, f)) sets.union(edgeVertices(hole, e)[0], SURFACE);
  // Empty space (excavated, no room) is walk-through too, one cell at a time.
  for (const cell of emptyCells(layout)) {
    for (const e of cellEdges(hole, cell)) {
      join(sets, hole, e);
      if (!publicEdges.has(e.id)) publicEdges.set(e.id, 0);
    }
  }
  return { sets, publicEdges };
}

/** The cells a public room opens from: all of them, except a cargo elevator, which opens only at its stop. */
export function openTo(room: RoomInstance): Cell[] {
  if (!roomDef(room.type).cargoShaft) return room.cells;
  const stop = Math.max(...room.cells.map((c) => c.floor));
  return room.cells.filter((c) => c.floor === stop);
}

/** Does this group of cells open onto a reachable gallery, corridor or public room? */
function opensOnto(layout: Layout, cells: Cell[], sets: Sets, publicEdges: Map<string, number>): boolean {
  const shaft = sets.find(SURFACE);
  return outsideEdges(layout.hole, cells).some((e) => {
    if (!layout.corridors[e.id] && !publicEdges.has(e.id)) return false;
    return sets.find(edgeVertices(layout.hole, e)[0]) === shaft;
  });
}

/** Which corridors are linked to the surface and which rooms are connected, without changing anything. */
function computeAccess(layout: Layout): { linked: Record<string, boolean>; connected: Map<number, boolean>; floors: boolean[] } {
  const { sets, publicEdges } = network(layout);
  const shaft = sets.find(SURFACE);
  // floors[f - 1]: is anything on floor f (stairs, a corridor, a plaza) reached from the surface?
  const floors = Array.from({ length: layout.hole.floors }, () => false);
  for (const v of sets.keys()) {
    const floor = Number(v.split("|")[0]);
    if (floor >= 1 && floor <= floors.length && !floors[floor - 1] && sets.find(v) === shaft) floors[floor - 1] = true;
  }
  const linked: Record<string, boolean> = {};
  for (const id of Object.keys(layout.corridors)) {
    const e = edgeById(layout.hole, id);
    const built = layout.corridorsBuilding?.[id] === undefined;
    linked[id] = built && !!e && e.floor <= layout.hole.floors && sets.find(edgeVertices(layout.hole, e)[0]) === shaft;
  }
  const connected = new Map<number, boolean>();
  for (const r of layout.rooms) connected.set(r.id, r.at.kind === "surface" || opensOnto(layout, r.cells, sets, publicEdges));
  return { linked, connected, floors };
}

/** Is there a bulkhead on this corridor segment (and the corridor still there)? */
export function hasBulkhead(layout: Layout, edgeId: string): boolean {
  return !!layout.bulkheads?.[edgeId] && !!layout.corridors?.[edgeId];
}

/** Why a bulkhead can't be fitted on this border (or, with `on` false, taken out), or null. */
export function bulkheadRefusal(layout: Layout, edgeId: string, on = true): string | null {
  if (!on) return hasBulkhead(layout, edgeId) ? null : "No bulkhead here";
  const e = edgeById(layout.hole, edgeId);
  if (!e || !layout.corridors?.[edgeId]) return "A bulkhead goes across a corridor: there's none here";
  if (isGalleryEdge(e)) return "Gallery tubes run open along the shaft: no bulkhead in one";
  if (layout.corridorsBuilding?.[edgeId] !== undefined) return "Not built yet";
  if (hasBulkhead(layout, edgeId)) return "Already has a bulkhead";
  return null;
}

/** Recompute which rooms and corridors reach the shaft. */
export function recomputeAccess(layout: Layout): void {
  layout.corridors ??= {};
  // A bulkhead goes with its corridor.
  for (const id of Object.keys(layout.bulkheads ?? {})) if (!layout.corridors[id]) delete layout.bulkheads![id];
  const { linked, connected, floors } = computeAccess(layout);
  layout.corridorLinked = linked;
  layout.floorLinked = floors;
  for (const r of layout.rooms) r.connected = connected.get(r.id)!;
}

/** Is this floor reached from the surface (through the entrance and stairs)? */
export function floorLinked(layout: Layout, floor: number): boolean {
  return layout.floorLinked?.[floor - 1] ?? false;
}

/** What filling these corridors in would cut off: rooms now connected, and corridors now linked, that no longer would be. */
export function strandedBy(layout: Layout, removed: string[]): { rooms: number[]; corridors: string[] } {
  if (!removed.length) return { rooms: [], corridors: [] };
  const gone = new Set(removed);
  const after = computeAccess({ ...layout, corridors: Object.fromEntries(Object.entries(layout.corridors).filter(([id]) => !gone.has(id))) });
  return {
    rooms: layout.rooms.filter((r) => r.connected && !after.connected.get(r.id)).map((r) => r.id),
    corridors: Object.keys(layout.corridors).filter((id) => !gone.has(id) && layout.corridorLinked?.[id] && !after.linked[id]),
  };
}

/** Corridors lying inside a group of cells (between two of them): what a room placed there would fill in. */
export function corridorsInside(layout: Layout, cells: Cell[]): string[] {
  const key = (c: Cell) => `${c.floor}:${c.ring}:${c.slot}`;
  const own = new Set(cells.map(key));
  const out = new Set<string>();
  for (const c of cells) {
    for (const e of cellEdges(layout.hole, c)) {
      if (!layout.corridors[e.id]) continue;
      if (edgeSides(layout.hole, e).every((x) => x && own.has(key(x)))) out.add(e.id);
    }
  }
  return [...out];
}

/** Would a room on these cells be connected as things stand? For the placement preview. */
export function wouldConnect(layout: Layout, cells: Cell[]): boolean {
  const { sets, publicEdges } = network(layout);
  return opensOnto(layout, cells, sets, publicEdges);
}

/** Do corridors run along the whole border between two cells? (They soak up noise and smell.) */
export function corridorBetween(layout: Layout, a: Cell, b: Cell): boolean {
  if (!layout.corridors || a.floor !== b.floor) return false;
  let any = false;
  for (const _ in layout.corridors) {
    any = true;
    break;
  }
  if (!any) return false;
  const shared = sharedEdges(layout.hole, a, b);
  return shared.length > 0 && shared.every((e) => layout.corridors[e.id]);
}

// ---- routing ----

/** Every edge on a floor, by the vertices at its ends. */
function floorGraph(hole: Hole, floor: number): Map<string, { e: Edge; to: string }[]> {
  const adj = new Map<string, { e: Edge; to: string }[]>();
  const add = (e: Edge) => {
    const [a, b] = edgeVertices(hole, e);
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ e, to: b });
    adj.get(b)!.push({ e, to: a });
  };
  const seen = new Set<string>();
  for (let ring = 1; ring <= hole.ringSlots.length; ring++) {
    for (let slot = 0; slot < ringSize(hole, ring); slot++) {
      for (const e of cellEdges(hole, { floor, ring, slot })) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        add(e);
      }
    }
  }
  return adj;
}

/**
 * The cheapest set of new corridor edges that connects a room: a shortest
 * path (by length, existing corridors free) over eligible edges on its floor,
 * from anything linked to the shaft to one of the room's own sides.
 * Returns null if there's no way, or [] if it's already connected.
 */
export function routeToRoom(layout: Layout, room: RoomInstance, cfg: SimConfig): string[] | null {
  if (room.connected || room.at.kind !== "ring") return room.at.kind === "ring" ? [] : null;
  const hole = layout.hole;
  const floor = room.at.floor;
  const { sets, publicEdges } = network(layout);
  const shaft = sets.find(SURFACE);
  const walkable = (e: Edge) => !!layout.corridors[e.id] || publicEdges.has(e.id);
  const usable = (e: Edge) => walkable(e) || corridorRefusal(layout, e.id) === null;
  const goal = new Set(outsideEdges(hole, room.cells).map((e) => e.id));
  const adj = floorGraph(hole, floor);

  // Dijkstra from every vertex already linked to the surface.
  const dist = new Map<string, number>();
  const prev = new Map<string, { from: string; e: Edge }>();
  const queue: [number, string][] = [];
  for (const v of adj.keys()) {
    if (sets.find(v) === shaft) {
      dist.set(v, 0);
      queue.push([0, v]);
    }
  }
  let best: { cost: number; at: string; e: Edge } | null = null;
  while (queue.length) {
    queue.sort((a, b) => a[0] - b[0]);
    const [d, v] = queue.shift()!;
    if (d > (dist.get(v) ?? Infinity) || (best && d >= best.cost)) continue;
    for (const { e, to } of adj.get(v) ?? []) {
      if (!usable(e)) continue;
      const step = walkable(e) ? 0 : edgeLengthM(hole, e, cfg.geometry.roomDepthM);
      if (goal.has(e.id)) {
        if (!best || d + step < best.cost) best = { cost: d + step, at: v, e };
        continue;
      }
      const nd = d + step;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prev.set(to, { from: v, e });
        queue.push([nd, to]);
      }
    }
  }
  if (!best) return null;
  const path: string[] = [];
  if (!walkable(best.e)) path.push(best.e.id);
  let v = best.at;
  while (prev.has(v)) {
    const p = prev.get(v)!;
    if (!walkable(p.e)) path.push(p.e.id);
    v = p.from;
  }
  return path.reverse();
}

/**
 * Saves from before edge corridors (v11 and older) had corridor rooms. Each
 * becomes corridors along its cell's borders with rooms or other old
 * corridor cells (and a ring-1 cell's spokes, which reached the gallery),
 * in bare rock; the cells themselves become empty.
 */
export function migrateCorridorRooms(layout: Layout): void {
  layout.corridors ??= {};
  const hole = layout.hole;
  const old = layout.rooms.filter((r) => r.type === "corridor");
  const key = (c: Cell) => `${c.floor}:${c.ring}:${c.slot}`;
  const oldCells = new Set(old.flatMap((r) => r.cells.map(key)));
  for (const room of old) {
    for (const cell of room.cells) {
      for (const e of cellEdges(hole, cell)) {
        const other = edgeSides(hole, e).find((c) => !c || key(c) !== key(cell)) ?? null;
        const spoke = e.kind === "radial" && cell.ring === 1;
        const otherRoom = other ? layout.grid[other.floor - 1]?.[other.ring - 1]?.[other.slot] : 0;
        if (spoke || (other && (oldCells.has(key(other)) || otherRoom))) layout.corridors[e.id] = corridors.defaultFinish;
      }
      layout.grid[cell.floor - 1]![cell.ring - 1]![cell.slot] = 0;
    }
  }
  layout.rooms = layout.rooms.filter((r) => r.type !== "corridor");
  recomputeAccess(layout);
}

export interface Joint {
  key: string;
  floor: number;
  /** The circle it's on (0 is the shaft wall). */
  circle: number;
  /** Angle in turns. */
  turn: number;
  /** The finish of one of the corridors meeting there, for drawing. */
  finish: string;
}

/**
 * Where corridors turn: vertices where a radial corridor and a ring corridor
 * meet. Each needs a square joint so the outer edges of the turn meet in a
 * clean corner (like a square line join), not a notch.
 */
export function corridorJoints(layout: Layout): Map<string, Joint> {
  const hole = layout.hole;
  const kinds = new Map<string, { radial: boolean; arc: boolean; finish: string; floor: number; circle: number; turn: number }>();
  for (const [id, finish] of Object.entries(layout.corridors ?? {})) {
    const e = edgeById(hole, id);
    if (!e) continue;
    const [v0, v1] = edgeVertices(hole, e);
    for (const v of [v0, v1]) {
      const [floor, circle, f] = v.split("|");
      const [p, q] = f!.split("/").map(Number);
      const k = kinds.get(v) ?? { radial: false, arc: false, finish, floor: Number(floor), circle: Number(circle), turn: p! / q! };
      if (e.kind === "radial") k.radial = true;
      else k.arc = true;
      kinds.set(v, k);
    }
  }
  const out = new Map<string, Joint>();
  for (const [key, k] of kinds) if (k.radial && k.arc) out.set(key, { key, floor: k.floor, circle: k.circle, turn: k.turn, finish: k.finish });
  return out;
}
