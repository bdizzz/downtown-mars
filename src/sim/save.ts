import type { SimConfig } from "./config";
import { refreshEffects } from "./effects";
import { isRoomType } from "./rooms";
import type { SimState } from "./state";

// Saves are the whole sim state as JSON, minus what can be rebuilt (the
// effect field). The version guards against loading a save whose shape this
// build doesn't understand; bump it whenever SimState changes shape.

export const SAVE_VERSION = 1;

export interface SaveSummary {
  day: number;
  population: number;
  floors: number;
}

interface SaveFile {
  game: "downtown-mars";
  version: number;
  state: Omit<SimState, "effects">;
}

export function summarize(state: SimState, cfg: SimConfig): SaveSummary {
  return {
    day: Math.floor(state.tick / cfg.ticksPerDay) + 1,
    population: state.population.count,
    floors: state.layout.hole.floors,
  };
}

export function serialize(state: SimState): string {
  const { effects: _, ...rest } = state;
  const file: SaveFile = { game: "downtown-mars", version: SAVE_VERSION, state: rest };
  return JSON.stringify(file);
}

export type LoadResult = { ok: true; state: SimState } | { ok: false; reason: string };

export function deserialize(json: string): LoadResult {
  let file: Partial<SaveFile>;
  try {
    file = JSON.parse(json) as Partial<SaveFile>;
  } catch {
    return { ok: false, reason: "That file isn't a save: it isn't valid JSON." };
  }
  if (file.game !== "downtown-mars" || !file.state) return { ok: false, reason: "That file isn't a Downtown Mars save." };
  if (file.version !== SAVE_VERSION) {
    return { ok: false, reason: `That save is from a different version (save v${file.version}, game v${SAVE_VERSION}).` };
  }
  const unknown = file.state.layout?.rooms.find((r) => !isRoomType(r.type));
  if (unknown) return { ok: false, reason: `That save has a room this version doesn't know: "${unknown.type}".` };
  const layout = file.state.layout!;
  return { ok: true, state: { ...file.state, effects: refreshEffects(layout, null) } as SimState };
}
