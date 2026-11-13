import { config } from "../sim/config";
import { corridorRefusal } from "../sim/corridors";
import { cellEdges, edgeById, edgeVertices, type Edge } from "../sim/edges";
import { ringSize, type Hole } from "../sim/geometry";
import type { Layout } from "../sim/placement";

// Snaking a corridor: while the player drags with the corridor tool, the
// borders under the pointer join into one continuous chain of proposed
// corridors: no branches, no gaps. Moving back over the chain trims it back
// to that point, so a path can be drawn out, taken back and redrawn in one
// gesture. If the pointer skips ahead faster than the borders it crosses,
// the shortest way from the chain's end is filled in.
//
// Two things keep it steady (T-104). A border joins only once the pointer is
// a quarter of the way along it from the chain's end (config.corridorTool),
// so jitter while passing through a crossing commits nothing. And a wobble
// back over a turn trims the chain to the turn, but from there it may only
// regrow the way it went before, never off in a third direction.

export interface Chain {
  /** Edge ids, in order along the path. */
  edges: string[];
  /** The vertex the chain grows from (null while it's a single edge: it may grow from either end). */
  tail: string | null;
  /** Trimmed back to a vertex where it turned: from there it may only regrow along the border it left by. */
  lock?: { vertex: string; edge: string };
}

/** Where the pointer is on its floor, as nearestEdge takes it: rings out from the shaft wall, and the angle in turns. */
export interface ChainPoint {
  rings: number;
  turn: number;
}

/** How far along an edge a point is: 0 at its first vertex (edgeVertices), 1 at its second. */
export function alongEdge(e: Edge, p: ChainPoint): number {
  const clamp = (u: number) => Math.min(1, Math.max(0, u));
  if (e.kind === "radial") return clamp(p.rings - (e.ring - 1));
  const d = ((((p.turn - e.a0) % 1) + 1.5) % 1) - 0.5; // the nearest way round, so just before a0 is just below 0
  return clamp(d / (e.a1 - e.a0));
}

export const EMPTY_CHAIN: Chain = { edges: [], tail: null };

/** How far (in borders) the chain will bridge to catch up with a fast pointer. */
const MAX_BRIDGE = 6;

/** Can this border be part of the chain? New corridors where they may go; existing ones ride along free. Erasing: existing only. */
export function usable(layout: Layout, id: string, erase: boolean): boolean {
  if (layout.corridors[id]) return true;
  return !erase && corridorRefusal(layout, id) === null;
}

function otherEnd(hole: Hole, e: Edge, v: string): string {
  const [a, b] = edgeVertices(hole, e);
  return a === v ? b : a;
}

/** Every edge on a floor, by the vertices at its ends (built once per layout version and floor). */
const graphs = new Map<string, Map<string, Edge[]>>();
function floorGraph(layout: Layout, floor: number): Map<string, Edge[]> {
  const key = `${layout.hole.ringSlots.join(",")}:${floor}`;
  let adj = graphs.get(key);
  if (adj) return adj;
  adj = new Map();
  const seen = new Set<string>();
  const hole = layout.hole;
  for (let ring = 1; ring <= hole.ringSlots.length; ring++) {
    for (let slot = 0; slot < ringSize(hole, ring); slot++) {
      for (const e of cellEdges(hole, { floor, ring, slot })) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        for (const v of edgeVertices(hole, e)) {
          if (!adj.has(v)) adj.set(v, []);
          adj.get(v)!.push(e);
        }
      }
    }
  }
  graphs.set(key, adj);
  return adj;
}

/** The chain's vertices, so a bridge never loops back through it. */
function chainVertices(hole: Hole, chain: Chain): Set<string> {
  const out = new Set<string>();
  for (const id of chain.edges) {
    const e = edgeById(hole, id);
    if (e) for (const v of edgeVertices(hole, e)) out.add(v);
  }
  return out;
}

/** Shortest run of usable borders from `from` that ends with `target`, avoiding the chain; null if too far. */
function bridge(layout: Layout, from: string, target: Edge, avoid: Set<string>, used: Set<string>, erase: boolean, firstEdge?: string): Edge[] | null {
  const hole = layout.hole;
  const adj = floorGraph(layout, target.floor);
  const prev = new Map<string, { v: string; e: Edge }>();
  let frontier = [from];
  const seen = new Set([from]);
  for (let depth = 0; depth < MAX_BRIDGE && frontier.length; depth++) {
    const next: string[] = [];
    for (const v of frontier) {
      for (const e of adj.get(v) ?? []) {
        if (used.has(e.id) || !usable(layout, e.id, erase)) continue;
        if (depth === 0 && firstEdge && e.id !== firstEdge) continue; // locked at a turn: only the way it went before
        const w = otherEnd(hole, e, v);
        if (e.id === target.id) {
          if (avoid.has(w) || w === from) continue; // would close a loop back onto the chain (or round to where it set off)
          // Reached: walk back to `from`.
          const path = [e];
          let at = v;
          while (at !== from) {
            const p = prev.get(at)!;
            path.unshift(p.e);
            at = p.v;
          }
          return path;
        }
        if (seen.has(w) || avoid.has(w)) continue;
        seen.add(w);
        prev.set(w, { v, e });
        next.push(w);
      }
    }
    frontier = next;
  }
  return null;
}

/**
 * The chain after the pointer moves over `edge` (at `point`, when the caller
 * knows it). Over the chain itself: trim back to it. Next to the chain's end
 * (or a short bridge away), and far enough along: grow to it. Anything else
 * leaves the chain as it is.
 */
export function extendChain(layout: Layout, chain: Chain, edge: Edge | null, erase: boolean, point?: ChainPoint | null): Chain {
  if (!edge) return chain;
  const hole = layout.hole;
  if (!chain.edges.length) return usable(layout, edge.id, erase) ? { edges: [edge.id], tail: null } : chain;

  // Retracing: back to where the pointer is.
  const at = chain.edges.indexOf(edge.id);
  if (at >= 0) {
    if (at === chain.edges.length - 1) return chain;
    const edges = chain.edges.slice(0, at + 1);
    // Back at a turn: lock it to the way it went, so a wobble can't send it off another way.
    const left = edgeById(hole, chain.edges[at + 1]!)!;
    const lock = left.kind !== edge.kind ? { vertex: sharedVertex(hole, edge, left), edge: left.id } : undefined;
    return { edges, tail: tailOf(hole, edges), ...(lock ? { lock } : {}) };
  }

  const first = edgeById(hole, chain.edges[0]!)!;
  if (first.floor !== edge.floor || !usable(layout, edge.id, erase)) return chain;
  const used = new Set(chain.edges);
  const avoid = chainVertices(hole, chain);
  // A single edge can grow from either end; try both and keep the shorter bridge.
  const starts = chain.tail ? [chain.tail] : edgeVertices(hole, first);
  let best: Edge[] | null = null;
  let bestFrom = "";
  for (const v of starts) {
    const others = new Set([...avoid].filter((x) => x !== v));
    const path = bridge(layout, v, edge, others, used, erase, chain.lock?.vertex === v ? chain.lock.edge : undefined);
    if (path && (!best || path.length < best.length)) [best, bestFrom] = [path, v];
  }
  if (!best) return chain;
  // Not far enough along the border yet: wait, rather than commit to it on a passing wobble.
  if (point) {
    const entry = best.length > 1 ? sharedVertex(hole, best[best.length - 2]!, edge) : bestFrom;
    const u = alongEdge(edge, point);
    if ((entry === edgeVertices(hole, edge)[0] ? u : 1 - u) < config.corridorTool.commitAlong) return chain;
  }
  const edges = [...chain.edges, ...best.map((e) => e.id)];
  return { edges, tail: tailOf(hole, edges) };
}

/** The vertex two touching edges share. */
function sharedVertex(hole: Hole, a: Edge, b: Edge): string {
  const [p, q] = edgeVertices(hole, a);
  return edgeVertices(hole, b).includes(p) ? p : q;
}

/** The free end of a chain of two or more edges. */
function tailOf(hole: Hole, edges: string[]): string | null {
  if (edges.length < 2) return null;
  const last = edgeById(hole, edges[edges.length - 1]!)!;
  const before = edgeById(hole, edges[edges.length - 2]!)!;
  const shared = edgeVertices(hole, before);
  const [a, b] = edgeVertices(hole, last);
  return shared.includes(a) ? b : a;
}
