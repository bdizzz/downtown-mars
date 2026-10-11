// The 3D view's cameras and its see-through toggles: chosen from the
// View mode's buttons, kept in the player's settings, and applied by the 3D
// stage. No Three.js here, so the UI can list them.

/** Free view keeps its old id, "iso", so saves and the bridge needn't change. */
export type Camera = "iso" | "cutaway" | "walk";

export const CAMERAS: { id: Camera; name: string; hint: string }[] = [
  { id: "iso", name: "Free view", hint: "One floor from above and off to one side, so you see all of it (pick the floor on the right; drag to turn, scroll to zoom)" },
  { id: "cutaway", name: "Cutaway", hint: "Look at the hole from outside, sliced open" },
  { id: "walk", name: "First person", hint: "Walk the galleries, corridors and public spaces: WASD to move, Q and E to turn, drag to look (Tab for mouse look), R and F to take stairs up or down" },
];

export interface View3d {
  camera: Camera;
  /** Walls between the camera and the rooms behind them lowered to a stub, as in The Sims. */
  wallsDown: boolean;
  /** Rooms in their category's colour (on), or in the material they're built from: rock, marscrete, brick, metal (off). */
  roomColors: boolean;
  /** Resource networks drawn as pipes: power, water, air and food, flowing from what makes them to what uses them. */
  flows: boolean;
  /** Cutaway: how wide a wedge the cut takes out of the hole, in degrees, centred on the camera: 180 slices it flat through the axis. */
  cutAngle: number;
}

/** The cutaway's wedge: from a quarter-and-a-bit (60°) to a flat cut (180°), in steps of `step` for the keys. */
export const CUT_ANGLE = { min: 60, max: 180, step: 15 };

/** A cut angle in range, whole degrees; anything that isn't a number is a flat cut. */
export function clampCutAngle(deg: unknown): number {
  return typeof deg === "number" && Number.isFinite(deg) ? Math.round(Math.min(CUT_ANGLE.max, Math.max(CUT_ANGLE.min, deg))) : CUT_ANGLE.max;
}

export const DEFAULT_VIEW3D: View3d = { camera: "iso", wallsDown: false, roomColors: true, flows: false, cutAngle: CUT_ANGLE.max };

export function isCamera(id: unknown): id is Camera {
  return CAMERAS.some((c) => c.id === id);
}
