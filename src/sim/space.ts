import { config } from "./config";
import { slotNotch, spanArea, wrapNotch, type Hole } from "./geometry";
import type { Layout } from "./placement";

// Space by angle (F-004, PLAN-M17). Angles are whole notches, `notchesPerTurn`
// a turn. On each floor and ring, a room holds an angle range, and what's dug
// is kept as merged ranges (`layout.open`). Everything else walks over
// **pieces**: on each floor and ring the turn is cut wherever something starts
// or ends: a room's part of the ring, a stretch of empty space (dug, no room),
// or rock. Rock and empty space are cut further on the ring's grid
// (`hole.ringSlots`, about 10 m), so effects and air still spread through them
// in small steps.

const N = config.geometry.notchesPerTurn;

/** An angle range on one floor and ring, in notches: 0 ≤ a0 < N, a0 < a1 ≤ a0 + N (it may run past a turn). */
export interface Cell {
  floor: number;
  ring: number;
  a0: number;
  a1: number;
}

/** A piece of a ring as things stand: a room's part of it (its id), empty space, or rock. */
export interface Piece extends Cell {
  room: number;
  open: boolean;
}

/** A merged range of notches, 0 ≤ from < to ≤ N. */
export type Span = [number, number];

export const cellKey = (c: Cell) => `${c.floor}:${c.ring}:${c.a0}`;

/** A cell from any start and span (the start wrapped into a turn). */
export function cell(floor: number, ring: number, start: number, span: number): Cell {
  const a0 = wrapNotch(start, N);
  return { floor, ring, a0, a1: a0 + span };
}

/** A range that may run past a turn, as one or two that don't. */
export function unwrap(a0: number, a1: number): Span[] {
  const s = wrapNotch(a0, N);
  const e = s + (a1 - a0);
  if (e <= N) return [[s, e]];
  return [
    [s, N],
    [0, e - N],
  ];
}

/** Does the range a (may wrap) contain the point x (any real angle)? Ends: start in, end out. */
export function contains(c: { a0: number; a1: number }, x: number): boolean {
  const d = (((x - c.a0) % N) + N) % N;
  return d < c.a1 - c.a0;
}

/** Where two ranges (either may wrap) overlap: none, one or two ranges, as [a0, a1] with a0 in the turn. */
export function overlap(a: { a0: number; a1: number }, b: { a0: number; a1: number }): Span[] {
  const out: Span[] = [];
  for (const [p0, p1] of unwrap(a.a0, a.a1)) {
    for (const [q0, q1] of unwrap(b.a0, b.a1)) {
      const lo = Math.max(p0, q0);
      const hi = Math.min(p1, q1);
      if (hi > lo) out.push([lo, hi]);
    }
  }
  out.sort((x, y) => x[0] - y[0]);
  // Two parts that meet at the turn are one range through it.
  if (out.length === 2 && out[0]![0] === 0 && out[1]![1] === N && out[0]![1] !== out[1]![0]) return [[out[1]![0], N + out[0]![1]]];
  return out;
}

/** How many notches two ranges share. */
export function overlapNotches(a: { a0: number; a1: number }, b: { a0: number; a1: number }): number {
  return overlap(a, b).reduce((s, [lo, hi]) => s + hi - lo, 0);
}

/** A cell's floor area, m². */
export function cellArea(hole: Hole, c: Cell): number {
  return spanArea(hole.shaftRadiusM, c.ring, 1, c.a1 - c.a0, config.geometry);
}

/** A cell's length along the middle of its ring, metres. */
export function cellWidthM(hole: Hole, c: Cell): number {
  return ((c.a1 - c.a0) / N) * 2 * Math.PI * (hole.shaftRadiusM + (c.ring - 0.5) * config.geometry.roomDepthM);
}

// ---- what's dug ----

function spansOf(layout: Layout, floor: number, ring: number): Span[] | undefined {
  return layout.open?.[floor - 1]?.[ring - 1];
}

function covered(spans: Span[] | undefined, a0: number, a1: number): boolean {
  return !!spans && spans.some(([s, e]) => s <= a0 && e >= a1);
}

/** Is this whole range excavated (empty space or a room)? */
export function isOpen(layout: Layout, c: Cell): boolean {
  const spans = spansOf(layout, c.floor, c.ring);
  return unwrap(c.a0, c.a1).every(([a0, a1]) => covered(spans, a0, a1));
}

function addSpan(spans: Span[], a0: number, a1: number): Span[] {
  const out: Span[] = [];
  let lo = a0;
  let hi = a1;
  for (const [s, e] of spans) {
    if (e < lo || s > hi) out.push([s, e]);
    else {
      lo = Math.min(lo, s);
      hi = Math.max(hi, e);
    }
  }
  out.push([lo, hi]);
  return out.sort((x, y) => x[0] - y[0]);
}

/** Mark ranges excavated. */
export function openCells(layout: Layout, cells: Cell[]): void {
  if (!cells.length) return;
  for (const c of cells) {
    const rings = layout.open?.[c.floor - 1];
    if (!rings || c.ring < 1 || c.ring > rings.length) continue;
    for (const [a0, a1] of unwrap(c.a0, c.a1)) rings[c.ring - 1] = addSpan(rings[c.ring - 1]!, a0, a1);
  }
  layout.version++;
}

/** The parts of these ranges still solid rock. */
export function rockCells(layout: Layout, cells: Cell[]): Cell[] {
  const out: Cell[] = [];
  for (const c of cells) {
    const spans = spansOf(layout, c.floor, c.ring) ?? [];
    for (const [a0, a1] of unwrap(c.a0, c.a1)) {
      let at = a0;
      for (const [s, e] of spans) {
        if (e <= at || s >= a1) continue;
        if (s > at) out.push({ floor: c.floor, ring: c.ring, a0: at, a1: s });
        at = Math.max(at, e);
      }
      if (at < a1) out.push({ floor: c.floor, ring: c.ring, a0: at, a1 });
    }
  }
  return out;
}

/** The floor area of these ranges, m². */
export function areaOf(hole: Hole, cells: Cell[]): number {
  return cells.reduce((s, c) => s + cellArea(hole, c), 0);
}

/** How much is dug on dug floors, m². */
export function openArea(layout: Layout): number {
  let area = 0;
  const floors = Math.min(layout.hole.floors, layout.open?.length ?? 0);
  for (let f = 0; f < floors; f++) {
    layout.open![f]!.forEach((spans, r) => {
      for (const [a0, a1] of spans) area += spanArea(layout.hole.shaftRadiusM, r + 1, 1, a1 - a0, config.geometry);
    });
  }
  return area;
}

/** Is a whole ring of a floor dug out? */
export function ringOpen(layout: Layout, floor: number, ring: number): boolean {
  return covered(spansOf(layout, floor, ring), 0, N);
}

// ---- pieces ----

interface Space {
  version: number;
  rooms: number;
  /** pieces[floor - 1][ring - 1], sorted by a0. */
  pieces: Piece[][][];
  /** Where each circle is cut, by `${floor}|${circle}`: sorted notches in the turn. Redone when corridors come or go. */
  cuts: Map<string, number[]>;
  /** How many corridors there were when the cuts were worked out. */
  corridors: number;
}

const cache = new WeakMap<Layout, Space>();

/** The ring's grid: where rock and empty space are cut, in notches. */
export function gridNotches(hole: Hole, ring: number): number[] {
  const n = hole.ringSlots[ring - 1] ?? 1;
  return Array.from({ length: n }, (_, k) => slotNotch(k, n, N));
}

function buildPieces(layout: Layout): Piece[][][] {
  const hole = layout.hole;
  const rings = hole.ringSlots.length;
  let floors = Math.max(hole.floors + 1, layout.open?.length ?? 0);
  const occ = new Map<string, Piece[]>();
  for (const room of layout.rooms) {
    for (const c of room.pendingCells ? [...room.cells, ...room.pendingCells] : room.cells) {
      floors = Math.max(floors, c.floor);
      const k = `${c.floor}:${c.ring}`;
      let list = occ.get(k);
      if (!list) occ.set(k, (list = []));
      list.push({ floor: c.floor, ring: c.ring, a0: c.a0, a1: c.a1, room: room.id, open: isOpen(layout, c) });
    }
  }
  const out: Piece[][][] = [];
  for (let floor = 1; floor <= floors; floor++) {
    const row: Piece[][] = [];
    for (let ring = 1; ring <= rings; ring++) {
      const taken = (occ.get(`${floor}:${ring}`) ?? []).sort((a, b) => a.a0 - b.a0);
      const list: Piece[] = [...taken];
      const spans = spansOf(layout, floor, ring) ?? [];
      // The grid's marks, but none that would leave a sliver against a room (under 3 m): the piece beside it takes it up.
      const least = (3 / (2 * Math.PI * (hole.shaftRadiusM + (ring - 0.5) * config.geometry.roomDepthM))) * N;
      const grid = gridNotches(hole, ring);
      const dug = spans.flat();
      // The gaps between rooms, as ranges that don't wrap.
      const gaps: Span[] = [];
      if (!taken.length) gaps.push([0, N]);
      taken.forEach((p, i) => {
        const next = taken[(i + 1) % taken.length]!;
        const from = p.a1;
        const to = i + 1 < taken.length ? next.a0 : next.a0 + N;
        if (to > from) gaps.push(...unwrap(from, to));
      });
      for (const [g0, g1] of gaps) {
        const marks = [...grid.filter((m) => m - g0 >= least && g1 - m >= least), ...dug.filter((m) => m > g0 && m < g1)];
        const at = [g0, ...[...new Set(marks)].sort((a, b) => a - b), g1];
        for (let i = 0; i + 1 < at.length; i++) {
          if (at[i] === at[i + 1]) continue;
          list.push({ floor, ring, a0: at[i]!, a1: at[i + 1]!, room: 0, open: covered(spans, at[i]!, at[i + 1]!) });
        }
      }
      row.push(list.sort((a, b) => a.a0 - b.a0));
    }
    out.push(row);
  }
  return out;
}

const ARC = /^A(\d+)\.(\d+)\.(\d+)-(\d+)$/;
const RADIAL = /^R(\d+)\.(\d+)\.(\d+)$/;

/** The parts of a stored arc id between the cuts that fall inside it, or null if none does. */
function splitArc(id: string, cuts: Map<string, number[]>): string[] | null {
  const m = ARC.exec(id);
  if (!m) return null;
  const from = Number(m[3]);
  const to = Number(m[4]) <= from ? Number(m[4]) + N : Number(m[4]);
  const inside = (cuts.get(`${m[1]}|${m[2]}`) ?? []).flatMap((c) => [c, c + N]).filter((c) => c > from && c < to).sort((a, b) => a - b);
  if (!inside.length) return null;
  const at = [from, ...inside, to];
  const parts: string[] = [];
  for (let i = 0; i + 1 < at.length; i++) parts.push(`A${m[1]}.${m[2]}.${wrapNotch(at[i]!, N)}-${wrapNotch(at[i + 1]! - 1, N) + 1}`);
  return parts;
}

function buildCuts(layout: Layout, pieces: Piece[][][]): Map<string, number[]> {
  const sets = new Map<string, Set<number>>();
  const add = (floor: number | string, circle: number | string, notch: number) => {
    const k = `${floor}|${circle}`;
    let s = sets.get(k);
    if (!s) sets.set(k, (s = new Set()));
    s.add(wrapNotch(notch, N));
  };
  pieces.forEach((rings, f) =>
    rings.forEach((list, r) => {
      for (const p of list) {
        for (const circle of [r, r + 1]) {
          add(f + 1, circle, p.a0);
          add(f + 1, circle, p.a1);
        }
      }
    }),
  );
  // Whatever is kept by border (corridors, bulkheads, windows) cuts its circle at its ends, so it stays a whole piece.
  const stored = [...Object.keys(layout.corridors ?? {}), ...Object.keys(layout.bulkheads ?? {}), ...layout.rooms.flatMap((r) => r.windows ?? [])];
  for (const id of stored) {
    const a = ARC.exec(id);
    if (a) {
      add(a[1]!, a[2]!, Number(a[3]));
      add(a[1]!, a[2]!, Number(a[4]));
      continue;
    }
    const r = RADIAL.exec(id);
    if (r) {
      add(r[1]!, Number(r[2]) - 1, Number(r[3]));
      add(r[1]!, r[2]!, Number(r[3]));
    }
  }
  const out = new Map<string, number[]>();
  for (const [k, s] of sets) out.set(k, [...s].sort((a, b) => a - b));
  return out;
}

/**
 * Keep everything stored by border a whole piece: a corridor (or window) whose
 * border has since been cut (a room's end now meets it, a corridor now crosses it)
 * becomes its parts, each with the same finish and work under way. A bulkhead
 * stays on the part its middle was on. What split is noted in
 * `layout.corridorSplits` so construction jobs can follow (construction.ts).
 */
function resplit(layout: Layout, cuts: Map<string, number[]>): void {
  const maps = [layout.corridors, layout.corridorLinked, layout.corridorsBuilding, layout.corridorsFilling, layout.corridorsRelining] as (Record<string, unknown> | undefined)[];
  for (const id of Object.keys(layout.corridors ?? {})) {
    const parts = splitArc(id, cuts);
    if (!parts) continue;
    for (const map of maps) {
      if (!map || !(id in map)) continue;
      for (const p of parts) map[p] = map[id];
      delete map[id];
    }
    (layout.corridorSplits ??= {})[id] = parts;
  }
  for (const id of Object.keys(layout.bulkheads ?? {})) {
    const parts = splitArc(id, cuts);
    if (!parts) continue;
    const m = ARC.exec(id)!;
    const from = Number(m[3]);
    const mid = (from + (Number(m[4]) <= from ? Number(m[4]) + N : Number(m[4]))) / 2;
    const keep = parts.find((p) => {
      const q = ARC.exec(p)!;
      const f = Number(q[3]);
      return contains({ a0: f, a1: Number(q[4]) <= f ? Number(q[4]) + N : Number(q[4]) }, mid);
    });
    delete layout.bulkheads![id];
    if (keep) layout.bulkheads![keep] = true;
  }
  for (const room of layout.rooms) {
    if (!room.windows?.length) continue;
    if (room.windows.some((id) => splitArc(id, cuts))) room.windows = room.windows.flatMap((id) => splitArc(id, cuts) ?? [id]);
  }
}

/** The pieces and cuts of a layout as it stands (rebuilt when its version moves on). */
export function spaceOf(layout: Layout): Space {
  let s = cache.get(layout);
  if (s && s.version === layout.version && s.rooms === layout.rooms.length) return s;
  const pieces = buildPieces(layout);
  s = { version: layout.version, rooms: layout.rooms.length, pieces, cuts: new Map(), corridors: -1 };
  cache.set(layout, s);
  return s;
}

/** Forget what's cached for a layout changed by hand (tests, migrations). */
export function touch(layout: Layout): void {
  cache.delete(layout);
}

/** The pieces of one floor and ring, in order round the turn. */
export function piecesOn(layout: Layout, floor: number, ring: number): Piece[] {
  return spaceOf(layout).pieces[floor - 1]?.[ring - 1] ?? [];
}

/** Every piece of a floor. */
export function floorPieces(layout: Layout, floor: number): Piece[] {
  return (spaceOf(layout).pieces[floor - 1] ?? []).flat();
}

/** The piece at an angle (any real number of notches). */
export function pieceAt(layout: Layout, floor: number, ring: number, notch: number): Piece | null {
  const list = piecesOn(layout, floor, ring);
  const x = ((notch % N) + N) % N;
  for (const p of list) if (contains(p, x)) return p;
  return null;
}

/** The id of the room at the start of a cell, or 0. */
export function roomIdAt(layout: Layout, c: Cell): number {
  return pieceAt(layout, c.floor, c.ring, c.a0 + 0.5)?.room ?? 0;
}

/** The pieces a range overlaps. */
export function piecesIn(layout: Layout, c: Cell): Piece[] {
  return piecesOn(layout, c.floor, c.ring).filter((p) => overlapNotches(p, c) > 0);
}

/** Where circle `circle` of a floor is cut: sorted notches in the turn. */
export function circleCuts(layout: Layout, floor: number, circle: number): number[] {
  const s = spaceOf(layout);
  // Corridors cut the circles they meet: the cuts are redone whenever one has come or gone (even set by hand).
  let n = 0;
  for (const _ in layout.corridors) n++;
  if (s.corridors !== n) {
    s.cuts = buildCuts(layout, s.pieces);
    resplit(layout, s.cuts);
    n = 0;
    for (const _ in layout.corridors) n++;
    s.corridors = n;
  }
  return s.cuts.get(`${floor}|${circle}`) ?? [0];
}

/** Excavated pieces with no room in them, on dug floors. */
export function emptyCells(layout: Layout): Piece[] {
  const out: Piece[] = [];
  const pieces = spaceOf(layout).pieces;
  for (let f = 0; f < Math.min(layout.hole.floors, pieces.length); f++) for (const list of pieces[f]!) for (const p of list) if (p.open && !p.room) out.push(p);
  return out;
}

/** Do these cells cover this point? */
export function covers(cells: Cell[], floor: number, ring: number, notch: number): boolean {
  return cells.some((c) => c.floor === floor && c.ring === ring && contains(c, notch));
}
