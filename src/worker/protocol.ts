import type { CommandResult, SimCommand } from "../sim/commands";
import type { SaveSummary } from "../sim/save";
import type { Snapshot } from "../sim/snapshot";

export type ToWorker =
  | { type: "setSpeed"; speed: number }
  /** Testing: run the world ahead so many days at once (the console's dm.skip). */
  | { type: "advance"; id: number; days: number }
  | { type: "command"; id: number; command: SimCommand }
  | { type: "save"; id: number }
  | { type: "load"; id: number; data: string }
  | { type: "newGame"; id: number }
  | { type: "setActiveHole"; holeId: number }
  | { type: "found"; id: number; site: { lat: number; lon: number } }
  | { type: "route"; id: number; action: RouteAction };

export type RouteAction =
  | { kind: "add"; fromHoleId: number; toHoleId: number; resource: string; amountPerTrip: number }
  | { kind: "remove"; routeId: number };

/**
 * The layout and effect field change rarely, so the worker only sends them
 * when layout.version moves (or a new game starts); the main thread keeps
 * the last ones it got. History is the same: it comes with each new sample.
 */
export type WireSnapshot = Omit<Snapshot, "layout" | "effects" | "history"> & {
  layoutVersion: number;
  layout?: Snapshot["layout"];
  effects?: Snapshot["effects"];
  /** Only when there's a new sample (or another hole or game): the main thread keeps the last. */
  history?: Snapshot["history"];
};

export type FromWorker =
  | { type: "snapshot"; snapshot: WireSnapshot; speed: number }
  | { type: "commandResult"; id: number; result: CommandResult }
  | { type: "saved"; id: number; data: string; summary: SaveSummary }
  | { type: "loaded"; id: number; result: CommandResult };
