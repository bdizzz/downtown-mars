import type { Layout, RoomInstance } from "../sim/placement";
import { roomDef } from "../sim/rooms";
import { frameOf, furnish, type Frame } from "./furnish";
import { itemDef } from "./furniture";

// A lift is a solid core (#565): round its shaft the room is filled in, rock
// where it was dug from rock, marscrete where it was built over dug-out space,
// all but a landing in front of the car's doors and a passage from the room's
// door to it. The 3D view draws the fill; walking treats it as solid. Both read
// it from here, so they agree.

/** The hollow's sizes, metres: round the shaft, the landing in front of it, and the passage's half width. */
export const LIFT_FILL = { margin: 0.1, landing: { depth: 1.7, half: 2.0 }, passage: 1.0, step: 0.25 };

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
  /** Is this point (x, z) open: the shaft, its landing or the passage to the door? */
  open: (x: number, z: number) => boolean;
  /** The fill, as ring-sector runs. */
  runs: FillRun[];
}

/** Does this room have a fill round its shaft? A passenger lift, once built (a cargo elevator's stop is a loading bay). */
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
  const { margin, landing, passage, step } = LIFT_FILL;
  // The shaft as furnished on this floor (its car at the bottom): where it stands and which way its doors face.
  const shaft = furnish(layout, room).find((f) => f.floor === floor && (f.item === "elevator_shaft" || f.item === "elevator_car"));
  const rMid = (frame.rIn + frame.rOut) / 2;
  const aMid = (frame.left(rMid) + frame.right(rMid)) / 2;
  const cx = shaft?.x ?? rMid * Math.cos(aMid);
  const cz = shaft?.z ?? rMid * Math.sin(aMid);
  const turn = shaft?.turn ?? Math.atan2(-Math.cos(aMid), -Math.sin(aMid));
  // The shaft's own axes: Z out of its doors, X across them.
  const Z: [number, number] = [Math.sin(turn), Math.cos(turn)];
  const X: [number, number] = [Math.cos(turn), -Math.sin(turn)];
  const [w, d] = shaft ? itemDef(shaft.item).size : [0, 0];
  const toLocal = (x: number, z: number): [number, number] => [(x - cx) * X[0] + (z - cz) * X[1], (x - cx) * Z[0] + (z - cz) * Z[1]];
  const inShaft = (u: number, v: number) => Math.abs(u) <= w / 2 + margin && Math.abs(v) <= d / 2 + margin;
  const front = d / 2;
  const inLanding = (u: number, v: number) => Math.abs(u) <= landing.half && v >= front - margin && v <= front + landing.depth;
  // From the landing's middle to each door, and on past it through the wall.
  const mid: [number, number] = [cx + Z[0] * (front + landing.depth / 2), cz + Z[1] * (front + landing.depth / 2)];
  const doors = frame.doors.map((corners): [[number, number], [number, number]] => {
    const p: [number, number] = [corners.reduce((s, c) => s + c[0], 0) / corners.length, corners.reduce((s, c) => s + c[1], 0) / corners.length];
    const len = Math.hypot(p[0] - mid[0], p[1] - mid[1]) || 1;
    const past = 2;
    return [mid, [p[0] + ((p[0] - mid[0]) / len) * past, p[1] + ((p[1] - mid[1]) / len) * past]];
  });
  const open = (x: number, z: number): boolean => {
    const [u, v] = toLocal(x, z);
    if (inShaft(u, v) || inLanding(u, v)) return true;
    return doors.some(([a, b]) => toSegment(x, z, a, b) <= passage);
  };
  // Fill the floor in rings of `step`, each a run of sectors wherever it isn't open.
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

/** How far a point is from a segment. */
function toSegment(x: number, z: number, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - (a[0] + t * dx), z - (a[1] + t * dz));
}
