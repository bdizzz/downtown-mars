import { config, type SimConfig } from "./config";
import { edgeById, edgeLengthM, edgeSides, isGalleryEdge, outsideEdges, type Edge } from "./edges";
import { roomAt, type Cell, type Layout, type RoomInstance } from "./placement";
import { roomDef } from "./rooms";

// Windows: an upgrade for a room's walls (PLAN-M13). A room has none until the
// player puts them in, a whole wall at a time, and only where there's
// something to look out on: the shaft, a corridor, or a walk-through room (a
// plaza, stairs) across the wall. A home's windows add to its comfort: its
// best view, and a little for each other glazed wall.

/** What's across a wall, to look out on (or walk out to). */
export type Across = "shaft" | "corridor" | "public";

const key = (c: Cell) => `${c.floor}:${c.ring}:${c.slot}`;
const ownCells = (room: RoomInstance) => new Set(room.cells.map(key));

/** The cell across an edge from a room (the one not its own), or null at the shaft. */
export function otherSide(layout: Layout, e: Edge, own: Set<string>): Cell | null {
  return edgeSides(layout.hole, e).find((c) => c && !own.has(key(c))) ?? null;
}

/** The room's own cell along an edge. */
export function ownSide(layout: Layout, e: Edge, own: Set<string>): Cell | null {
  return edgeSides(layout.hole, e).find((c) => c && own.has(key(c))) ?? null;
}

/** What's across an outside border of a room: the shaft (tube or not), a built corridor, a built walk-through room, or nothing to see. */
export function viewAcross(layout: Layout, e: Edge, own: Set<string>): Across | null {
  if (isGalleryEdge(e)) return "shaft";
  if (layout.corridors?.[e.id] && layout.corridorsBuilding?.[e.id] === undefined) return "corridor";
  const other = otherSide(layout, e, own);
  const room = other ? roomAt(layout, other) : undefined;
  if (room && !room.planned && !room.building && roomDef(room.type).public && !roomDef(room.type).excavationOnly) return "public";
  return null;
}

/** Same line, same floor: two borders on one wall of a room (an arc on the same circle, or a spoke on the same slot line). */
function sameWall(a: Edge, b: Edge): boolean {
  if (a.floor !== b.floor || a.kind !== b.kind) return false;
  if (a.kind === "arc" && b.kind === "arc") return a.circle === b.circle;
  if (a.kind === "radial" && b.kind === "radial") return a.index === b.index && a.ring === b.ring;
  return false;
}

/**
 * The wall of a room a border is on: every outside border of the room along
 * the same line on that floor that has something across it, or null when the
 * border isn't one of the room's.
 */
export function wallOf(layout: Layout, room: RoomInstance, edgeId: string): Edge[] | null {
  const own = ownCells(room);
  const outside = outsideEdges(layout.hole, room.cells);
  const e = outside.find((x) => x.id === edgeId);
  if (!e) return null;
  return outside.filter((x) => sameWall(x, e) && viewAcross(layout, x, own) !== null);
}

/** Which side of a border a room is on, in edgeSides' order (0: the lower slot, or the inner ring), or null if neither. */
export function roomSide(layout: Layout, room: RoomInstance, e: Edge): 0 | 1 | null {
  const own = ownCells(room);
  const i = edgeSides(layout.hole, e).findIndex((c) => !!c && own.has(key(c)));
  return i === 0 || i === 1 ? i : null;
}

/** The borders of a room's wall (the one this border is on) that have windows in them, blind or not: what taking them out clears. */
export function glazedOnWall(layout: Layout, room: RoomInstance, edgeId: string): Edge[] {
  const e = edgeById(layout.hole, edgeId);
  if (!e || !room.windows?.length) return [];
  return room.windows.map((id) => edgeById(layout.hole, id)).filter((x): x is Edge => !!x && sameWall(x, e));
}

/** What a room sees across one of its borders. */
export function glazedAcross(layout: Layout, room: RoomInstance, e: Edge): Across | null {
  return viewAcross(layout, e, ownCells(room));
}

/**
 * Which room a border's windows would go in: the room on the side the
 * pointer is (`near`), if it's one of its walls; else a room on either side
 * that can have windows.
 */
export function roomForWindows(layout: Layout, edgeId: string, near?: Cell | null): RoomInstance | null {
  const e = edgeById(layout.hole, edgeId);
  if (!e) return null;
  const sides = edgeSides(layout.hole, e).filter((c): c is Cell => !!c);
  const rooms = sides.map((c) => roomAt(layout, c)).filter((r): r is RoomInstance => !!r && glazable(r));
  const at = near ? roomAt(layout, near) : undefined;
  return rooms.find((r) => r === at) ?? rooms[0] ?? null;
}

/** Can a room have windows at all: a room in the rings, private (a walk-through room is open already), more than a plan. */
function glazable(room: RoomInstance): boolean {
  const def = roomDef(room.type);
  return room.at.kind === "ring" && !def.public && !def.excavationOnly && !room.planned;
}

/** What windows along these borders cost: by length, a part-started 10 m counting whole. */
export function windowCost(layout: Layout, edges: Edge[], cfg: SimConfig = config): Record<string, number> {
  const m = edges.reduce((s, e) => s + edgeLengthM(layout.hole, e, cfg.geometry.roomDepthM), 0);
  const steps = Math.max(1, Math.ceil(m / 10 - 1e-9));
  return Object.fromEntries(Object.entries(cfg.windows.costPer10m).map(([id, v]) => [id, v * steps]));
}

/** Why windows can't go in (or come out of) these borders of a room, or null if they can. */
export function windowRefusal(room: RoomInstance | null | undefined, edges: string[], on: boolean): string | null {
  if (!room) return "Windows go in a room's wall: there's no room here";
  if (!glazable(room)) return roomDef(room.type).public ? "A walk-through room is open already: no windows needed" : room.planned ? "Not dug out yet" : "No windows here";
  if (!on) return edges.some((id) => room.windows?.includes(id)) ? null : "No windows in this wall";
  if (!edges.length) return "Nothing to look out on: windows need a corridor, the shaft or a plaza across the wall";
  if (edges.every((id) => room.windows?.includes(id))) return "Already has windows";
  return null;
}

/** A room's windows that see something (a corridor filled in, or a plaza gone, leaves them blind), with what's across each. */
export function glazedWalls(layout: Layout, room: RoomInstance): { edge: Edge; across: Across }[] {
  if (!room.windows?.length || !glazable(room)) return [];
  const own = ownCells(room);
  const out: { edge: Edge; across: Across }[] = [];
  for (const id of room.windows) {
    const e = edgeById(layout.hole, id);
    if (!e) continue;
    const across = viewAcross(layout, e, own);
    if (across) out.push({ edge: e, across });
  }
  return out;
}

/** Is there a gallery tube in front of a shaft-side border (built, or being built), with no dome over the shaft? */
function behindTube(layout: Layout, e: Edge): boolean {
  return !layout.domed && !!layout.corridors?.[e.id];
}

/**
 * The comfort a home's windows give it: the view through its best wall (each
 * wall's view averaged along its length: a shaft face with a tube along part
 * of it sees partly through the tube), plus `extraWall` for each other wall
 * it has windows in, up to `cap`; and under the dome, the atrium too for a
 * room looking out on the shaft.
 */
export function windowComfort(layout: Layout, room: RoomInstance, cfg: SimConfig = config): number {
  const w = cfg.windows;
  const glazed = glazedWalls(layout, room);
  if (!glazed.length) return 0;
  const walls: { edge: Edge; len: number; sum: number }[] = [];
  for (const { edge, across } of glazed) {
    const view = across === "shaft" ? (behindTube(layout, edge) ? w.view.tube : w.view.shaft) : w.view[across];
    const len = edgeLengthM(layout.hole, edge, cfg.geometry.roomDepthM);
    const wall = walls.find((x) => sameWall(x.edge, edge));
    if (wall) {
      wall.len += len;
      wall.sum += len * view;
    } else walls.push({ edge, len, sum: len * view });
  }
  const best = Math.max(...walls.map((x) => x.sum / x.len));
  const atrium = layout.domed && glazed.some((x) => x.across === "shaft") ? cfg.dome.atriumComfort : 0;
  return Math.min(w.cap, best + w.extraWall * (walls.length - 1)) + atrium;
}

/** Put windows in (or take them out of) borders of a room: the borders' ids, kept on the room. */
export function setRoomWindows(room: RoomInstance, edges: string[], on: boolean): void {
  const have = new Set(room.windows ?? []);
  for (const id of edges) {
    if (on) have.add(id);
    else have.delete(id);
  }
  if (have.size) room.windows = [...have].sort();
  else delete room.windows;
}

/** The ring-1 borders a room faces the shaft along: where old saves had their windows. */
export function shaftBorders(layout: Layout, room: RoomInstance): string[] {
  return outsideEdges(layout.hole, room.cells)
    .filter((e) => isGalleryEdge(e))
    .map((e) => e.id);
}
