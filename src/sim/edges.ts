import { config } from "./config";
import { wrapNotch, type Hole } from "./geometry";
import type { Layout } from "./placement";
import { circleCuts, contains, covers, overlap, pieceAt, piecesOn, type Cell } from "./space";

// The borders on a floor, where corridors run.
//
// Rings are bounded by circles: circle 0 is the shaft wall (gallery tubes run
// along it, on the shaft side), circle n is the outer edge of ring n. Across a
// ring run radial lines, at any angle. An edge is either a radial line across
// one ring, or a piece of a circle.
//
// Angles are whole notches (F-004), so the same point always gets the same
// vertex and corridors meet exactly where they should. Circles are cut at
// every vertex: wherever a piece (a room's end, the rock's grid) starts on
// either side, and wherever a corridor meets or ends (space.ts). So each arc
// piece has exactly one piece inside and one outside. An edge's id is its own
// integers: `R{floor}.{ring}.{angle}` and `A{floor}.{circle}.{from}-{to}`.

const N = config.geometry.notchesPerTurn;

export interface RadialEdge {
  kind: "radial";
  id: string;
  floor: number;
  /** The ring it crosses, from circle ring−1 to circle ring. */
  ring: number;
  /** Its angle, in notches. */
  angle: number;
  /** Angle in turns. */
  turn: number;
}

export interface ArcEdge {
  kind: "arc";
  id: string;
  floor: number;
  /** Which circle: 1 is between ring 1 and ring 2, and so on. */
  circle: number;
  /** Start and end in notches: 0 ≤ from < N, from < to ≤ from + N. */
  from: number;
  to: number;
  /** Start and end in turns; the end may pass 1. */
  a0: number;
  a1: number;
}

export type Edge = RadialEdge | ArcEdge;

/** A vertex: where edges meet. */
export function vertexKey(floor: number, circle: number, notch: number): string {
  return `${floor}|${circle}|${wrapNotch(notch, N)}`;
}

export function radialEdge(floor: number, ring: number, angle: number): RadialEdge {
  const a = wrapNotch(angle, N);
  return { kind: "radial", id: `R${floor}.${ring}.${a}`, floor, ring, angle: a, turn: a / N };
}

export function arcEdge(floor: number, circle: number, from: number, to: number): ArcEdge {
  const f = wrapNotch(from, N);
  const t = f + (to - from);
  return { kind: "arc", id: `A${floor}.${circle}.${f}-${wrapNotch(t - 1, N) + 1}`, floor, circle, from: f, to: t, a0: f / N, a1: t / N };
}

/** Look an edge up by its id (any range of a circle, or a radial line at any angle). */
export function edgeById(hole: Hole, id: string): Edge | null {
  const r = /^R(\d+)\.(\d+)\.(\d+)$/.exec(id);
  if (r) {
    const ring = Number(r[2]);
    if (ring < 1 || ring > hole.ringSlots.length || Number(r[3]) >= N) return null;
    return radialEdge(Number(r[1]), ring, Number(r[3]));
  }
  const a = /^A(\d+)\.(\d+)\.(\d+)-(\d+)$/.exec(id);
  if (!a) return null;
  const circle = Number(a[2]);
  const from = Number(a[3]);
  const to = Number(a[4]);
  if (circle < 0 || circle > hole.ringSlots.length || from >= N || to < 1 || to > N) return null;
  return arcEdge(Number(a[1]), circle, from, to <= from ? to + N : to);
}

/** The two ends of an edge, as vertex keys. */
export function edgeVertices(_hole: Hole, e: Edge): [string, string] {
  if (e.kind === "radial") return [vertexKey(e.floor, e.ring - 1, e.angle), vertexKey(e.floor, e.ring, e.angle)];
  return [vertexKey(e.floor, e.circle, e.from), vertexKey(e.floor, e.circle, e.to)];
}

/** The pieces of a circle between two angles (a1 may pass a turn), cut at every vertex along it. */
export function arcPieces(layout: Layout, floor: number, circle: number, a0: number, a1: number): ArcEdge[] {
  const from = wrapNotch(a0, N);
  const to = from + (a1 - a0);
  const at = [from, to];
  for (const c of circleCuts(layout, floor, circle)) for (const x of [c, c + N]) if (x > from && x < to) at.push(x);
  at.sort((x, y) => x - y);
  const out: ArcEdge[] = [];
  for (let i = 0; i + 1 < at.length; i++) if (at[i + 1]! > at[i]!) out.push(arcEdge(floor, circle, at[i]!, at[i + 1]!));
  return out;
}

/** The pieces on either side of an edge (at its middle); null where it's outside every ring. */
export function edgeSides(layout: Layout, e: Edge): [Cell | null, Cell | null] {
  if (e.kind === "radial") return [pieceAt(layout, e.floor, e.ring, e.angle - 0.5), pieceAt(layout, e.floor, e.ring, e.angle + 0.5)];
  const mid = (e.from + e.to) / 2;
  const rings = layout.hole.ringSlots.length;
  return [e.circle >= 1 ? pieceAt(layout, e.floor, e.circle, mid) : null, e.circle + 1 <= rings ? pieceAt(layout, e.floor, e.circle + 1, mid) : null];
}

/** Every edge of a cell. Ring 1's inner side is on the shaft wall (circle 0), where a gallery tube can run. */
export function cellEdges(layout: Layout, c: Cell): Edge[] {
  const out: Edge[] = [radialEdge(c.floor, c.ring, c.a0)];
  if (c.a1 - c.a0 < N) out.push(radialEdge(c.floor, c.ring, c.a1));
  for (const circle of [c.ring - 1, c.ring]) out.push(...arcPieces(layout, c.floor, circle, c.a0, c.a1));
  return out;
}

/** The edges around a group of cells: those with something else on the other side. */
export function outsideEdges(layout: Layout, cells: Cell[]): Edge[] {
  const out = new Map<string, Edge>();
  for (const c of cells) {
    const whole = c.a1 - c.a0 >= N;
    if (!whole && !covers(cells, c.floor, c.ring, c.a0 - 0.5)) {
      const e = radialEdge(c.floor, c.ring, c.a0);
      out.set(e.id, e);
    }
    if (!whole && !covers(cells, c.floor, c.ring, c.a1 + 0.5)) {
      const e = radialEdge(c.floor, c.ring, c.a1);
      out.set(e.id, e);
    }
    for (const [circle, other] of [
      [c.ring - 1, c.ring - 1],
      [c.ring, c.ring + 1],
    ] as const) {
      for (const e of arcPieces(layout, c.floor, circle, c.a0, c.a1)) {
        if (!covers(cells, c.floor, other, (e.from + e.to) / 2)) out.set(e.id, e);
      }
    }
  }
  return [...out.values()];
}

/** The edges two neighbouring cells share (a radial line, or one or more arc pieces). */
export function sharedEdges(layout: Layout, a: Cell, b: Cell): Edge[] {
  if (a.floor !== b.floor) return [];
  if (a.ring === b.ring) {
    const out = new Map<string, Edge>();
    for (const [x, y] of [
      [a, b],
      [b, a],
    ] as const) {
      if (wrapNotch(x.a1, N) === y.a0) out.set(`R${x.floor}.${x.ring}.${y.a0}`, radialEdge(x.floor, x.ring, y.a0));
    }
    return [...out.values()];
  }
  if (Math.abs(a.ring - b.ring) !== 1) return [];
  const circle = Math.min(a.ring, b.ring);
  return overlap(a, b).flatMap(([lo, hi]) => arcPieces(layout, a.floor, circle, lo, hi));
}

/** An edge's length in metres, for costs. */
export function edgeLengthM(hole: Hole, e: Edge, ringDepthM: number): number {
  if (e.kind === "radial") return ringDepthM;
  return (e.a1 - e.a0) * 2 * Math.PI * (hole.shaftRadiusM + e.circle * ringDepthM);
}

/**
 * The edge nearest a point on a floor: the piece it's in, then whichever of
 * that piece's sides is closest. `rings` is the distance out from the shaft
 * wall in rings (0 at the wall, 1 at the outer edge of ring 1), `turn` the
 * angle in turns. Just inside the shaft wall (down to `galleryRings` in), it's ring 1's gallery side.
 */
export function nearestEdge(layout: Layout, floor: number, rings: number, turn: number, ringDepthM: number, galleryRings = 0.3): Edge | null {
  const hole = layout.hole;
  if (rings < 0 && rings >= -galleryRings) return arcAt(layout, floor, 0, turn);
  if (rings < 0 || rings >= hole.ringSlots.length) return null;
  const ring = Math.floor(rings) + 1;
  const v = rings - (ring - 1);
  const t = ((turn % 1) + 1) % 1;
  const piece = pieceAt(layout, floor, ring, t * N);
  if (!piece) return null;
  const mPerNotch = (2 * Math.PI * (hole.shaftRadiusM + (ring - 0.5) * ringDepthM)) / N;
  const u = (((t * N - piece.a0) % N) + N) % N;
  const options: [number, () => Edge | null][] = [
    [u * mPerNotch, () => radialEdge(floor, ring, piece.a0)],
    [(piece.a1 - piece.a0 - u) * mPerNotch, () => radialEdge(floor, ring, piece.a1)],
    [(1 - v) * ringDepthM, () => arcAt(layout, floor, ring, t)],
    [v * ringDepthM, () => arcAt(layout, floor, ring - 1, t)],
  ];
  options.sort((a, b) => a[0] - b[0]);
  return options[0]![1]();
}

/** The arc piece of a circle at an angle. */
export function arcAt(layout: Layout, floor: number, circle: number, turn: number): ArcEdge | null {
  if (circle < 0 || circle > layout.hole.ringSlots.length) return null;
  const cuts = circleCuts(layout, floor, circle);
  const x = (((turn % 1) + 1) % 1) * N;
  let i = cuts.length - 1;
  for (let k = 0; k < cuts.length; k++) if (cuts[k]! <= x + 1e-9) i = k;
  const from = cuts[i]!;
  const next = cuts[(i + 1) % cuts.length]!;
  return arcEdge(floor, circle, from, next > from ? next : next + N);
}

/** Is this a gallery edge: on the shaft wall, where a gallery tube runs? */
export function isGalleryEdge(e: Edge): boolean {
  return e.kind === "arc" && e.circle === 0;
}

/** A floor's gallery edges, all the way round the shaft. */
export function galleryEdges(layout: Layout, floor: number): ArcEdge[] {
  return arcPieces(layout, floor, 0, 0, N);
}

/** Every edge of a floor: each piece's sides, once each. */
export function floorEdges(layout: Layout, floor: number): Edge[] {
  const out = new Map<string, Edge>();
  for (let ring = 1; ring <= layout.hole.ringSlots.length; ring++) {
    for (const p of piecesOn(layout, floor, ring)) for (const e of cellEdges(layout, p)) out.set(e.id, e);
  }
  return [...out.values()];
}

/** Does this arc lie along a cell's side of a circle? */
export function arcAlong(e: ArcEdge, c: Cell): boolean {
  return (e.circle === c.ring || e.circle === c.ring - 1) && contains(c, (e.from + e.to) / 2);
}
