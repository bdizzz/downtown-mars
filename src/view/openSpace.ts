import { isOpen } from "../sim/excavation";
import { roomAt, type Cell, type Layout, type RoomInstance } from "../sim/placement";
import { roomDef } from "../sim/rooms";

// Open space (#564): dug-out empty space (what an empty room becomes once dug)
// and built walk-through rooms (stairs, plazas, parks, the entrance). Where two
// pieces of it meet there's no wall between them, so they read as one hall; a
// wall still stands where open space meets a private room or rock. Lifts keep
// their walls (#565), and a plan or a building site stays walled until it's done.

/** Does this room open onto open space beside it: a built walk-through room in the rings, not a lift? */
export function joinsOpen(room: RoomInstance): boolean {
  const def = roomDef(room.type);
  return room.at.kind === "ring" && !!def.public && !def.lift && !def.excavationOnly && !room.planned && !room.building;
}

/** Is this cell open space: dug out with no room in it, or part of a room that joins open space? */
export function openSpaceAt(layout: Layout, c: Cell): boolean {
  if (c.floor < 1 || c.floor > layout.hole.floors) return false;
  const room = roomAt(layout, c);
  return room ? joinsOpen(room) : isOpen(layout, c);
}
