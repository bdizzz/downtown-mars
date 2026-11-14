import { config, type SimConfig } from "./config";
import { spanArea, wrapNotch } from "./geometry";
import { depthsFor, spanRange, type Layout, type Location } from "./placement";
import { isRoomType, roomDef } from "./rooms";
import { piecesOn, type Piece } from "./space";

// Placing by area (F-004, PLAN-M17). A proposed room sits at the pointer's
// angle with its target area for that ring. With snapping on, its ends snap,
// within its leeway, to (in order): both ends at once to exactly fill a gap
// between two neighbours; one end against a neighbour on its ring (no sliver
// left); one end in line with a room end or a radial corridor on the ring
// inside or outside, so corridors can run straight across rings; and last a
// shared grid of angles (`placement.gridNotches`), so rooms placed on
// different rings at different times still tend to share ends. Stairs and
// elevators always snap onto a stack above or below.
//
// Everything here works in notches "near the pointer": angles unwrapped so
// that the pointer's own is the reference, and ranges can run past a turn.

const N = config.geometry.notchesPerTurn;

export type SnapKind = "gap" | "neighbour" | "line" | "grid" | "stack";

export interface Placed {
  start: number;
  span: number;
  /** What it snapped to, and the angles (notches) to mark with a tick. */
  snap?: SnapKind;
  ticks: number[];
}

/** The representation of angle `a` nearest to `ref` (unwrapped). */
function near(a: number, ref: number): number {
  return a + Math.round((ref - a) / N) * N;
}

/** How many notches `metres` along the middle of a ring is. */
export function notchesFor(layout: Layout, ring: number, depth: number, metres: number, cfg: SimConfig = config): number {
  const r = layout.hole.shaftRadiusM + (ring - 1 + depth / 2) * cfg.geometry.roomDepthM;
  return (metres / (2 * Math.PI * r)) * N;
}

interface Gap {
  /** The free range round the pointer, unwrapped: from `from` to `to`. Infinite ends where nothing bounds it. */
  from: number;
  to: number;
}

/** The room-free range round an angle, across the rings a room would cover. Null if a room is there. */
export function freeGap(layout: Layout, floor: number, ring: number, depth: number, notch: number): Gap | null {
  let from = -Infinity;
  let to = Infinity;
  for (let r = ring; r < ring + depth; r++) {
    for (const p of piecesOn(layout, floor, r)) {
      if (!p.room) continue;
      // The piece's range, placed nearest the pointer.
      const a0 = near(p.a0, notch);
      const spans: [number, number][] = [
        [a0, a0 + (p.a1 - p.a0)],
        [a0 - N, a0 - N + (p.a1 - p.a0)],
        [a0 + N, a0 + N + (p.a1 - p.a0)],
      ];
      for (const [s, e] of spans) {
        if (s <= notch && e > notch) return null;
        if (e <= notch) from = Math.max(from, e);
        if (s > notch) to = Math.min(to, s);
      }
    }
  }
  // A ring with one room: the gap runs from its end round to its start.
  if (to - from > N) return { from: -Infinity, to: Infinity };
  return { from, to };
}

/** Angles worth lining up with: room ends on the ring inside and outside, radial corridors nearby, and the edges of what's dug. */
function lines(layout: Layout, floor: number, ring: number, depth: number): number[] {
  const out = new Set<number>();
  const rings = layout.hole.ringSlots.length;
  for (const r of [ring - 1, ring + depth]) {
    if (r < 1 || r > rings) continue;
    for (const p of piecesOn(layout, floor, r)) {
      if (!p.room) continue;
      out.add(wrapNotch(p.a0, N));
      out.add(wrapNotch(p.a1, N));
    }
  }
  for (const id of Object.keys(layout.corridors ?? {})) {
    const m = /^R(\d+)\.(\d+)\.(\d+)$/.exec(id);
    if (m && Number(m[1]) === floor && Number(m[2]) >= ring - 1 && Number(m[2]) <= ring + depth) out.add(Number(m[3]));
  }
  for (let r = ring; r < ring + depth; r++) {
    for (const [a0, a1] of layout.open?.[floor - 1]?.[r - 1] ?? []) {
      if (a1 - a0 >= N) continue;
      out.add(wrapNotch(a0, N));
      out.add(wrapNotch(a1, N));
    }
  }
  return [...out];
}

/** The candidate nearest `x` within `tol`, or null. */
function nearest(cands: number[], x: number, tol: number): number | null {
  let best: number | null = null;
  for (const c of cands) {
    const v = near(c, x);
    if (Math.abs(v - x) <= tol && (best === null || Math.abs(v - x) < Math.abs(best - x))) best = v;
  }
  return best;
}

/** A stack of the same kind just above or below (or on this floor) at this angle, to join. */
function stackAt(layout: Layout, type: string, floor: number, ring: number, notch: number): Extract<Location, { kind: "ring" }> | null {
  const height = roomDef(type).floors ?? 1;
  for (const room of layout.rooms) {
    if (room.type !== type || room.at.kind !== "ring" || room.at.ring !== ring) continue;
    const d = (((notch - room.at.start) % N) + N) % N;
    if (d >= room.at.span) continue;
    const floors = [...room.cells, ...(room.pendingCells ?? [])].map((c) => c.floor);
    const top = Math.min(...floors);
    const low = Math.max(...floors);
    if (floor + height - 1 >= top - 1 && floor <= low + 1) return room.at;
  }
  return null;
}

/**
 * Where a room of this type goes for a pointer at `notch` on a floor and ring: its start and span, in
 * notches, with what it snapped to. With `snap` off it sits at the pointer at exactly its target area.
 */
export function placeAt(layout: Layout, type: string, floor: number, ring: number, depth: number, notch: number, snap = true, cfg: SimConfig = config): Placed {
  const range = spanRange(layout.hole, type, ring, depth, cfg);
  const done = (start: number, span: number, kind?: SnapKind, ticks: number[] = []): Placed => ({
    start: wrapNotch(Math.round(start), N),
    span: Math.round(span),
    ...(kind ? { snap: kind } : {}),
    ticks: ticks.map((t) => wrapNotch(Math.round(t), N)),
  });
  if (isRoomType(type) && roomDef(type).stacks) {
    const stack = stackAt(layout, type, floor, ring, notch);
    if (stack) return done(stack.start, stack.span, "stack", [stack.start, stack.start + stack.span]);
  }
  const base = notch - range.target / 2;
  if (!snap) return done(base, range.target);
  const gap = freeGap(layout, floor, ring, depth, notch);
  if (!gap) return done(base, range.target);
  const width = gap.to - gap.from;
  // Both ends at once: the gap is a size this room can be.
  if (width >= range.min && width <= range.max) return done(gap.from, width, "gap", [gap.from, gap.to]);
  if (width < range.min) return done(base, range.target);
  const tol = notchesFor(layout, ring, depth, cfg.placement.snapM, cfg);
  const cands = lines(layout, floor, ring, depth);
  // The other end, once one is fixed: against the far neighbour or a line if its leeway reaches, else its target.
  const stretch = (fixed: number, dir: 1 | -1): { span: number; tick?: number } => {
    const want = fixed + dir * range.target;
    const far = dir === 1 ? gap.to : gap.from;
    const options = [far, ...cands.map((c) => near(c, want))].filter((x) => Number.isFinite(x) && (x - fixed) * dir >= range.min && (x - fixed) * dir <= range.max);
    // Never past the far neighbour.
    const ok = options.filter((x) => (dir === 1 ? x <= gap.to : x >= gap.from));
    if (!ok.length) return { span: Math.min(range.target, Math.abs(far - fixed)) };
    const best = ok.sort((a, b) => Math.abs(a - want) - Math.abs(b - want))[0]!;
    // Only take it if it's near enough to be meant (or it closes a sliver against the neighbour).
    if (Math.abs(best - want) > tol && !(best === far && Math.abs(far - want) < range.min)) return { span: range.target };
    return { span: (best - fixed) * dir, tick: best };
  };
  // One end against a neighbour: when it's near, or when the room would otherwise poke into it or leave a sliver.
  const dStart = base - gap.from;
  const dEnd = gap.to - (base + range.target);
  if (dStart <= tol || dEnd <= tol) {
    if (dStart <= dEnd) {
      const s = stretch(gap.from, 1);
      return done(gap.from, s.span, "neighbour", [gap.from, ...(s.tick !== undefined ? [s.tick] : [])]);
    }
    const s = stretch(gap.to, -1);
    return done(gap.to - s.span, s.span, "neighbour", [gap.to, ...(s.tick !== undefined ? [s.tick] : [])]);
  }
  // One end in line with something on the ring inside or outside.
  const a = nearest(cands, base, tol);
  const b = nearest(cands, base + range.target, tol);
  if (a !== null && (b === null || Math.abs(a - base) <= Math.abs(b - (base + range.target)))) {
    const s = stretch(a, 1);
    return done(a, s.span, "line", [a, ...(s.tick !== undefined ? [s.tick] : [])]);
  }
  if (b !== null) {
    const s = stretch(b, -1);
    return done(b - s.span, s.span, "line", [b, ...(s.tick !== undefined ? [s.tick] : [])]);
  }
  // Nothing nearer: the shared grid, whichever end is closer to it.
  const g = cfg.placement.gridNotches;
  if (g > 0) {
    const gs = Math.round(base / g) * g;
    const ge = Math.round((base + range.target) / g) * g;
    const byStart = Math.abs(gs - base) <= Math.abs(ge - (base + range.target));
    const start = byStart ? gs : ge - range.target;
    if (start >= gap.from && start + range.target <= gap.to) return done(start, range.target, "grid", [byStart ? gs : ge]);
  }
  return done(base, range.target);
}

/**
 * Dragging one side wall of a proposed room: the other stays put, and this one follows the pointer,
 * snapping (when on) to a neighbour, a line, or the grid. It can go past the room's range: the
 * placement check then says so.
 */
export function dragSide(layout: Layout, _type: string, at: Extract<Location, { kind: "ring" }>, side: "start" | "end", notch: number, snap = true, cfg: SimConfig = config): Placed {
  const fixed = side === "start" ? at.start + at.span : at.start;
  const dir = side === "start" ? -1 : 1;
  // The pointer, unwrapped on the dragged side of the fixed wall.
  let x = near(notch, fixed + (dir * at.span) / 2);
  if ((x - fixed) * dir < 1) x = fixed + dir;
  if ((x - fixed) * dir > N) x = fixed + dir * N;
  let kind: SnapKind | undefined;
  let tick: number | undefined;
  if (snap) {
    const tol = notchesFor(layout, at.ring, at.depth, cfg.placement.snapM, cfg);
    const mid = fixed + dir * 0.5;
    const gap = freeGap(layout, at.floor, at.ring, at.depth, mid);
    const far = gap ? (dir === 1 ? gap.to : gap.from) : NaN;
    const line = nearest(lines(layout, at.floor, at.ring, at.depth), x, tol);
    const g = cfg.placement.gridNotches;
    const grid = g > 0 ? Math.round(x / g) * g : NaN;
    if (Number.isFinite(far) && (Math.abs(far - x) <= tol || (x - far) * dir > 0)) [x, kind, tick] = [far, "neighbour", far];
    else if (line !== null) [x, kind, tick] = [line, "line", line];
    else if (Number.isFinite(grid) && Math.abs(grid - x) <= tol && (grid - fixed) * dir >= 1) [x, kind, tick] = [grid, "grid", grid];
  }
  const span = Math.max(1, Math.round((x - fixed) * dir));
  const start = side === "start" ? fixed - span : fixed;
  return { start: wrapNotch(Math.round(start), N), span, ...(kind ? { snap: kind } : {}), ticks: tick !== undefined ? [wrapNotch(Math.round(tick), N)] : [] };
}

export type FillResult = { ok: true; start: number; span: number } | { ok: false; reason: string };

/**
 * Double-clicking a gap with a fill room: wall to wall, the stretch of the same kind of space under
 * the pointer (empty space, or rock) between two rooms, or between a room and where the dug-out
 * space ends. Says why if it's outside the fill room's range.
 */
export function fillGap(layout: Layout, type: string, floor: number, ring: number, notch: number, cfg: SimConfig = config): FillResult {
  if (!isRoomType(type) || !roomDef(type).fill) return { ok: false, reason: "Only a fill room (empty space, a plaza, the park) fills a gap" };
  const depth = depthsFor(type, cfg)[0]!;
  const list = piecesOn(layout, floor, ring);
  const x = ((notch % N) + N) % N;
  const i = list.findIndex((p) => (((x - p.a0) % N) + N) % N < p.a1 - p.a0);
  const here = list[i];
  if (!here) return { ok: false, reason: "Nothing to fill here" };
  if (here.room) return { ok: false, reason: "There's a room here already" };
  const same = (p: Piece) => !p.room && p.open === here.open;
  if (list.every(same)) return { ok: false, reason: "Too wide: at most a quarter of the way round" };
  let from = here.a0;
  let span = here.a1 - here.a0;
  for (let k = 1; k < list.length && same(list[(i - k + list.length) % list.length]!); k++) {
    const p = list[(i - k + list.length) % list.length]!;
    from = p.a0;
    span += p.a1 - p.a0;
  }
  for (let k = 1; k < list.length && same(list[(i + k) % list.length]!); k++) span += list[(i + k) % list.length]!.a1 - list[(i + k) % list.length]!.a0;
  const range = spanRange(layout.hole, type, ring, depth, cfg);
  const per = spanArea(layout.hole.shaftRadiusM, ring, depth, 1, cfg.geometry);
  if (span > range.max) {
    return { ok: false, reason: range.max >= Math.floor(cfg.placement.fill.maxTurn * N) ? "Too wide: at most a quarter of the way round" : `Too wide: up to ${Math.round(range.max * per)} m²` };
  }
  if (span < range.min) return { ok: false, reason: `Too narrow: at least ${Math.round(range.min * per)} m²` };
  return { ok: true, start: wrapNotch(from, N), span };
}
