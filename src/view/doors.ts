import { corridors } from "../sim/corridors";
import { deadEnds, doorAlong } from "../sim/deadEnds";
import { edgeLengthM, galleryEdges, isGalleryEdge, outsideEdges, type Edge } from "../sim/edges";
import type { Cell, Layout, RoomInstance } from "../sim/placement";
import { roomDef } from "../sim/rooms";
import { ownSide, viewAcross, type Across } from "../sim/windows";
import { RING_D, ringRadii, slotAngles, WALL_T } from "../render3d/cylinder";

// A private room's doors: one on each of its floors, wherever it opens onto
// something walkable: a gallery tube along its shaft face first, else the
// longest stretch of corridor along one of its walls, else a walk-through room
// (a plaza, stairs) beside it, else where a corridor ends against one of its
// walls (T-022). A door's opening keeps at least a metre from the room's
// corners. A room with none of those on a floor has no door there (it's cut
// off anyway). Public rooms are open, so they have none.
// The 3D view cuts the doorway into the wall, furnishing keeps it clear, and
// first-person walking goes through it.

/** A doorway: its width, and its height above the base of the floor. */
export const DOOR = { width: corridors.door.widthM, height: 2.7 };
/** How far either side of its wall a doorway reaches (metres): stand in it and you're both in the room and outside. */
export const DOOR_DEPTH = 0.6;

/** Which of a cell's walls: its inner or outer curved face, or its left or right side. */
export type WallSide = "inner" | "outer" | "left" | "right";

export interface Doorway {
  roomId: number;
  floor: number;
  /** The border it's on, and the cell whose wall it's cut in. */
  edge: string;
  cell: Cell;
  side: WallSide;
  /**
   * On a curved wall: the wall's radius as it stands (pulled back half a corridor where one runs),
   * the door's middle angle, and half its width as an angle at that radius.
   * On a side wall: `angle` is the wall's own angle (pulled back the same way), `r` the radius of
   * the door's middle along it, and `half` half its width in metres.
   */
  r: number;
  angle: number;
  half: number;
}

const HALL = corridors.widthM / 2;
/** A wall's inner face stands half its thickness in from the border. */
const WALL = WALL_T / 2;

/** What's across an outside edge of a room, for a door: a tube (the shaft: not without one, unless under the dome), a corridor, a walk-through room, or nothing to walk out to. */
export function acrossEdge(layout: Layout, e: Edge, own: Set<string>): Across | null {
  if (isGalleryEdge(e)) return layout.domed || layout.corridors?.[e.id] ? "shaft" : null;
  return viewAcross(layout, e, own);
}

const key = (c: Cell) => `${c.floor}:${c.ring}:${c.slot}`;

/** Which wall of its own cell an edge is. */
export function sideOf(e: Edge, cell: Cell): WallSide {
  if (e.kind === "arc") return e.circle === cell.ring - 1 ? "inner" : "outer";
  return e.index === cell.slot ? "left" : "right";
}

/** How far a wall's inner face stands back from its border: half the wall, plus half a corridor where one runs (gallery tubes run outside the shaft wall). */
function pullBack(layout: Layout, e: Edge): number {
  if (isGalleryEdge(e)) return WALL;
  return layout.corridors?.[e.id] ? HALL + WALL : WALL;
}

/**
 * A doorway on this edge of this cell: in the middle of the edge, or at `at` along it
 * (a turn on a curved wall, a radius on a side wall).
 */
export function doorwayAt(layout: Layout, roomId: number, e: Edge, cell: Cell, at?: number): Doorway {
  const hole = layout.hole;
  const side = sideOf(e, cell);
  const back = pullBack(layout, e);
  if (e.kind === "arc") {
    const [r0, r1] = ringRadii(hole, cell.ring);
    const r = side === "inner" ? r0 + back : r1 - back;
    return { roomId, floor: e.floor, edge: e.id, cell, side, r, angle: (at ?? (e.a0 + e.a1) / 2) * Math.PI * 2, half: DOOR.width / 2 / r };
  }
  const [r0, r1] = ringRadii(hole, cell.ring);
  const r = at ?? (r0 + r1) / 2;
  const [s0, s1] = slotAngles(cell.slot, hole.ringSlots[cell.ring - 1]!);
  const off = Math.asin(Math.min(0.99, back / r));
  return { roomId, floor: e.floor, edge: e.id, cell, side, r, angle: side === "left" ? s0 + off : s1 - off, half: DOOR.width / 2 };
}

/** Room for a door along an edge (metres), less a frame either side. */
const FITS = DOOR.width + 0.6;
const RANK = { shaft: 0, corridor: 1, public: 2 } as const;

/** A room's doors, one per floor where it opens onto something walkable. */
export function doorways(layout: Layout, room: RoomInstance): Doorway[] {
  if (room.at.kind !== "ring" || roomDef(room.type).public) return [];
  const hole = layout.hole;
  const own = new Set(room.cells.map(key));
  const floors = [...new Set(room.cells.map((c) => c.floor))].sort((a, b) => a - b);
  const out: Doorway[] = [];
  for (const floor of floors) {
    const cells = room.cells.filter((c) => c.floor === floor);
    // Along the shaft: the middle of the run of tubes in front of the room, as before.
    const tubes = galleryEdges(hole, floor);
    const faced = cells
      .filter((c) => c.ring === 1)
      .filter((c) => {
        const t = tubes[c.slot];
        return !!t && acrossEdge(layout, t, own) === "shaft" && layout.corridorsBuilding?.[t.id] === undefined;
      })
      .sort((a, b) => a.slot - b.slot);
    const mid = faced[Math.floor(faced.length / 2)];
    if (mid) {
      out.push(doorwayAt(layout, room.id, tubes[mid.slot]!, mid));
      continue;
    }
    // Otherwise: the best border it opens onto (a corridor, then a walk-through room), the longest first,
    // the door slid along it if it would come too near a corner.
    const options = outsideEdges(hole, cells)
      .map((e) => ({ e, kind: acrossEdge(layout, e, own), len: edgeLengthM(hole, e, RING_D) }))
      .filter((o): o is { e: Edge; kind: "corridor" | "public"; len: number } => o.kind === "corridor" || o.kind === "public")
      .filter((o) => o.len >= FITS)
      .sort((a, b) => RANK[a.kind] - RANK[b.kind] || b.len - a.len || (a.e.id < b.e.id ? -1 : 1));
    const best = options.map((o) => ({ ...o, at: doorAlong(layout, cells, o.e), cell: ownSide(layout, o.e, own) })).find((o) => o.at !== null && o.cell);
    if (best) {
      out.push(doorwayAt(layout, room.id, best.e, best.cell!, best.at!));
      continue;
    }
    // Last: where a corridor runs up to one of its walls and stops.
    const end = deadEnds(layout, cells)[0];
    if (end) out.push(doorwayAt(layout, room.id, end.wall, end.cell, end.at));
  }
  return out;
}

const cache = new WeakMap<Layout, { version: number; byFloor: Map<number, Doorway[]> }>();

/** Every room's doors on a floor, kept until the layout changes. */
export function doorsOnFloor(layout: Layout, floor: number): Doorway[] {
  let hit = cache.get(layout);
  if (!hit || hit.version !== layout.version) {
    hit = { version: layout.version, byFloor: new Map() };
    for (const room of layout.rooms) {
      if (room.planned || room.building) continue;
      for (const d of doorways(layout, room)) hit.byFloor.set(d.floor, [...(hit.byFloor.get(d.floor) ?? []), d]);
    }
    cache.set(layout, hit);
  }
  return hit.byFloor.get(floor) ?? [];
}

/** Is a point (radius r, angle a, radians) in this doorway: within its width and close to its wall? */
export function inDoorway(d: Doorway, r: number, a: number, margin = 0): boolean {
  if (d.side === "inner" || d.side === "outer") {
    if (Math.abs(r - d.r) > DOOR_DEPTH) return false;
    return Math.abs(angleDiff(a, d.angle)) * d.r <= d.half * d.r - margin;
  }
  // A side wall: distance across it, and along it from the door's middle.
  const t = angleDiff(a, d.angle);
  const across = r * Math.sin(t);
  const along = r * Math.cos(t) - d.r;
  return Math.abs(across) <= DOOR_DEPTH && Math.abs(along) <= d.half - margin;
}

function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
