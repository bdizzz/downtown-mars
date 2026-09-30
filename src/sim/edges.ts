import { ringSize, wrapSlot, type Hole } from "./geometry";
import type { Cell } from "./placement";

// The borders between cells on a floor, where corridors run.
//
// Rings are bounded by circles: circle 0 is the shaft wall (gallery tubes run
// along it, on the shaft side), circle n is the outer edge of ring n. Slots are bounded by
// radial lines. An edge is either a radial line between two slots of one
// ring, or a piece of a circle. Outer rings have more slots, so the circle
// between ring n and ring n+1 is cut at every slot boundary of either ring;
// that way each arc piece has exactly one cell inside and one outside.
//
// Angles are exact fractions of a turn (numerator/denominator, reduced), so
// the same point on a circle always gets the same vertex, and corridors meet
// exactly where they should.

export type Frac = [number, number];

export interface RadialEdge {
  kind: "radial";
  id: string;
  floor: number;
  /** The ring it crosses, from circle ring−1 to circle ring. */
  ring: number;
  /** Slot boundary index: the edge sits between slot i−1 and slot i. */
  index: number;
  /** Angle in turns. */
  turn: number;
}

export interface ArcEdge {
  kind: "arc";
  id: string;
  floor: number;
  /** Which circle: 1 is between ring 1 and ring 2, and so on. */
  circle: number;
  from: Frac;
  to: Frac;
  /** Start and end in turns; end may be 1 for the last piece. */
  a0: number;
  a1: number;
}

export type Edge = RadialEdge | ArcEdge;

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

export function frac(p: number, q: number): Frac {
  const p2 = ((p % q) + q) % q;
  const g = gcd(p2, q) || q;
  return [p2 / g, q / g];
}

const fracKey = ([p, q]: Frac) => `${p}/${q}`;
const turnOf = ([p, q]: Frac) => p / q;

/** A vertex: where edges meet. */
export function vertexKey(floor: number, circle: number, f: Frac): string {
  return `${floor}|${circle}|${fracKey(f)}`;
}

const cuts = new Map<string, Frac[]>();

/** Where circle k is cut, in order around the turn: every slot boundary of the rings on either side. */
export function circleCuts(hole: Hole, circle: number): Frac[] {
  const key = `${hole.ringSlots.join(",")}:${circle}`;
  let list = cuts.get(key);
  if (!list) {
    const seen = new Map<string, Frac>();
    for (const ring of [circle, circle + 1]) {
      if (ring < 1 || ring > hole.ringSlots.length) continue;
      const n = ringSize(hole, ring);
      for (let i = 0; i < n; i++) {
        const f = frac(i, n);
        seen.set(fracKey(f), f);
      }
    }
    list = [...seen.values()].sort((a, b) => turnOf(a) - turnOf(b));
    cuts.set(key, list);
  }
  return list;
}

export function radialEdge(hole: Hole, floor: number, ring: number, index: number): RadialEdge {
  const n = ringSize(hole, ring);
  const i = wrapSlot(index, n);
  return { kind: "radial", id: `R${floor}.${ring}.${i}`, floor, ring, index: i, turn: i / n };
}

/** The arc piece of circle k that starts at cut `i`. */
function arcPiece(hole: Hole, floor: number, circle: number, i: number): ArcEdge {
  const list = circleCuts(hole, circle);
  const from = list[wrapSlot(i, list.length)]!;
  const to = list[wrapSlot(i + 1, list.length)]!;
  const a0 = turnOf(from);
  const a1 = turnOf(to) <= a0 ? turnOf(to) + 1 : turnOf(to);
  return { kind: "arc", id: `A${floor}.${circle}.${fracKey(from)}`, floor, circle, from, to, a0, a1 };
}

/** Look an edge up by its id. */
export function edgeById(hole: Hole, id: string): Edge | null {
  const m = /^([RA])(\d+)\.(\d+)\.(\d+)(?:\/(\d+))?$/.exec(id);
  if (!m) return null;
  const floor = Number(m[2]);
  const k = Number(m[3]);
  if (m[1] === "R") {
    if (k < 1 || k > hole.ringSlots.length) return null;
    return radialEdge(hole, floor, k, Number(m[4]));
  }
  if (k < 0 || k > hole.ringSlots.length || m[5] === undefined) return null;
  const want = fracKey(frac(Number(m[4]), Number(m[5])));
  const i = circleCuts(hole, k).findIndex((f) => fracKey(f) === want);
  return i < 0 ? null : arcPiece(hole, floor, k, i);
}

/** The two ends of an edge, as vertex keys. */
export function edgeVertices(hole: Hole, e: Edge): [string, string] {
  if (e.kind === "radial") {
    const f = frac(e.index, ringSize(hole, e.ring));
    return [vertexKey(e.floor, e.ring - 1, f), vertexKey(e.floor, e.ring, f)];
  }
  return [vertexKey(e.floor, e.circle, e.from), vertexKey(e.floor, e.circle, e.to)];
}

/** The cells on either side of an edge; null where it's outside every ring. */
export function edgeSides(hole: Hole, e: Edge): [Cell | null, Cell | null] {
  if (e.kind === "radial") {
    const n = ringSize(hole, e.ring);
    return [
      { floor: e.floor, ring: e.ring, slot: wrapSlot(e.index - 1, n) },
      { floor: e.floor, ring: e.ring, slot: e.index },
    ];
  }
  const mid = ((e.a0 + e.a1) / 2) % 1;
  const cellIn = (ring: number): Cell | null =>
    ring >= 1 && ring <= hole.ringSlots.length ? { floor: e.floor, ring, slot: Math.floor(mid * ringSize(hole, ring)) } : null;
  return [cellIn(e.circle), cellIn(e.circle + 1)];
}

/** Every edge of a cell. Ring 1's inner side is on the shaft wall (circle 0), where a gallery tube can run. */
export function cellEdges(hole: Hole, c: Cell): Edge[] {
  const n = ringSize(hole, c.ring);
  const out: Edge[] = [radialEdge(hole, c.floor, c.ring, c.slot), radialEdge(hole, c.floor, c.ring, c.slot + 1)];
  const s0 = c.slot / n;
  const s1 = (c.slot + 1) / n;
  for (const circle of [c.ring - 1, c.ring]) {
    if (circle < 0) continue;
    const list = circleCuts(hole, circle);
    list.forEach((f, i) => {
      const t = turnOf(f);
      if (t >= s0 - 1e-12 && t < s1 - 1e-12) out.push(arcPiece(hole, c.floor, circle, i));
    });
  }
  return out;
}

const cellKey = (c: Cell) => `${c.floor}:${c.ring}:${c.slot}`;

/** The edges around a group of cells: those with something else on the other side. */
export function outsideEdges(hole: Hole, cells: Cell[]): Edge[] {
  const own = new Set(cells.map(cellKey));
  const out = new Map<string, Edge>();
  for (const c of cells) {
    for (const e of cellEdges(hole, c)) {
      const [a, b] = edgeSides(hole, e);
      const inside = [a, b].filter((x) => x && own.has(cellKey(x))).length;
      if (inside === 1) out.set(e.id, e);
    }
  }
  return [...out.values()];
}

/** The edges two neighbouring cells share (one radial, or one or more arc pieces). */
export function sharedEdges(hole: Hole, a: Cell, b: Cell): Edge[] {
  if (a.floor !== b.floor) return [];
  const kb = cellKey(b);
  return cellEdges(hole, a).filter((e) => edgeSides(hole, e).some((x) => x && cellKey(x) === kb));
}

/** An edge's length in metres, for costs. */
export function edgeLengthM(hole: Hole, e: Edge, ringDepthM: number): number {
  if (e.kind === "radial") return ringDepthM;
  return (e.a1 - e.a0) * 2 * Math.PI * (hole.shaftRadiusM + e.circle * ringDepthM);
}

/**
 * The edge nearest a point on a floor: the cell it's in, then whichever of
 * that cell's sides is closest. `rings` is the distance out from the shaft
 * wall in rings (0 at the wall, 1 at the outer edge of ring 1), `turn` the
 * angle in turns. Just inside the shaft wall (down to `galleryRings` in), it's ring 1's gallery side.
 */
export function nearestEdge(hole: Hole, floor: number, rings: number, turn: number, ringDepthM: number, galleryRings = 0.3): Edge | null {
  if (rings < 0 && rings >= -galleryRings) return arcAt(hole, floor, 0, turn);
  if (rings < 0 || rings >= hole.ringSlots.length) return null;
  const ring = Math.floor(rings) + 1;
  const v = rings - (ring - 1);
  const n = ringSize(hole, ring);
  const t = ((turn % 1) + 1) % 1;
  const slot = Math.min(n - 1, Math.floor(t * n));
  const u = t * n - slot;
  const radius = hole.shaftRadiusM + (ring - 0.5) * ringDepthM;
  const slotM = (2 * Math.PI * radius) / n;
  const options: [number, () => Edge | null][] = [
    [u * slotM, () => radialEdge(hole, floor, ring, slot)],
    [(1 - u) * slotM, () => radialEdge(hole, floor, ring, slot + 1)],
    [(1 - v) * ringDepthM, () => arcAt(hole, floor, ring, t)],
  ];
  options.push([v * ringDepthM, () => arcAt(hole, floor, ring - 1, t)]);
  options.sort((a, b) => a[0] - b[0]);
  return options[0]![1]();
}

/** The arc piece of a circle at an angle. */
export function arcAt(hole: Hole, floor: number, circle: number, turn: number): ArcEdge | null {
  if (circle < 0 || circle > hole.ringSlots.length) return null;
  const list = circleCuts(hole, circle);
  const t = ((turn % 1) + 1) % 1;
  let i = list.length - 1;
  for (let k = 0; k < list.length; k++) if (turnOf(list[k]!) <= t + 1e-12) i = k;
  return arcPiece(hole, floor, circle, i);
}

/** Is this a gallery edge: on the shaft wall, where a gallery tube runs? */
export function isGalleryEdge(e: Edge): boolean {
  return e.kind === "arc" && e.circle === 0;
}

/** A floor's gallery edges, all the way round the shaft: one per ring-1 slot. */
export function galleryEdges(hole: Hole, floor: number): ArcEdge[] {
  return circleCuts(hole, 0).map((_, i) => arcPiece(hole, floor, 0, i));
}
