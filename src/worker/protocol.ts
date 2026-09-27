import type { CommandResult, SimCommand } from "../sim/commands";
import type { Snapshot } from "../sim/snapshot";

export type ToWorker =
  | { type: "setSpeed"; speed: number }
  | { type: "command"; id: number; command: SimCommand };

/**
 * The layout and effect field change rarely, so the worker only sends them
 * when layout.version moves; the main thread keeps the last ones it got.
 */
export type WireSnapshot = Omit<Snapshot, "layout" | "effects"> & {
  layoutVersion: number;
  layout?: Snapshot["layout"];
  effects?: Snapshot["effects"];
};

export type FromWorker =
  | { type: "snapshot"; snapshot: WireSnapshot; speed: number }
  | { type: "commandResult"; id: number; result: CommandResult };
