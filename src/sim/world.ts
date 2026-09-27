import type { SimConfig } from "./config";
import { chooseFirstSite, depositsAt, generateMap, type MapState } from "./map";
import type { Convoy } from "./founding";
import type { Message } from "./messages";
import type { Route } from "./rovers";
import type { Relation } from "./culture";
import { network } from "./network";
import { createInitialState, type SimState } from "./state";

// The world: shared time and every hole. Each hole is a SimState that the
// existing systems run on unchanged; things that happen between holes
// (founding, rovers, opinion) live here.

export interface World {
  /** Every random thing in the game derives from this. */
  seed: number;
  tick: number;
  holes: SimState[];
  nextHoleId: number;
  map: MapState;
  /** The whole map is known once the network is big enough to reach for it. */
  mapUnlocked: boolean;
  /** Founding convoys on their way to new sites. */
  convoys: Convoy[];
  routes: Route[];
  nextRouteId: number;
  /** How each hole sees each other hole, keyed "from>to". */
  relations: Record<string, Relation>;
}

export { network };

/** A hole's random stream: the game seed for the first hole, mixed with the id for the rest. */
export function holeSeed(seed: number, holeId: number): number {
  return holeId === 1 ? seed >>> 0 : (Math.imul(seed ^ 0x9e3779b9, holeId * 2654435761) >>> 0) || 1;
}

/** Names come from the list in order, skipping any already used. */
export function nextHoleName(world: Pick<World, "holes">): string {
  const used = new Set(world.holes.map((h) => h.name));
  return network.holeNames.find((n) => !used.has(n)) ?? `Hole ${world.holes.length + 1}`;
}

export function createWorld(cfg: SimConfig, seed = cfg.seed): World {
  const map = generateMap(seed);
  const site = chooseFirstSite(map, seed);
  const first = createInitialState(cfg, {
    holeId: 1,
    name: network.holeNames[0]!,
    site,
    deposits: depositsAt(map, site),
    seed: holeSeed(seed, 1),
  });
  return { seed, tick: 0, holes: [first], nextHoleId: 2, map, mapUnlocked: false, convoys: [], routes: [], nextRouteId: 1, relations: {} };
}

export function totalPopulation(world: World): number {
  return world.holes.reduce((n, h) => n + h.population.count, 0);
}

export function holeById(world: World, id: number): SimState | undefined {
  return world.holes.find((h) => h.holeId === id);
}

/** Every hole's recent messages in one feed, newest last, each tagged with its hole. */
export function networkMessages(world: World, keep: number): Message[] {
  return world.holes
    .flatMap((h) => h.messages.map((m) => ({ ...m, holeId: h.holeId, holeName: h.name })))
    .sort((a, b) => a.tick - b.tick || (a.holeId ?? 0) - (b.holeId ?? 0))
    .slice(-keep);
}
