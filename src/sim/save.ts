import type { SimConfig } from "./config";
import { refreshEffects } from "./effects";
import { createLedger } from "./ledger";
import { isRoomType } from "./rooms";
import type { SimState } from "./state";
import { network, type World } from "./world";

// Saves are the whole world as JSON, minus what can be rebuilt (each hole's
// effect field). Bump the version whenever the shape changes, and add a
// migration from the previous version so old saves keep working.

export const SAVE_VERSION = 3;

type Raw = Record<string, unknown>;

/** MIGRATIONS[n] upgrades a version-n save's state to version n + 1. */
const MIGRATIONS: Record<number, (s: Raw) => Raw> = {
  // v2 added the flow ledger (to what was then a single hole).
  1: (s) => ({ ...s, ledger: createLedger() }),
  // v3 put holes in a world; an old save becomes a world of one.
  2: (s) => ({
    tick: s.tick,
    holes: [{ ...s, holeId: 1, name: network.holeNames[0], site: null }],
    nextHoleId: 2,
  }),
};

export interface SaveSummary {
  day: number;
  /** Everyone, in every hole. */
  population: number;
  /** Deepest hole. */
  floors: number;
  holes: number;
}

type StoredHole = Omit<SimState, "effects">;
interface SaveFile {
  game: "downtown-mars";
  version: number;
  state: Omit<World, "holes"> & { holes: StoredHole[] };
}

export function summarize(world: World, cfg: SimConfig): SaveSummary {
  return {
    day: Math.floor(world.tick / cfg.ticksPerDay) + 1,
    population: world.holes.reduce((n, h) => n + h.population.count, 0),
    floors: Math.max(...world.holes.map((h) => h.layout.hole.floors)),
    holes: world.holes.length,
  };
}

export function serialize(world: World): string {
  const holes = world.holes.map(({ effects: _, ...rest }) => rest);
  const file: SaveFile = { game: "downtown-mars", version: SAVE_VERSION, state: { ...world, holes } };
  return JSON.stringify(file);
}

export type LoadResult = { ok: true; world: World } | { ok: false; reason: string };

export function deserialize(json: string): LoadResult {
  let file: Partial<SaveFile>;
  try {
    file = JSON.parse(json) as Partial<SaveFile>;
  } catch {
    return { ok: false, reason: "That file isn't a save: it isn't valid JSON." };
  }
  if (file.game !== "downtown-mars" || !file.state) return { ok: false, reason: "That file isn't a Downtown Mars save." };
  let version = file.version ?? 0;
  let raw = file.state as unknown as Raw;
  while (version < SAVE_VERSION && MIGRATIONS[version]) raw = MIGRATIONS[version++]!(raw);
  if (version !== SAVE_VERSION) {
    return { ok: false, reason: `That save is from a different version (save v${file.version}, game v${SAVE_VERSION}).` };
  }
  const state = raw as unknown as SaveFile["state"];
  for (const hole of state.holes ?? []) {
    const unknown = hole.layout?.rooms.find((r) => !isRoomType(r.type));
    if (unknown) return { ok: false, reason: `That save has a room this version doesn't know: "${unknown.type}".` };
  }
  const holes = state.holes.map((h) => ({ ...h, effects: refreshEffects(h.layout, null) }) as SimState);
  return { ok: true, world: { ...state, holes } };
}
