import { roomDef } from "../sim/rooms";
import type { Tool } from "../view/types";

/** Where the tool in hand builds: on the surface, underground (rooms below ground, corridors), or either (demolish, nothing). */
export type FloorWant = "surface" | "below" | null;

export function floorWant(tool: Tool): FloorWant {
  if (tool?.kind === "corridor") return "below";
  if (tool?.kind === "build") return roomDef(tool.room).size === "surface" ? "surface" : "below";
  return null;
}

/**
 * Where the view goes when a tool is picked up (#597): a surface room takes an underground view up to
 * the surface (null), an underground one takes the surface down to the last underground floor viewed
 * (floor 1 if none). Undefined: stay put. The plan view has no surface, so it never goes up.
 */
export function floorFor(want: FloorWant, floor: number | null, lastBelow: number | null, plan: boolean): number | null | undefined {
  if (want === "surface" && floor !== null && !plan) return null;
  if (want === "below" && floor === null) return lastBelow ?? 1;
  return undefined;
}
