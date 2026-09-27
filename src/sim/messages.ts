import type { SimConfig } from "./config";
import type { SimState } from "./state";

export interface Message {
  tick: number;
  text: string;
  kind: "info" | "good" | "warn";
}

export function postMessage(state: SimState, cfg: SimConfig, text: string, kind: Message["kind"] = "info"): void {
  state.messages.push({ tick: state.tick, text, kind });
  if (state.messages.length > cfg.messages.keep) state.messages.shift();
}
