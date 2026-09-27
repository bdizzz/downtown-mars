import type { CommandResult, SimCommand } from "../sim/commands";
import type { Snapshot } from "../sim/snapshot";

export type ToWorker =
  | { type: "setSpeed"; speed: number }
  | { type: "command"; id: number; command: SimCommand };

export type FromWorker =
  | { type: "snapshot"; snapshot: Snapshot; speed: number }
  | { type: "commandResult"; id: number; result: CommandResult };
