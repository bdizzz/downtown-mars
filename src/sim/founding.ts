import type { CommandResult } from "./commands";
import type { SimConfig } from "./config";
import { isActive } from "./economy";
import { record } from "./ledger";

/** The ledger label for goods going into, and arriving with, a seed kit. */
export const SEED_KIT = "Seed kit";
import { degreesApart, depositsAt, distanceKm } from "./mapgeo";
import { postMessage } from "./messages";
import { network } from "./network";
import { createNotables } from "./notables";
import { capacities } from "./economy";
import { roomDef } from "./rooms";
import { createInitialState, type Site, type SimState } from "./state";
import { holeById, holeSeed, nextHoleName, type World } from "./world";

// Founding new holes: a staging bay gathers a seed kit from its hole's
// stores; when it's full, the kit and a band of volunteers set off by convoy
// for a site on the map, and a new hole is founded where they arrive.

export interface Convoy {
  id: number;
  fromHoleId: number;
  name: string;
  site: Site;
  departTick: number;
  arriveTick: number;
  goods: Record<string, number>;
  volunteers: number;
}

const kitCfg = () => network.seedKit;

/** How full the seed kit is, 0..1, averaged over its goods. */
export function kitProgress(hole: SimState): number {
  const goods = Object.entries(kitCfg().goods);
  return goods.reduce((sum, [id, want]) => sum + Math.min(1, (hole.kit?.[id] ?? 0) / want), 0) / goods.length;
}

export function hasStagingBay(hole: SimState): boolean {
  return hole.layout.rooms.some((r) => roomDef(r.type).stagesSeedKit && isActive(r));
}

/** A staffed staging bay moves goods from the hole's stores into the kit, keeping a reserve. */
export function stepStaging(hole: SimState, cfg: SimConfig): void {
  const bays = hole.layout.rooms.filter((r) => roomDef(r.type).stagesSeedKit && isActive(r));
  if (!bays.length) return;
  const rate = Math.min(1, bays.reduce((s, b) => s + (hole.roomStatus[b.id]?.rate ?? 0), 0));
  if (rate <= 0) return;
  const k = kitCfg();
  hole.kit ??= {};
  for (const [id, want] of Object.entries(k.goods)) {
    const have = hole.kit[id] ?? 0;
    if (have >= want) continue;
    const perTick = (want / (k.fillDays * cfg.ticksPerDay)) * rate;
    const spare = Math.max(0, (hole.resources[id] ?? 0) - want * k.reserveFraction);
    const take = Math.min(want - have, perTick, spare);
    if (take <= 0) continue;
    hole.resources[id] = (hole.resources[id] ?? 0) - take;
    hole.kit[id] = have + take;
    record(hole, id, "out", SEED_KIT, take);
  }
}

/** Why a hole can't found a new one at this site right now, or null if it can. */
export function foundingRefusal(world: World, from: SimState, site: Site): string | null {
  const k = kitCfg();
  if (!world.mapUnlocked) return `The map opens at ${network.mapUnlockPopulation} colonists`;
  if (!hasStagingBay(from)) return `${from.name} needs a staging bay`;
  if (kitProgress(from) < 0.999) return `The seed kit is ${Math.floor(kitProgress(from) * 100)}% gathered`;
  if (from.population.count - k.volunteers < k.minStayBehind) {
    return `${from.name} needs ${k.volunteers + k.minStayBehind} colonists to send ${k.volunteers} and keep ${k.minStayBehind}`;
  }
  const taken = [...world.holes.flatMap((h) => (h.site ? [h.site] : [])), ...world.convoys.map((c) => c.site)];
  if (taken.some((s) => degreesApart(s, site) < k.minSpacingDeg)) return "Too close to a hole or a convoy's destination";
  return null;
}

export function travelTicks(from: Site, to: Site, cfg: SimConfig): number {
  return Math.max(1, Math.round((distanceKm(from, to) / network.roverKmPerDay) * cfg.ticksPerDay));
}

export function foundHole(world: World, cfg: SimConfig, fromHoleId: number, site: Site): CommandResult {
  const from = holeById(world, fromHoleId);
  if (!from) return { ok: false, reason: "No such hole" };
  const refusal = foundingRefusal(world, from, site);
  if (refusal) return { ok: false, reason: refusal };
  const k = kitCfg();
  const name = nextHoleName({ holes: [...world.holes, ...world.convoys.map((c) => ({ name: c.name }) as SimState)] });
  const convoy: Convoy = {
    id: world.nextHoleId++,
    fromHoleId,
    name,
    site,
    departTick: world.tick,
    arriveTick: world.tick + travelTicks(from.site ?? site, site, cfg),
    goods: { ...from.kit },
    volunteers: k.volunteers,
  };
  from.kit = {};
  from.population.count -= k.volunteers;
  world.convoys.push(convoy);
  const days = ((convoy.arriveTick - convoy.departTick) / cfg.ticksPerDay).toFixed(1);
  postMessage(from, cfg, `${k.volunteers} volunteers set off to found ${name}: ${days} days by convoy.`, "good");
  return { ok: true };
}

/** Convoys that have arrived become holes. */
export function stepConvoys(world: World, cfg: SimConfig): void {
  for (const c of world.convoys.filter((x) => world.tick >= x.arriveTick)) {
    const hole = createInitialState(cfg, {
      holeId: c.id,
      name: c.name,
      site: c.site,
      deposits: depositsAt(world.map, c.site),
      seed: holeSeed(world.seed, c.id),
    });
    hole.tick = world.tick;
    // They start with what they brought, not Earth's starter stock.
    hole.resources = {};
    const caps = capacities(hole, cfg);
    for (const [id, v] of Object.entries(c.goods)) {
      hole.resources[id] = Math.min(v, caps[id] ?? v);
      record(hole, id, "in", SEED_KIT, hole.resources[id]!);
    }
    hole.population.count = c.volunteers;
    hole.notables = [];
    createNotables(hole);
    hole.earth.nextDropTick = world.tick + hole.earth.nextDropTick;
    world.holes.push(hole);
    const parent = holeById(world, c.fromHoleId);
    const msg = `The convoy reached ${c.name}. A new hole is founded, ${Math.round(distanceKm(parent?.site ?? c.site, c.site)).toLocaleString()} km from ${parent?.name ?? "home"}.`;
    postMessage(hole, cfg, msg, "good");
    if (parent) postMessage(parent, cfg, msg, "good");
  }
  world.convoys = world.convoys.filter((x) => world.tick < x.arriveTick);
}
