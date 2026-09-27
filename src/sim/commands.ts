import { config } from "./config";
import { charge, checkBuild, CONSTRUCTION, refund } from "./costs";
import { record } from "./ledger";
import { refreshEffects } from "./effects";
import { demolishRoom, placeRoom, type Location } from "./placement";
import type { Priority } from "./config";
import { enact, repeal } from "./ordinances";
import { isCrop } from "./resources";
import { mainOutput } from "./economy";
import { holeGates } from "./people";
import { answerVisit } from "./visits";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

export type SimCommand =
  | { type: "build"; room: string; at: Location }
  | { type: "demolish"; roomId: number }
  | { type: "undoBuild"; roomId: number }
  | { type: "setDrill"; active: boolean }
  | { type: "setCrop"; roomId: number; crop: string }
  | { type: "setPriority"; roomId: number; priority: Priority }
  /** Pause a room, or have it stop while its main output is at or above stopAt (null clears it). */
  | { type: "setRoomControl"; roomId: number; paused?: boolean; stopAt?: number | null }
  | { type: "answerVisit"; visitId: number; choice: string }
  | { type: "setOrdinance"; id: string; enacted: boolean }
  /** Start or stop the staging bay gathering a seed kit. */
  | { type: "setGathering"; gathering: boolean };

/** roomId is set when a build succeeds, so the UI can offer undo. */
export type CommandResult = { ok: true; roomId?: number } | { ok: false; reason: string };

export function applyCommand(state: SimState, cmd: SimCommand): CommandResult {
  const result = apply(state, cmd);
  state.effects = refreshEffects(state.layout, state.effects);
  return result;
}

function apply(state: SimState, cmd: SimCommand): CommandResult {
  const layout = state.layout;
  switch (cmd.type) {
    case "build": {
      const check = checkBuild(layout, state.resources, cmd.room, cmd.at, config, holeGates(state));
      if (!check.ok) return { ok: false, reason: check.reason };
      const r = placeRoom(layout, cmd.room, cmd.at);
      if (!r.ok) return { ok: false, reason: r.reason };
      charge(state.resources, cmd.room);
      for (const [id, amt] of Object.entries(roomDef(cmd.room).cost)) record(state, id, "out", CONSTRUCTION, amt);
      layout.rooms.find((x) => x.id === r.id)!.builtTick = state.tick;
      return { ok: true, roomId: r.id! };
    }
    case "demolish": {
      const room = layout.rooms.find((r) => r.id === cmd.roomId);
      const result = demolishRoom(layout, cmd.roomId);
      // Blueprints were never built, so they refund in full.
      if (result.ok && room) refund(state.resources, room.type, room.planned ? 1 : config.economy.demolishRefund);
      return result;
    }
    case "undoBuild": {
      const room = layout.rooms.find((r) => r.id === cmd.roomId);
      if (!room) return { ok: false, reason: "Nothing to undo" };
      if (room.builtTick === undefined || state.tick - room.builtTick > config.economy.undoWindowTicks) {
        return { ok: false, reason: "Too late to undo: demolish it instead" };
      }
      const result = demolishRoom(layout, cmd.roomId);
      if (result.ok) refund(state.resources, room.type, 1);
      return result;
    }
    case "setDrill":
      state.drill.active = cmd.active;
      return { ok: true };
    case "setCrop": {
      const room = layout.rooms.find((r) => r.id === cmd.roomId);
      if (!room || !roomDef(room.type).growsCrops) return { ok: false, reason: "Only farms grow crops" };
      if (!isCrop(cmd.crop)) return { ok: false, reason: `Unknown crop "${cmd.crop}"` };
      room.crop = cmd.crop;
      layout.version++;
      return { ok: true };
    }
    case "answerVisit":
      return answerVisit(state, config, cmd.visitId, cmd.choice);
    case "setOrdinance":
      if (!cmd.enacted) {
        repeal(state, cmd.id);
        return { ok: true };
      }
      return enact(state, cmd.id);
    case "setPriority": {
      const room = layout.rooms.find((r) => r.id === cmd.roomId);
      if (!room) return { ok: false, reason: "No such room" };
      if (!config.economy.priorities.includes(cmd.priority)) return { ok: false, reason: "Unknown priority" };
      room.priority = cmd.priority;
      layout.version++;
      return { ok: true };
    }
    case "setGathering":
      if (cmd.gathering && !state.layout.rooms.some((r) => roomDef(r.type).stagesSeedKit && !r.planned)) {
        return { ok: false, reason: "Build a staging bay first" };
      }
      state.gatheringKit = cmd.gathering;
      return { ok: true };
    case "setRoomControl": {
      const room = layout.rooms.find((r) => r.id === cmd.roomId);
      if (!room) return { ok: false, reason: "No such room" };
      if (cmd.paused !== undefined) room.paused = cmd.paused || undefined;
      if (cmd.stopAt !== undefined) {
        if (cmd.stopAt === null) delete room.stopAt;
        else if (!mainOutput(room, config)) return { ok: false, reason: "This room doesn't make anything to stock" };
        else if (!(cmd.stopAt >= 0)) return { ok: false, reason: "Stop at a stock of zero or more" };
        else room.stopAt = cmd.stopAt;
      }
      layout.version++;
      return { ok: true };
    }
  }
}
