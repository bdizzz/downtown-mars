import raw from "../../data/network.json";
import type { SimConfig } from "./config";
import { createInitialState, type SimState } from "./state";
import { step } from "./step";

// The world: shared time and every hole. Each hole is a SimState that the
// existing systems run on unchanged; things that happen between holes
// (founding, rovers, opinion) live here.

export interface World {
  tick: number;
  holes: SimState[];
  nextHoleId: number;
}

export const network = raw as { holeNames: string[] };

/** A hole's random stream: the game seed for the first hole, mixed with the id for the rest. */
export function holeSeed(cfg: SimConfig, holeId: number): number {
  return holeId === 1 ? cfg.seed >>> 0 : (Math.imul(cfg.seed ^ 0x9e3779b9, holeId * 2654435761) >>> 0) || 1;
}

/** Names come from the list in order, skipping any already used. */
export function nextHoleName(world: Pick<World, "holes">): string {
  const used = new Set(world.holes.map((h) => h.name));
  return network.holeNames.find((n) => !used.has(n)) ?? `Hole ${world.holes.length + 1}`;
}

export function createWorld(cfg: SimConfig): World {
  const first = createInitialState(cfg, { holeId: 1, name: network.holeNames[0]!, site: null, seed: holeSeed(cfg, 1) });
  return { tick: 0, holes: [first], nextHoleId: 2 };
}

export function holeById(world: World, id: number): SimState | undefined {
  return world.holes.find((h) => h.holeId === id);
}

/** Advance every hole one tick, in id order, so the world stays deterministic. */
export function stepWorld(world: World, cfg: SimConfig): void {
  world.tick += 1;
  for (const hole of world.holes) step(hole, cfg);
}
