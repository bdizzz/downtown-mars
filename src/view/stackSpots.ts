import { config } from "../sim/config";
import { checkBuild } from "../sim/costs";
import { checkPlacement, footprint, type Cell, type Layout, type Location } from "../sim/placement";
import { roomDef } from "../sim/rooms";
import type { HoverInfo, Pick, StageOptions } from "./types";

// Ghost markers (#520): where a stair or elevator column could grow a floor, up or down. Worked out
// here, from the layout alone, so the 3D view, the plan view and Godot (through the bridge) agree.

/** Somewhere a column could reach one floor further: the piece to build, and its cells on that floor. */
export interface StackSpot {
  /** The column's room type ("stairs", "elevator", …) and id. */
  type: string;
  roomId: number;
  /** The piece that adds the floor: placed as a normal build, it joins the column. */
  at: Extract<Location, { kind: "ring" }>;
  /** Its footprint on the new floor: where the marker goes. */
  cells: Cell[];
}

const key = (c: Cell) => `${c.floor}:${c.ring}:${c.slot}`;

/**
 * Every spot on `floor` a stair or elevator column (built, under construction or planned) could extend to:
 * the floor just above its top or just below its bottom, dug, with nothing but rock or empty space there,
 * where the extension would be allowed (its height limit, say). One spot per cell, whichever column comes first.
 */
export function stackSpots(layout: Layout, floor: number): StackSpot[] {
  const hole = layout.hole;
  if (floor < 1 || floor > hole.floors) return [];
  const out: StackSpot[] = [];
  const taken = new Set<string>();
  for (const room of layout.rooms) {
    const def = roomDef(room.type);
    if (!def.stacks || def.cargoShaft || room.at.kind !== "ring") continue;
    const floors = [...room.cells, ...(room.pendingCells ?? [])].map((c) => c.floor);
    if (!floors.length) continue;
    const top = Math.min(...floors);
    const bottom = Math.max(...floors);
    const height = def.floors ?? 1;
    // A piece whose last floor is the new one below, or whose first is the new one above.
    const pieceFloor = floor === bottom + 1 ? floor - height + 1 : floor === top - 1 ? floor : null;
    if (pieceFloor === null || pieceFloor < 1) continue;
    const at = { ...room.at, floor: pieceFloor };
    const cells = footprint(hole, floor, at.ring, at.slot, at.w, at.d);
    if (cells.some((c) => layout.grid[c.floor - 1]?.[c.ring - 1]?.[c.slot] || taken.has(key(c)))) continue;
    if (!checkPlacement(layout, room.type, at, config).ok) continue;
    for (const c of cells) taken.add(key(c));
    out.push({ type: room.type, roomId: room.id, at, cells });
  }
  return out;
}

/** The spot under a pick, if it's on one. */
export function stackSpotAt(spots: StackSpot[], p: Pick): StackSpot | undefined {
  if (p.kind !== "slot") return undefined;
  return spots.find((s) => s.cells.some((c) => c.floor === p.floor && c.ring === p.ring && c.slot === p.slot));
}

/** Hovering a marker with nothing in hand: what building there would do and cost, as a build tool's hover would say. */
export function stackHover(layout: Layout, resources: Record<string, number>, p: Pick, gates: string[] = []): HoverInfo | null {
  if (p.kind !== "slot") return null;
  const spot = stackSpotAt(stackSpots(layout, p.floor), p);
  if (!spot) return null;
  return { pick: p, check: checkBuild(layout, resources, spot.type, spot.at, config, gates), stack: { room: spot.type, at: spot.at } };
}

/** Clicking a marker: build the piece, as a normal build (asking first if it would fill in corridors). */
export function stackClick(info: HoverInfo, opts: StageOptions): void {
  const s = info.stack;
  const check = info.check;
  if (!s || !check) return;
  if (!check.ok) opts.onInvalid?.(check.reason);
  else if (check.destroys?.length) opts.onConfirmBuild?.({ room: s.room, at: s.at, destroys: check.destroys, strands: check.strands ?? { rooms: [], corridors: [] } });
  else opts.onCommand?.({ type: "build", room: s.room, at: s.at });
}
