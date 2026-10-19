import raw from "../../data/corridors.json";
import { config } from "./config";
import { cellEdges, edgeSides, edgeVertices, isGalleryEdge, outsideEdges, type Edge } from "./edges";
import { ringSize } from "./geometry";
import type { Cell, Layout } from "./placement";

// A corridor that runs straight at a room and stops against its wall (say a
// radial corridor between two ring-2 rooms, ending at the inner wall of a wide
// ring-3 room) shares no border with it, but it's still a way in: the room can
// have a door where the corridor ends (T-022). Not at a corner, though: the
// doorway's opening keeps clear of the room's corners, and it stays inside the
// corridor's mouth and inside one cell's wall (the 3D view cuts each cell's
// wall on its own). Read from data/corridors.json directly: corridors.ts
// imports this module.

const data = raw as unknown as { widthM: number; door: { widthM: number; cornerClearM: number; frameM: number } };
const HALL = data.widthM / 2;
const HALF = data.door.widthM / 2;
const DEPTH = config.geometry.roomDepthM;

export interface DeadEnd {
  /** The corridor that ends against the wall. */
  corridor: string;
  /** Where it ends: a vertex key, as edges.ts makes them. */
  vertex: string;
  /** The room's own border the door is cut in, and the cell whose wall it is. */
  wall: Edge;
  cell: Cell;
  /** The door's middle along the wall: a turn on a curved wall, a radius (metres) on a side wall. */
  at: number;
}

interface End {
  key: string;
  circle: number;
  turn: number;
}

/** An edge's two ends, with where they are: which circle, and the angle in turns. */
function ends(layout: Layout, e: Edge): [End, End] {
  const [k0, k1] = edgeVertices(layout.hole, e);
  if (e.kind === "radial") {
    return [
      { key: k0, circle: e.ring - 1, turn: e.turn },
      { key: k1, circle: e.ring, turn: e.turn },
    ];
  }
  return [
    { key: k0, circle: e.circle, turn: e.a0 % 1 },
    { key: k1, circle: e.circle, turn: e.a1 % 1 },
  ];
}

const key = (c: Cell) => `${c.floor}:${c.ring}:${c.slot}`;
const circleR = (layout: Layout, circle: number) => layout.hole.shaftRadiusM + circle * DEPTH;
/** The shortest way round from turn b to turn a, in turns: −½ to ½. */
const turnDiff = (a: number, b: number) => {
  const d = (((a - b) % 1) + 1) % 1;
  return d > 0.5 ? d - 1 : d;
};
const sameTurn = (a: number, b: number) => Math.abs(turnDiff(a, b)) < 1e-9;

/** Where a corridor dead-ends against these cells' walls (a room's), and where a door fits there. */
export function deadEnds(layout: Layout, cells: Cell[]): DeadEnd[] {
  const out: DeadEnd[] = [];
  for (const floor of [...new Set(cells.map((c) => c.floor))].sort((a, b) => a - b)) out.push(...onFloor(layout, cells.filter((c) => c.floor === floor)));
  return out;
}

/** A room's walls on one floor: its outside borders, what meets at each of their ends, and its corners. */
interface Walls {
  own: Set<string>;
  walls: Edge[];
  at: Map<string, { end: End; arc: boolean; radial: boolean; walls: Edge[] }>;
  corners: End[];
}

function wallsOf(layout: Layout, cells: Cell[]): Walls {
  const own = new Set(cells.map(key));
  const walls = outsideEdges(layout.hole, cells);
  // The walls' ends: which kind of wall meets there. Where a curved wall meets a side wall, it's a corner.
  const at: Walls["at"] = new Map();
  for (const e of walls) {
    for (const end of ends(layout, e)) {
      const v = at.get(end.key) ?? { end, arc: false, radial: false, walls: [] };
      if (e.kind === "arc") v.arc = true;
      else v.radial = true;
      v.walls.push(e);
      at.set(end.key, v);
    }
  }
  return { own, walls, at, corners: [...at.values()].filter((v) => v.arc && v.radial).map((v) => v.end) };
}

/**
 * Where a door can go on one of a room's own borders (cells: the room's, on that floor): its middle,
 * a turn on a curved wall or a radius on a side wall, as near the border's middle as keeps its
 * opening clear of the room's corners. Null if the border is too short for that.
 */
export function doorAlong(layout: Layout, cells: Cell[], wall: Edge): number | null {
  const { corners } = wallsOf(layout, cells);
  if (wall.kind === "arc") {
    const r = circleR(layout, wall.circle);
    const mid = ((wall.a0 + wall.a1) / 2) % 1;
    const half = ((wall.a1 - wall.a0) / 2) * 2 * Math.PI * r;
    const x = place(-half, half, corners.filter((c) => c.circle === wall.circle).map((c) => turnDiff(c.turn, mid) * 2 * Math.PI * r), Infinity);
    return x === null ? null : (((mid + x / (2 * Math.PI * r)) % 1) + 1) % 1;
  }
  const mid = circleR(layout, wall.ring - 0.5);
  const x = place(-DEPTH / 2, DEPTH / 2, corners.filter((c) => sameTurn(c.turn, wall.turn)).map((c) => circleR(layout, c.circle) - mid), Infinity);
  return x === null ? null : mid + x;
}

function onFloor(layout: Layout, cells: Cell[]): DeadEnd[] {
  const hole = layout.hole;
  const { own, walls, at, corners } = wallsOf(layout, cells);
  const wallIds = new Set(walls.map((e) => e.id));
  // Corridors on the borders of the cells across the walls: any that ends on a wall, away from a corner.
  const seen = new Set<string>();
  const out: DeadEnd[] = [];
  for (const w of walls) {
    for (const across of edgeSides(hole, w)) {
      if (!across || own.has(key(across))) continue;
      for (const c of cellEdges(hole, across)) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        if (!layout.corridors?.[c.id] || layout.corridorsBuilding?.[c.id] !== undefined || isGalleryEdge(c) || wallIds.has(c.id)) continue;
        if (edgeSides(hole, c).some((x) => x && own.has(key(x)))) continue;
        for (const end of ends(layout, c)) {
          const v = at.get(end.key);
          // Square onto the wall: a spoke into a curved wall, a curved corridor into a side wall.
          if (!v || (c.kind === "radial" ? !v.arc || v.radial : !v.radial || v.arc)) continue;
          const spot = c.kind === "radial" ? onCurvedWall(layout, own, v.end, v.walls, corners) : onSideWall(layout, own, v.end, v.walls, corners);
          if (spot) out.push({ corridor: c.id, vertex: end.key, ...spot });
        }
      }
    }
  }
  return out.sort((a, b) => (a.corridor < b.corridor ? -1 : a.corridor > b.corridor ? 1 : 0));
}

/**
 * Where along a wall a door's middle can go, in metres from a point on it (where a corridor
 * ends, or a border's middle): within `mouth` of it, inside the wall (`lo`, `hi`, less a frame),
 * and its opening clear of the nearest corner either way. The spot nearest the point, or null.
 */
function place(lo: number, hi: number, cornerPositions: number[], mouth = HALL - HALF): number | null {
  const frame = HALF + data.door.frameM;
  const clear = data.door.cornerClearM + HALF;
  const left = Math.max(-Infinity, ...cornerPositions.filter((p) => p < 0));
  const right = Math.min(Infinity, ...cornerPositions.filter((p) => p > 0));
  const from = Math.max(-mouth, lo + frame, left + clear);
  const to = Math.min(mouth, hi - frame, right - clear);
  if (from > to + 1e-9) return null;
  return Math.min(Math.max(0, from), to);
}

/** A cell of the room along this wall, and the wall's end at the vertex that's its own. */
function ownCell(layout: Layout, own: Set<string>, e: Edge): Cell | null {
  return edgeSides(layout.hole, e).find((x): x is Cell => !!x && own.has(key(x))) ?? null;
}

/** A spoke ending on a curved wall: the door goes in that wall, near the spoke's end. */
function onCurvedWall(layout: Layout, own: Set<string>, v: End, walls: Edge[], corners: End[]): Omit<DeadEnd, "corridor" | "vertex"> | null {
  const r = circleR(layout, v.circle);
  const metres = (t: number) => turnDiff(t, v.turn) * 2 * Math.PI * r;
  const cornerPositions = corners.filter((c) => c.circle === v.circle).map((c) => metres(c.turn));
  let best: { x: number; cell: Cell } | null = null;
  for (const w of walls) {
    const cell = ownCell(layout, own, w);
    if (!cell) continue;
    const n = ringSize(layout.hole, cell.ring);
    // The cell's span either side of the vertex (which may be one of its own ends).
    const s0 = cell.slot / n;
    const lo = sameTurn(s0, v.turn) ? 0 : metres(s0);
    const hi = sameTurn((cell.slot + 1) / n, v.turn) ? 0 : metres((cell.slot + 1) / n);
    const x = place(lo, hi, cornerPositions);
    if (x !== null && (!best || Math.abs(x) < Math.abs(best.x))) best = { x, cell };
  }
  if (!best) return null;
  const turn = (((v.turn + best.x / (2 * Math.PI * r)) % 1) + 1) % 1;
  const wall = cellEdges(layout.hole, best.cell).find((e) => e.kind === "arc" && e.circle === v.circle && (((turn - e.a0) % 1) + 1) % 1 < e.a1 - e.a0 - 1e-12);
  return wall ? { wall, cell: best.cell, at: turn } : null;
}

/** A curved corridor ending on a side wall: the door goes in that wall, near the corridor's end. */
function onSideWall(layout: Layout, own: Set<string>, v: End, walls: Edge[], corners: End[]): Omit<DeadEnd, "corridor" | "vertex"> | null {
  const rv = circleR(layout, v.circle);
  const cornerPositions = corners.filter((c) => sameTurn(c.turn, v.turn)).map((c) => circleR(layout, c.circle) - rv);
  let best: { x: number; cell: Cell; wall: Edge } | null = null;
  for (const w of walls) {
    if (w.kind !== "radial") continue;
    const cell = ownCell(layout, own, w);
    if (!cell) continue;
    const lo = circleR(layout, cell.ring - 1) - rv;
    const hi = circleR(layout, cell.ring) - rv;
    const x = place(lo, hi, cornerPositions);
    if (x !== null && (!best || Math.abs(x) < Math.abs(best.x))) best = { x, cell, wall: w };
  }
  return best ? { wall: best.wall, cell: best.cell, at: rv + best.x } : null;
}
