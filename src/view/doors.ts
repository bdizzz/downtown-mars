import type { Layout, RoomInstance } from "../sim/placement";
import { roomDef } from "../sim/rooms";
import { galleryEdges } from "../sim/edges";
import { ringRadii, slotAngles } from "../render3d/cylinder";

// A private room's doors onto the gallery: one on each of its floors where a
// gallery tube runs along its shaft face, in the middle of the stretch the
// tubes cover. Without a tube there, that face is all window. Public rooms
// open straight onto a tube, so they have none. The 3D view cuts the doorway into the
// wall, furnishing keeps it clear, and first-person walking goes through it.

/** A doorway: its width, and its height above the base of the floor (the gallery's ledge plus a door). */
export const DOOR = { width: 1.3, height: 2.7 };

export interface Doorway {
  floor: number;
  /** Its middle, radians. */
  angle: number;
  /** The shaft face it's cut into (ring 1's inner radius). */
  r: number;
  /** Half its width, as an angle at r. */
  half: number;
}

export function doorways(layout: Layout, room: RoomInstance): Doorway[] {
  if (room.at.kind !== "ring" || roomDef(room.type).public) return [];
  const n = layout.hole.ringSlots[0]!;
  const r = ringRadii(layout.hole, 1)[0];
  const floors = [...new Set(room.cells.map((c) => c.floor))];
  return floors.flatMap((floor) => {
    // Ring-1 slots map one to one onto the shaft wall's gallery edges.
    const tubes = galleryEdges(layout.hole, floor);
    const faces = room.cells
      .filter((c) => c.floor === floor && c.ring === 1)
      .filter((c) => {
        const id = tubes[c.slot]?.id;
        if (layout.domed) return true;
        return !!id && !!layout.corridors?.[id] && layout.corridorsBuilding?.[id] === undefined;
      })
      .sort((a, b) => a.slot - b.slot);
    const mid = faces[Math.floor(faces.length / 2)];
    if (!mid) return [];
    const [a0, a1] = slotAngles(mid.slot, n);
    return [{ floor, angle: (a0 + a1) / 2, r, half: DOOR.width / 2 / r }];
  });
}
