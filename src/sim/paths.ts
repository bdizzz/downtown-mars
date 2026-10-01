import { config } from "./config";
import { hasBulkhead, openTo } from "./corridors";
import { cellEdges, edgeById, edgeLengthM, edgeVertices, galleryEdges, outsideEdges } from "./edges";
import { emptyCells } from "./excavation";
import type { Cell, Layout, RoomInstance } from "./placement";
import { roomDef } from "./rooms";

// The sealed network as a graph with distances: how far a colonist walks, and
// how far air carries, from one room to another. The access check in
// corridors.ts only asks *whether* a room is reached; this asks *how far*.
//
// Nodes are the pieces of the network: each built corridor segment (gallery
// tubes too), each walk-through room on each of its floors (plazas, parks,
// stairs, elevators, the entrance), each dug-out empty cell, and each private
// room on each of its floors. Walkable pieces join where they share a corner;
// a private room joins the walkable pieces along its sides (its doors), and is
// never walked *through*. A room spanning floors (stairs, an elevator) links
// its floors; an elevator (`lift`) carries people but not air.
//
// Distances are metres: moving from one node to the next costs half of each
// one's length (a corridor segment's own length, a room's by its size), so a
// route counts half its two ends and all of what it passes through. A step
// (the unit reach is given in) is a room's width, 10 m.

/** Metres in a step: about one room across. */
export const STEP_M = config.geometry.roomDepthM;
/** Going up or down a floor inside stairs or an elevator. */
const FLOOR_M = STEP_M;

export type PathMode = "walk" | "air";

interface Node {
  /** A room's id for room nodes; 0 for corridors and empty space. */
  roomId: number;
  floor: number;
  /** Metres to cross it. */
  length: number;
  /** Can a route pass through it (not a private room)? */
  through: boolean;
  /** Sealed: people pass, air doesn't (a corridor segment with a bulkhead). */
  airtight?: boolean;
}

interface Link {
  to: string;
  cost: number;
  /** Carries air as well as people (not between floors in an elevator). */
  air: boolean;
}

export interface Paths {
  nodes: Map<string, Node>;
  links: Map<string, Link[]>;
  /** Each room's nodes (one per floor it's on). */
  byRoom: Map<number, string[]>;
  /** The walkable pieces along each border: what a room on one side of it opens onto. */
  byEdge: Map<string, string[]>;
}

const built = (r: RoomInstance) => !r.planned && !r.building;
const roomLength = (cells: number) => STEP_M * Math.sqrt(Math.max(1, cells));

/** Build the graph for a layout. Prefer `pathsFor`, which keeps it until the layout changes. */
export function buildPaths(layout: Layout): Paths {
  const hole = layout.hole;
  const depth = config.geometry.roomDepthM;
  const nodes = new Map<string, Node>();
  const links = new Map<string, Link[]>();
  const byRoom = new Map<number, string[]>();
  const byVertex = new Map<string, string[]>();
  const byEdge = new Map<string, string[]>();
  const add = (key: string, node: Node) => {
    nodes.set(key, node);
    links.set(key, []);
    if (node.roomId) byRoom.set(node.roomId, [...(byRoom.get(node.roomId) ?? []), key]);
  };
  const index = (map: Map<string, string[]>, k: string, node: string) => map.set(k, [...(map.get(k) ?? []), node]);
  const link = (a: string, b: string, air = true, cost?: number) => {
    if (a === b || links.get(a)!.some((l) => l.to === b)) return;
    const c = cost ?? (nodes.get(a)!.length + nodes.get(b)!.length) / 2;
    links.get(a)!.push({ to: b, cost: c, air });
    links.get(b)!.push({ to: a, cost: c, air });
  };

  // Corridor segments (and gallery tubes), once built.
  for (const id of Object.keys(layout.corridors ?? {})) {
    if (layout.corridorsBuilding?.[id] !== undefined) continue;
    const e = edgeById(hole, id);
    if (!e || e.floor > hole.floors) continue;
    const key = `c:${id}`;
    add(key, { roomId: 0, floor: e.floor, length: edgeLengthM(hole, e, depth), through: true, airtight: hasBulkhead(layout, id) });
    for (const v of edgeVertices(hole, e)) index(byVertex, v, key);
    index(byEdge, id, key);
  }
  // Under the dome, every floor's gallery is open walkway, as if tubes ran all the way round.
  if (layout.domed) {
    for (let f = 1; f <= hole.floors; f++) {
      for (const e of galleryEdges(hole, f)) {
        const key = `c:${e.id}`;
        if (nodes.has(key)) continue;
        add(key, { roomId: 0, floor: f, length: edgeLengthM(hole, e, depth), through: true });
        for (const v of edgeVertices(hole, e)) index(byVertex, v, key);
        index(byEdge, e.id, key);
      }
    }
  }
  // Rooms, floor by floor: walk-through ones join by their corners and sides, private ones by their sides only.
  const privates: { key: string; cells: Cell[] }[] = [];
  for (const room of layout.rooms) {
    if (!built(room) || room.at.kind !== "ring") continue;
    const def = roomDef(room.type);
    if (def.excavationOnly) continue;
    const cells = def.public ? openTo(room) : room.cells;
    const floors = [...new Set(cells.map((c) => c.floor))].sort((a, b) => a - b);
    for (const floor of floors) {
      const here = cells.filter((c) => c.floor === floor);
      const key = `r:${room.id}:${floor}`;
      add(key, { roomId: room.id, floor, length: roomLength(here.length), through: !!def.public });
      if (def.public) {
        for (const e of outsideEdges(hole, here)) {
          for (const v of edgeVertices(hole, e)) index(byVertex, v, key);
          index(byEdge, e.id, key);
        }
      } else privates.push({ key, cells: here });
    }
    // Up and down inside it: stairs carry air and people, an elevator only people.
    for (let i = 1; i < floors.length; i++) {
      if (floors[i] !== floors[i - 1]! + 1) continue;
      link(`r:${room.id}:${floors[i - 1]}`, `r:${room.id}:${floors[i]}`, !def.lift, FLOOR_M);
    }
  }
  // Dug-out empty space: walk-through, a cell at a time.
  for (const cell of emptyCells(layout)) {
    const key = `e:${cell.floor}:${cell.ring}:${cell.slot}`;
    add(key, { roomId: 0, floor: cell.floor, length: STEP_M, through: true });
    for (const e of cellEdges(hole, cell)) {
      for (const v of edgeVertices(hole, e)) index(byVertex, v, key);
      index(byEdge, e.id, key);
    }
  }
  // Walkable pieces sharing a corner join up.
  for (const list of byVertex.values()) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) link(list[i]!, list[j]!);
  // A private room opens onto whatever walkable piece runs along one of its sides.
  for (const p of privates) for (const e of outsideEdges(hole, p.cells)) for (const other of byEdge.get(e.id) ?? []) link(p.key, other);
  return { nodes, links, byRoom, byEdge };
}

const cache = new WeakMap<Layout, { version: number; paths: Paths }>();

/** The graph for a layout, built again only when the layout has changed. */
export function pathsFor(layout: Layout): Paths {
  const hit = cache.get(layout);
  if (hit && hit.version === layout.version) return hit.paths;
  const paths = buildPaths(layout);
  cache.set(layout, { version: layout.version, paths });
  return paths;
}

/**
 * Metres from a room to every room within reach, on foot or through the air:
 * the shortest route, passing through walkable pieces only (never another
 * private room). The room itself is at 0. Stops past `maxM`.
 */
export function distancesFrom(paths: Paths, roomId: number, mode: PathMode, maxM = Infinity): Map<number, number> {
  const seeds = (paths.byRoom.get(roomId) ?? []).map((k): [string, number] => [k, 0]);
  const out = walkOut(paths, seeds, roomId, mode, maxM);
  if (seeds.length) out.set(roomId, 0);
  return out;
}

/**
 * The same, from a room that isn't built yet: where it would open onto the
 * walkable pieces along its sides (for the placement preview).
 */
export function distancesFromCells(layout: Layout, cells: Cell[], mode: PathMode, maxM = Infinity): Map<number, number> {
  const paths = pathsFor(layout);
  const half = roomLength(cells.length) / 2;
  const seeds: [string, number][] = [];
  for (const e of outsideEdges(layout.hole, cells)) {
    for (const k of paths.byEdge.get(e.id) ?? []) seeds.push([k, half + paths.nodes.get(k)!.length / 2]);
  }
  return walkOut(paths, seeds, -1, mode, maxM);
}

/** Dijkstra from some nodes at given costs, to every room within `maxM`. */
function walkOut(paths: Paths, seeds: [string, number][], roomId: number, mode: PathMode, maxM: number): Map<number, number> {
  const dist = new Map<string, number>();
  const queue: [number, string][] = [];
  for (const [k, d] of seeds) {
    if (d > maxM || d >= (dist.get(k) ?? Infinity)) continue;
    dist.set(k, d);
    queue.push([d, k]);
  }
  const out = new Map<number, number>();
  while (queue.length) {
    // Small graphs: a sorted array does fine as a queue.
    queue.sort((a, b) => a[0] - b[0]);
    const [d, k] = queue.shift()!;
    if (d > (dist.get(k) ?? Infinity)) continue;
    const node = paths.nodes.get(k)!;
    if (node.roomId && node.roomId !== roomId) {
      out.set(node.roomId, Math.min(out.get(node.roomId) ?? Infinity, d));
      // A private room is somewhere to arrive, not a way through.
      if (!node.through) continue;
    }
    for (const l of paths.links.get(k) ?? []) {
      if (mode === "air" && (!l.air || paths.nodes.get(l.to)!.airtight)) continue;
      const nd = d + l.cost;
      if (nd > maxM || nd >= (dist.get(l.to) ?? Infinity)) continue;
      dist.set(l.to, nd);
      queue.push([nd, l.to]);
    }
  }
  return out;
}

/** Steps between two rooms (metres ÷ STEP_M), or null if there's no way. */
export function stepsBetween(layout: Layout, from: number, to: number, mode: PathMode = "walk"): number | null {
  const m = distancesFrom(pathsFor(layout), from, mode).get(to);
  return m === undefined ? null : m / STEP_M;
}
