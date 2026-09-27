import { config } from "./config";
import { charge, checkBuild, refund } from "./costs";
import { demolishRoom, placeRoom, type Location } from "./placement";
import type { Priority } from "./config";
import { isCrop } from "./resources";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

export type SimCommand =
  | { type: "build"; room: string; at: Location }
  | { type: "demolish"; roomId: number }
  | { type: "setDrill"; active: boolean }
  | { type: "setCrop"; roomId: number; crop: string }
  | { type: "setPriority"; roomId: number; priority: Priority };

export type CommandResult = { ok: true } | { ok: false; reason: string };

export function applyCommand(state: SimState, cmd: SimCommand): CommandResult {
  const layout = state.layout;
  switch (cmd.type) {
    case "build": {
      const check = checkBuild(layout, state.resources, cmd.room, cmd.at);
      if (!check.ok) return { ok: false, reason: check.reason };
      const r = placeRoom(layout, cmd.room, cmd.at);
      if (!r.ok) return { ok: false, reason: r.reason };
      charge(state.resources, cmd.room);
      return { ok: true };
    }
    case "demolish": {
      const room = layout.rooms.find((r) => r.id === cmd.roomId);
      const result = demolishRoom(layout, cmd.roomId);
      // Blueprints were never built, so they refund in full.
      if (result.ok && room) refund(state.resources, room.type, room.planned ? 1 : config.economy.demolishRefund);
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
    case "setPriority": {
      const room = layout.rooms.find((r) => r.id === cmd.roomId);
      if (!room) return { ok: false, reason: "No such room" };
      if (!config.economy.priorities.includes(cmd.priority)) return { ok: false, reason: "Unknown priority" };
      room.priority = cmd.priority;
      layout.version++;
      return { ok: true };
    }
  }
}
