import type { CommandResult, SimCommand } from "../sim/commands";
import type { SaveSummary } from "../sim/save";
import type { Snapshot } from "../sim/snapshot";

export type ToWorker =
  | { type: "setSpeed"; speed: number }
  | { type: "command"; id: number; command: SimCommand }
  | { type: "save"; id: number }
  | { type: "load"; id: number; data: string }
  | { type: "newGame"; id: number };

/**
 * The layout and effect field change rarely, so the worker only sends them
 * when layout.version moves (or a new game starts); the main thread keeps
 * the last ones it got.
 */
export type WireSnapshot = Omit<Snapshot, "layout" | "effects"> & {
  layoutVersion: number;
  layout?: Snapshot["layout"];
  effects?: Snapshot["effects"];
};

export type FromWorker =
  | { type: "snapshot"; snapshot: WireSnapshot; speed: number }
  | { type: "commandResult"; id: number; result: CommandResult }
  | { type: "saved"; id: number; data: string; summary: SaveSummary }
  | { type: "loaded"; id: number; result: CommandResult };
