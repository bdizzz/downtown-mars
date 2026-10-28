import { floorSpan, GALLERY_W, ringRadii, RING_D, TAU } from "../render3d/cylinder";
import { edgeById, edgeLengthM } from "../sim/edges";
import type { Layout } from "../sim/placement";
import lighting from "../../data/lighting.json";

// The Godot viewer's ceiling lights (#305): where they hang, for the bridge to send with the scene.

export interface Overhead {
  x: number;
  y: number;
  z: number;
  floor: number;
  kind: "room" | "corridor";
}

const round = (x: number) => Math.round(x * 1000) / 1000;

/**
 * Where the ceiling lights go: one over the middle of each cell of a finished room, under the ceiling
 * of the room's top floor, and one every `corridorSpacingM` along each built corridor and tube.
 */
export function overheadLights(layout: Layout): Overhead[] {
  const { corridorSpacingM, dropM } = lighting.overhead;
  const hole = layout.hole;
  const out: Overhead[] = [];
  const at = (r: number, turn: number, floor: number, kind: Overhead["kind"]) =>
    out.push({ x: round(r * Math.cos(turn * TAU)), y: round(floorSpan(floor)[1] - dropM), z: round(r * Math.sin(turn * TAU)), floor, kind });
  for (const room of layout.rooms) {
    if (room.planned || room.building) continue;
    // A room taller than a floor has its light at the top, once per column of cells.
    const top = new Map<string, number>();
    for (const c of room.cells) {
      const key = `${c.ring}:${c.slot}`;
      top.set(key, Math.min(top.get(key) ?? Infinity, c.floor));
    }
    for (const [key, floor] of top) {
      const [ring, slot] = key.split(":").map(Number) as [number, number];
      const [r0, r1] = ringRadii(hole, ring);
      at((r0 + r1) / 2, (slot + 0.5) / hole.ringSlots[ring - 1]!, floor, "room");
    }
  }
  for (const id of Object.keys(layout.corridors ?? {})) {
    if (layout.corridorsBuilding?.[id] !== undefined) continue;
    const e = edgeById(hole, id);
    if (!e) continue;
    if (e.kind === "radial") {
      const [r0, r1] = ringRadii(hole, e.ring);
      at((r0 + r1) / 2, e.turn, e.floor, "corridor");
      continue;
    }
    // Along an arc, as many as fit at the spacing (a short piece between cuts may have none); circle 0 is the gallery tube.
    const n = Math.round(edgeLengthM(hole, e, RING_D) / corridorSpacingM);
    const r = e.circle === 0 ? hole.shaftRadiusM - GALLERY_W / 2 : hole.shaftRadiusM + e.circle * RING_D;
    for (let i = 0; i < n; i++) at(r, e.a0 + ((i + 0.5) / n) * (e.a1 - e.a0), e.floor, "corridor");
  }
  return out;
}
