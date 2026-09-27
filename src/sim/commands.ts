import { demolishRoom, placeRoom, type Location } from "./placement";
import type { SimState } from "./state";

export type SimCommand =
  | { type: "build"; room: string; at: Location }
  | { type: "demolish"; roomId: number }
  | { type: "setDrill"; active: boolean };

export type CommandResult = { ok: true } | { ok: false; reason: string };

export function applyCommand(state: SimState, cmd: SimCommand): CommandResult {
  switch (cmd.type) {
    case "build": {
      const r = placeRoom(state.layout, cmd.room, cmd.at);
      return r.ok ? { ok: true } : { ok: false, reason: r.reason };
    }
    case "demolish":
      return demolishRoom(state.layout, cmd.roomId);
    case "setDrill":
      state.drill.active = cmd.active;
      return { ok: true };
  }
}
