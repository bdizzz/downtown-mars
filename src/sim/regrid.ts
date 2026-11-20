import { config, type SimConfig } from "./config";
import { circleCuts, edgeById, outsideEdges, type Edge } from "./edges";
import { wrapSlot, type Hole } from "./geometry";
import { footprint, roomShapes, type Cell, type Layout, type RoomInstance } from "./placement";
import { roomDef } from "./rooms";
import { construction, type Job } from "./construction";
import type { PendingEvent } from "./events";

// Moving a hole onto a new ring grid (#548): equal-area rings at 9-18-18, from the old 9-9-18. Every ring's
// new slot count is a whole multiple of its old one, so each old slot becomes `factor` new ones at the same
// angles: a room keeps its place, only its slot numbers and width change. Edges follow: a radial line keeps its
// angle (its index multiplied), and an arc piece cut at new slot boundaries becomes the pieces covering it.
// Then rooms that now cover more than their standard footprint shrink in place (`shrinkOversized`).

/** What moving a hole's grid needs to know: its old and new slot counts. */
interface Regrid {
  old: Hole;
  next: Hole;
  /** factor[ring - 1]: new slots per old slot. */
  factor: number[];
}

/** Move a layout onto a hole with new slot counts and radii: rooms, the grids, corridors, bulkheads and windows. */
export function regridLayout(layout: Layout, next: Hole): void {
  const old = layout.hole;
  const factor = next.ringSlots.map((n, i) => {
    const was = old.ringSlots[i] ?? n;
    if (n % was) throw new Error(`ring ${i + 1}: ${n} slots isn't a multiple of ${was}`);
    return n / was;
  });
  const g: Regrid = { old, next, factor };
  layout.hole = { ...next, floors: old.floors, unlockedRings: old.unlockedRings };

  const row = (cells: number[] | undefined, ring: number) => (cells ?? []).flatMap((v) => new Array<number>(factor[ring - 1] ?? 1).fill(v));
  layout.grid = layout.grid.map((rings) => next.ringSlots.map((n, i) => padTo(row(rings[i], i + 1), n)));
  if (layout.open) layout.open = layout.open.map((rings) => next.ringSlots.map((n, i) => padTo(row(rings[i], i + 1), n)));

  for (const room of layout.rooms) {
    if (room.at.kind === "ring") {
      const f = factor[room.at.ring - 1] ?? 1;
      room.at = { ...room.at, slot: wrapSlot(room.at.slot * f, next.ringSlots[room.at.ring - 1] ?? 1), w: room.at.w * f };
    }
    room.cells = regridCells(g, room.cells);
    if (room.pendingCells) room.pendingCells = regridCells(g, room.pendingCells);
    if (room.windows) room.windows = dedupe(room.windows.flatMap((id) => regridEdge(g, id)));
  }
  layout.corridors = regridMap(g, layout.corridors);
  for (const key of ["corridorsBuilding", "corridorsFilling", "corridorsRelining", "bulkheads"] as const) {
    const map = layout[key];
    if (map) (layout as unknown as Record<string, unknown>)[key] = regridMap(g, map as Record<string, unknown>);
  }
  delete layout.corridorLinked;
  layout.version++;
}

/** Move a hole's construction jobs and pending events onto the new grid, after `regridLayout` (old = the hole before). */
export function regridJobsAndEvents(old: Hole, layout: Layout, jobs: Job[], events: PendingEvent[]): void {
  const next = layout.hole;
  const g: Regrid = { old, next, factor: next.ringSlots.map((n, i) => n / (old.ringSlots[i] ?? n)) };
  const hoursPerSlot = construction.excavationHoursPerSlot;
  for (const job of jobs) {
    if (job.edges) job.edges = dedupe(job.edges.flatMap((id) => regridEdge(g, id)));
    for (const key of ["paidBy", "salvageBy"] as const) {
      const by = job[key];
      if (!by) continue;
      const out: Record<string, Record<string, number>> = {};
      for (const [id, costs] of Object.entries(by)) {
        const pieces = regridEdge(g, id);
        for (const p of pieces) out[p] = Object.fromEntries(Object.entries(costs).map(([r, v]) => [r, v / pieces.length]));
      }
      job[key] = out;
    }
    if (job.digCells && job.dig) {
      // Each old slot is now several: the digging takes as long per slot as before, so its hours grow with them.
      const cells = regridCells(g, job.digCells);
      const dig = cells.length * hoursPerSlot;
      const extra = dig - job.dig;
      job.done = job.done < job.dig ? (job.done * dig) / job.dig : job.done + extra;
      job.work += extra;
      job.dig = dig;
      job.digCells = cells;
    }
  }
  for (const e of events) if (e.cells) e.cells = regridCells(g, e.cells);
}

function padTo(row: number[], n: number): number[] {
  return row.length >= n ? row.slice(0, n) : [...row, ...new Array<number>(n - row.length).fill(0)];
}

function dedupe<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

function regridCells(g: Regrid, cells: Cell[]): Cell[] {
  return cells.flatMap((c) => {
    const f = g.factor[c.ring - 1] ?? 1;
    return Array.from({ length: f }, (_, i) => ({ ...c, slot: c.slot * f + i }));
  });
}

function regridMap<T>(g: Regrid, map: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [id, v] of Object.entries(map)) for (const p of regridEdge(g, id)) out[p] = v;
  return out;
}

/** The new edge ids covering an old one: the same radial line, or the arc pieces along an old piece. */
function regridEdge(g: Regrid, id: string): string[] {
  const e = edgeById(g.old, id);
  if (!e) return [id];
  if (e.kind === "radial") return [`R${e.floor}.${e.ring}.${e.index * (g.factor[e.ring - 1] ?? 1)}`];
  const out: string[] = [];
  const pieces = arcPiecesBetween(g.next, e);
  for (const p of pieces) out.push(p.id);
  return out.length ? out : [id];
}

/** The arc pieces of the new grid's same circle that lie within an old piece's span. */
function arcPiecesBetween(hole: Hole, e: Edge & { kind: "arc" }): Edge[] {
  const out: Edge[] = [];
  for (const [p, q] of circleCuts(hole, e.circle)) {
    let t = p / q;
    if (t < e.a0 - 1e-12) t += 1;
    if (t < e.a1 - 1e-12) {
      const piece = edgeById(hole, `A${e.floor}.${e.circle}.${p}/${q}`);
      if (piece) out.push(piece);
    }
  }
  return out;
}

/**
 * Rooms covering more than any shape their kind allows shrink in place to the biggest that fits inside what they
 * covered, keeping the part with their doors (the most corridors and walk-through neighbours along it). A deep
 * room whose kind has no deep shape any more becomes one ring deep. The freed slots stay dug, as empty space.
 * Rooms smaller than their kind's shape are left as they are (they work in proportion). Returns the rooms that shrank.
 */
export function shrinkOversized(layout: Layout, cfg: SimConfig = config): RoomInstance[] {
  const shrunk: RoomInstance[] = [];
  for (const room of layout.rooms) {
    const at = room.at;
    if (at.kind !== "ring") continue;
    const def = roomDef(room.type);
    if (def.size === "surface") continue;
    const shapes = roomShapes(def, cfg);
    if (shapes.some(([w, d]) => w === at.w && d === at.d)) continue;
    if (shrinkRoom(layout, room, shapes)) shrunk.push(room);
  }
  if (shrunk.length) layout.version++;
  return shrunk;
}

const cellKey = (c: Cell) => `${c.floor}:${c.ring}:${c.slot}`;

/** Shrink a ring room to the biggest of these shapes that fits inside it, where it has the most ways in. */
export function shrinkRoom(layout: Layout, room: RoomInstance, shapes: [number, number][]): boolean {
  const at = room.at;
  if (at.kind !== "ring") return false;
  const hole = layout.hole;
  const anchor = at.floor;
  const own = new Set(room.cells.map(cellKey));
  const mine = room.cells.filter((c) => c.floor === anchor);
  const cellsOf = (ring: number, slot: number, w: number, d: number) => footprint(hole, anchor, ring, slot, w, d);
  const doors = (cells: Cell[]) => {
    let score = 0;
    for (const e of outsideEdges(hole, cells)) {
      if (layout.corridors[e.id]) score += 2;
      if (room.windows?.includes(e.id)) score += 1;
    }
    // A walk-through neighbour (a plaza, a stairwell) is a way in too, but not the room's own freed part.
    for (const c of cells) {
      const n = hole.ringSlots[c.ring - 1]!;
      for (const s of [wrapSlot(c.slot - 1, n), wrapSlot(c.slot + 1, n)]) {
        const id = layout.grid[c.floor - 1]?.[c.ring - 1]?.[s];
        if (!id || own.has(`${c.floor}:${c.ring}:${s}`)) continue;
        const other = layout.rooms.find((r) => r.id === id);
        if (other && roomDef(other.type).public) score += 2;
      }
    }
    return score;
  };
  const bySize = [...shapes].sort((a, b) => b[0] * b[1] - a[0] * a[1]);
  for (const [w, d] of bySize) {
    let best: { ring: number; slot: number; score: number } | null = null;
    for (const c of mine) {
      if (c.ring + d - 1 > hole.ringSlots.length) continue;
      const cells = cellsOf(c.ring, c.slot, w, d);
      if (cells.length >= mine.length || !cells.every((x) => own.has(cellKey(x)))) continue;
      const score = doors(cells);
      if (!best || score > best.score) best = { ring: c.ring, slot: c.slot, score };
    }
    if (!best) continue;
    const floors = (cells: Cell[]) => [...new Set(cells.map((c) => c.floor))].sort((a, b) => a - b);
    const on = (fs: number[]) => fs.flatMap((f) => footprint(hole, f, best!.ring, best!.slot, w, d));
    const cells = on(floors(room.cells));
    const keep = new Set(cells.map(cellKey));
    for (const c of room.cells) {
      if (keep.has(cellKey(c))) continue;
      const row = layout.grid[c.floor - 1]?.[c.ring - 1];
      if (row && row[c.slot] === room.id) row[c.slot] = 0;
    }
    if (room.pendingCells) room.pendingCells = on(floors(room.pendingCells));
    room.at = { ...at, ring: best.ring, slot: best.slot, w, d };
    room.cells = cells;
    if (room.windows) {
      const walls = new Set(outsideEdges(hole, cells).map((e) => e.id));
      room.windows = room.windows.filter((id) => walls.has(id));
      if (!room.windows.length) delete room.windows;
    }
    return true;
  }
  return false;
}
