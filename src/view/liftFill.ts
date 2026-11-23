import type { Layout, RoomInstance } from "../sim/placement";
import { roomDef } from "../sim/rooms";
import { frameOf, furnish, type Frame } from "./furnish";
import { itemDef } from "./furniture";

// A lift's shaft is walled thick (#565): a solid collar about a metre deep
// round the car, open only in front of its doors, in rock where the lift was
// dug from rock and marscrete where it was built over dug-out space. The rest
// of the room is its lobby. The 3D view and the plan draw the collar; walking
// treats it as solid. Both read it from here, so they agree.

/** The collar's sizes, metres: the gap left round the car, the collar's depth, the doors' opening (half its width), and the drawing step. */
export const LIFT_FILL = { margin: 0.1, thick: 1.0, doors: 1.0, step: 0.25 };

/** A run of fill: a ring sector of the floor, radii and angles (radians), on a floor. */
export interface FillRun {
  r0: number;
  r1: number;
  a0: number;
  a1: number;
}

export interface LiftFill {
  floor: number;
  /** What it's made of: as the lift was built into (absent from marscreteFill: rock). */
  look: "rock" | "marscrete";
  frame: Frame;
  /** Is this point (x, z) open: anywhere in the room but the collar itself? */
  open: (x: number, z: number) => boolean;
  /** The collar, as ring-sector runs. */
  runs: FillRun[];
}

/** Does this room have a collar round its shaft? A passenger lift, once built (a cargo elevator's stop is a loading bay). */
export function hasLiftFill(room: RoomInstance): boolean {
  const def = roomDef(room.type);
  return !!def.lift && !def.cargoShaft && room.at.kind === "ring" && !room.planned && !room.building;
}

const cache = new WeakMap<Layout, { version: number; fills: Map<string, LiftFill | null> }>();

/** A lift's fill on one floor, or null for a room without one. Kept until the layout changes. */
export function liftFill(layout: Layout, room: RoomInstance, floor: number): LiftFill | null {
  if (!hasLiftFill(room)) return null;
  let hit = cache.get(layout);
  if (!hit || hit.version !== layout.version) {
    hit = { version: layout.version, fills: new Map() };
    cache.set(layout, hit);
  }
  const key = `${room.id}:${floor}:${room.marscreteFill?.join(",") ?? ""}`;
  if (!hit.fills.has(key)) hit.fills.set(key, makeFill(layout, room, floor));
  return hit.fills.get(key)!;
}

function makeFill(layout: Layout, room: RoomInstance, floor: number): LiftFill | null {
  const frame = frameOf(layout, room, floor);
  if (!frame) return null;
  const { margin, thick, doors, step } = LIFT_FILL;
  // The shaft as furnished on this floor (its car at the bottom): where it stands and which way its doors face.
  const shaft = furnish(layout, room).find((f) => f.floor === floor && (f.item === "elevator_shaft" || f.item === "elevator_car"));
  if (!shaft) return null;
  const { x: cx, z: cz, turn } = shaft;
  // The shaft's own axes: Z out of its doors, X across them.
  const Z: [number, number] = [Math.sin(turn), Math.cos(turn)];
  const X: [number, number] = [Math.cos(turn), -Math.sin(turn)];
  const [w, d] = itemDef(shaft.item).size;
  const toLocal = (x: number, z: number): [number, number] => [(x - cx) * X[0] + (z - cz) * X[1], (x - cx) * Z[0] + (z - cz) * Z[1]];
  const hu = w / 2 + margin;
  const hv = d / 2 + margin;
  // Solid between the car's own box and a metre out from it, but for the opening in front of its doors.
  const solid = (u: number, v: number) => {
    const inCollar = Math.abs(u) <= hu + thick && Math.abs(v) <= hv + thick;
    const inShaft = Math.abs(u) <= hu && Math.abs(v) <= hv;
    const atDoors = v > 0 && Math.abs(u) <= doors;
    return inCollar && !inShaft && !atDoors;
  };
  const open = (x: number, z: number): boolean => !solid(...toLocal(x, z));
  // The collar in rings of `step`, each a run of sectors wherever it's solid.
  const runs: FillRun[] = [];
  for (let r0 = frame.rIn; r0 < frame.rOut - 1e-6; r0 += step) {
    const r1 = Math.min(frame.rOut, r0 + step);
    const r = (r0 + r1) / 2;
    const a0 = frame.left(r);
    const a1 = frame.right(r);
    const n = Math.max(1, Math.round(((a1 - a0) * r) / step));
    const da = (a1 - a0) / n;
    let start: number | null = null;
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i + 0.5) * da;
      const solid = i < n && !open(r * Math.cos(a), r * Math.sin(a));
      if (solid && start === null) start = i;
      if (!solid && start !== null) {
        runs.push({ r0, r1, a0: a0 + start * da, a1: a0 + i * da });
        start = null;
      }
    }
  }
  const look = room.marscreteFill?.includes(floor) ? "marscrete" : "rock";
  return { floor, look, frame, open, runs };
}
