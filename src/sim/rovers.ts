import type { CommandResult } from "./commands";
import type { SimConfig } from "./config";
import { isActive } from "./economy";
import { travelTicks } from "./founding";
import { record } from "./ledger";
import { resourceDef, resourceDefs } from "./resources";
import { roomDef } from "./rooms";
import type { SimState } from "./state";
import { holeById, type World } from "./world";

// Trade routes: one rover shuttling one resource from one hole to another.
// Each loop it loads what it can (up to the amount per trip), drives there,
// unloads, and drives back.

export type RoverPhase = "loading" | "outbound" | "returning";

export interface Route {
  id: number;
  fromHoleId: number;
  toHoleId: number;
  resource: string;
  amountPerTrip: number;
  phase: RoverPhase;
  /** When the current leg ends. */
  legEndTick: number;
  legStartTick: number;
  cargo: number;
}

/** What rovers can carry: stored goods, not flows (power) or waste. */
export function tradeable(id: string): boolean {
  const def = resourceDefs.find((r) => r.id === id);
  return !!def && !def.flow && !def.waste;
}

export const TRADEABLE = resourceDefs.filter((r) => tradeable(r.id)).map((r) => r.id);

export function roversAt(hole: SimState): number {
  return hole.layout.rooms.filter(isActive).reduce((n, r) => n + (roomDef(r.type).rovers ?? 0), 0);
}

export function routesFrom(world: World, holeId: number): Route[] {
  return world.routes.filter((r) => r.fromHoleId === holeId);
}

export function addRoute(world: World, fromHoleId: number, toHoleId: number, resource: string, amountPerTrip: number): CommandResult {
  const from = holeById(world, fromHoleId);
  const to = holeById(world, toHoleId);
  if (!from || !to) return { ok: false, reason: "No such hole" };
  if (from === to) return { ok: false, reason: "A route needs two different holes" };
  if (!from.site || !to.site) return { ok: false, reason: "Both holes need a place on the map" };
  if (!tradeable(resource)) return { ok: false, reason: `Rovers can't carry ${resource}` };
  if (!(amountPerTrip > 0)) return { ok: false, reason: "Carry something on each trip" };
  if (routesFrom(world, fromHoleId).length >= roversAt(from)) {
    return { ok: false, reason: `${from.name} has no free rover: build a rover depot (2 rovers each)` };
  }
  world.routes.push({
    id: world.nextRouteId++,
    fromHoleId,
    toHoleId,
    resource,
    amountPerTrip,
    phase: "loading",
    legStartTick: world.tick,
    legEndTick: world.tick,
    cargo: 0,
  });
  return { ok: true };
}

export function removeRoute(world: World, routeId: number): CommandResult {
  const route = world.routes.find((r) => r.id === routeId);
  if (!route) return { ok: false, reason: "No such route" };
  // A rover on the road finishes its delivery as a courtesy: the cargo arrives.
  if (route.phase === "outbound") {
    const to = holeById(world, route.toHoleId);
    if (to) to.resources[route.resource] = (to.resources[route.resource] ?? 0) + route.cargo;
  }
  world.routes = world.routes.filter((r) => r !== route);
  return { ok: true };
}

/** A small nudge to how much gets loaded, from how the two holes feel (step 8 fills this in). */
export type LoadFactor = (from: SimState, to: SimState) => number;

export function stepRoutes(world: World, cfg: SimConfig, loadFactor: LoadFactor = () => 1): void {
  for (const route of world.routes) {
    const from = holeById(world, route.fromHoleId);
    const to = holeById(world, route.toHoleId);
    if (!from || !to || !from.site || !to.site) continue;
    if (world.tick < route.legEndTick) continue;
    const legTicks = travelTicks(from.site, to.site, cfg);

    if (route.phase === "returning") {
      route.phase = "loading";
      route.legStartTick = world.tick;
      route.legEndTick = world.tick;
    }

    if (route.phase === "loading") {
      // Only as many routes run as the hole has rovers, oldest first.
      const mine = routesFrom(world, from.holeId);
      if (mine.indexOf(route) >= roversAt(from)) continue;
      const want = route.amountPerTrip * loadFactor(from, to);
      const load = Math.min(want, from.resources[route.resource] ?? 0);
      if (load < Math.min(1, want)) continue; // wait for goods
      from.resources[route.resource] = (from.resources[route.resource] ?? 0) - load;
      record(from, route.resource, "out", `Rover to ${to.name}`, load);
      route.cargo = load;
      route.phase = "outbound";
      route.legStartTick = world.tick;
      route.legEndTick = world.tick + legTicks;
    } else if (route.phase === "outbound") {
      // Anything past the destination's storage is lost as overflow by the economy, like an Earth drop.
      to.resources[route.resource] = (to.resources[route.resource] ?? 0) + route.cargo;
      record(to, route.resource, "in", `Rover from ${from.name}`, route.cargo);
      route.cargo = 0;
      route.phase = "returning";
      route.legStartTick = world.tick;
      route.legEndTick = world.tick + legTicks;
    }
  }
}

export const resourceName = (id: string) => resourceDef(id).name;
