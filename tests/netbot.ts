import { airPct } from "../src/sim/air";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { relation, tier } from "../src/sim/culture";
import { foundHole, kitProgress } from "../src/sim/founding";
import { degreesApart, type DepositKind } from "../src/sim/mapgeo";
import { network } from "../src/sim/network";
import type { Location } from "../src/sim/placement";
import { addRoute } from "../src/sim/rovers";
import type { SimState } from "../src/sim/state";
import { createWorld, type World } from "../src/sim/world";
import { stepWorld } from "../src/sim/worldstep";
import { ensureStairs, quarry, adapt, tendStorage, tendUpkeep, tendWindows, tendEvents } from "./adaptive";
import { PLAN, VISIT_ANSWERS } from "./bot";
import { beds } from "../src/sim/earth";
import { stageCounts } from "../src/sim/people";

// A scripted player for the first hour (60 game days) across two holes:
// the first hole follows the one-hole bot, then, once the map opens, builds a
// staging bay and a rover depot, founds a second hole on a deposit the first
// lacks, builds that hole's critical set, and runs rovers both ways. Past
// their opening plans, both holes build whatever is short (adaptive.ts).

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
const surface = (slot: number): Location => ({ kind: "surface", slot });
type Plan = { room: string; at: Location; crop?: string; stopAt?: number };

/** Once the map opens: industry for the kit, then get ready to found and trade. */
export const HOME_EXTRA: Plan[] = [
  { room: "smelter", at: ring(5, 1, 4, 4) },
  { room: "machine_shop", at: ring(5, 2, 7, 2), stopAt: 12 },
  { room: "staging_bay", at: ring(5, 1, 0, 4) },
  { room: "rover_depot", at: surface(9) },
];

/** The child: the critical set, then its own rovers and food. */
export const CHILD_PLAN: Plan[] = [
  { room: "galley", at: ring(1, 1, 2) },
  { room: "restroom", at: ring(1, 1, 3) },
  { room: "rover_depot", at: surface(9) },
  { room: "water_tank", at: ring(1, 1, 6) },
  { room: "life_support", at: ring(1, 2, 3, 4) },
  { room: "site_office", at: ring(1, 1, 1) },
  { room: "solar_array", at: surface(5) },
  { room: "farm", at: ring(2, 1, 0, 4), crop: "potatoes" },
  { room: "bunk_dorm", at: ring(1, 1, 4, 2) },
  { room: "clinic", at: ring(1, 1, 7) },
];

/** Goods a hole can't easily make early on: saved for the seed kit while it's gathered. */
const SCARCE = ["metal", "machinery", "electronics"];

/** Routes to set up once both holes have rovers: [from, to, resource, per trip]. */
const HOME_ROUTES: [string, number][] = [["metal", 20]];

export interface NetDay {
  day: number;
  pops: string;
  total: number;
  kit: number;
  kitShort: string;
  routes: number;
  /** Goods rovers brought the child, and home, so far. */
  delivered: number;
  deliveredHome: number;
  opinions: string;
  /** % of the child hole's air. */
  childO2: number;
  childWater: number;
  childFood: number;
  childHealth: number;
  childHappy: number;
  homeHappy: number;
  /** Children/adults/elders per hole. */
  stages: string;
  born: number;
  beds: string;
}

/** Builds a plan strictly in order, except that rooms not yet unlocked wait without holding up the rest. */
function builder(plan: Plan[]) {
  const pending = plan.map((p, i) => ({ ...p, i }));
  const builtAt: number[] = [];
  return {
    get done() {
      return plan.length - pending.length;
    },
    builtAt,
    step(hole: SimState, day: number) {
      for (let k = 0; k < pending.length; ) {
        const p = pending[k]!;
        const r = applyCommand(hole, { type: "build", room: p.room, at: p.at });
        if (!r.ok) {
          // Short of rock: dig some out while waiting.
          if (/more rock/.test(r.reason)) quarry(hole);
          if (r.reason.startsWith("Unlocks with")) {
            k++;
            continue;
          }
          break;
        }
        if (p.crop) applyCommand(hole, { type: "setCrop", roomId: r.roomId!, crop: p.crop });
        if (p.stopAt !== undefined) applyCommand(hole, { type: "setRoomControl", roomId: r.roomId!, stopAt: p.stopAt });
        applyCommand(hole, { type: "connectRoom", roomId: r.roomId!, finish: "rock" });
        builtAt.push(day);
        pending.splice(k, 1);
      }
    },
  };
}

/** Carve corridors to anything still cut off. */
/** Once a day: storage kept ahead of the goods. */
function tend(hole: SimState, t: number): void {
  if (t % config.ticksPerDay === 0) {
    tendStorage(hole);
    tendUpkeep(hole);
    tendWindows(hole);
    tendEvents(hole);
  }
}

function reconnect(hole: SimState): void {
  for (const r of hole.layout.rooms) if (!r.connected && !r.planned) applyCommand(hole, { type: "connectRoom", roomId: r.id, finish: "rock" });
}

function answerVisits(hole: SimState): void {
  for (const v of [...hole.office.waiting]) {
    const choice = VISIT_ANSWERS[v.kind];
    if (choice && !applyCommand(hole, { type: "answerVisit", visitId: v.id, choice }).ok) {
      applyCommand(hole, { type: "answerVisit", visitId: v.id, choice: "promise" });
    }
  }
}

/** The nearest deposit of something the home hole lacks (silica first), far enough away to found on; else the nearest of anything. */
export function pickSite(world: World, home: SimState): { lat: number; lon: number } {
  const lacks = (["silica", "ore", "aquifer"] as DepositKind[]).filter((k) => !home.deposits.includes(k));
  for (const kind of lacks) {
    const d = world.map.deposits
      .filter((x) => x.kind === kind && degreesApart(x, home.site!) >= network.seedKit.minSpacingDeg)
      .sort((x, y) => degreesApart(x, home.site!) - degreesApart(y, home.site!))[0];
    if (d) return { lat: d.lat, lon: d.lon };
  }
  // The home hole has them all (the drill struck them): the nearest deposit of anything, far enough away.
  const any = world.map.deposits
    .filter((x) => degreesApart(x, home.site!) >= network.seedKit.minSpacingDeg)
    .sort((x, y) => degreesApart(x, home.site!) - degreesApart(y, home.site!))[0];
  if (any) return { lat: any.lat, lon: any.lon };
  throw new Error("nowhere to found");
}

/** What the child sends home: whatever digging brings up at its site. */
function childExport(child: SimState): string {
  return child.deposits.includes("silica") ? "silica" : child.deposits.includes("ore") ? "ore" : "water";
}

export function runNetwork(days: number, seed = config.seed, found = true) {
  const world = createWorld(config, seed);
  const home = world.holes[0]!;
  const homePlan = builder(PLAN);
  // A player gets ready to found as soon as the map opens, alongside the rest.
  const netPlan = builder(HOME_EXTRA);
  const childPlan = builder(CHILD_PLAN);
  const adapted: string[] = [];
  const log: NetDay[] = [];
  const events: string[] = [];
  let foundedDay: number | null = null;
  const routesSet = { home: false, child: false };
  let delivered = 0;
  let deliveredHome = 0;

  for (let t = 0; t < days * config.ticksPerDay; t++) {
    const day = world.tick / config.ticksPerDay;
    if (t % 10 === 0) {
      if (world.mapUnlocked) netPlan.step(home, day);
      if (foundedDay === null && !home.gatheringKit && kitProgress(home) < 0.999) {
        applyCommand(home, { type: "setGathering", gathering: true });
      }
      // Saving metal for the kit: the machine shop waits (once there's a little machinery in hand), and starts again after.
      const shortMetal = home.gatheringKit && (home.kit.metal ?? 0) < (network.seedKit.goods.metal ?? 0) - 1e-6;
      for (const r of home.layout.rooms.filter((x) => x.type === "machine_shop" && !x.building)) {
        const pause = shortMetal && (home.resources.machinery ?? 0) >= 6;
        if (!!r.paused !== pause) applyCommand(home, { type: "setRoomControl", roomId: r.id, paused: pause });
      }
      homePlan.step(home, day);
      // Past the opening plan, the player reacts to what's short, once a day.
      if (homePlan.done === PLAN.length && t % config.ticksPerDay === 0) {
        // Saving up for the seed kit: the scarce goods it's still short of aren't spent on other rooms.
        const saving = home.gatheringKit ? SCARCE.filter((k) => (home.kit[k] ?? 0) < (network.seedKit.goods[k] ?? 0) - 1e-6) : [];
        const built = adapt(home, saving);
        if (built) adapted.push(`d${day.toFixed(0)} ${home.name} ${built}`);
      }
      answerVisits(home);
      ensureStairs(home);
      reconnect(home);
      tend(home, t);
      const child = world.holes[1];
      if (child) {
        childPlan.step(child, day);
        if (childPlan.done === CHILD_PLAN.length && t % config.ticksPerDay === 0) {
          const built = adapt(child);
          if (built) adapted.push(`d${day.toFixed(0)} ${child.name} ${built}`);
        }
        answerVisits(child);
        ensureStairs(child);
        reconnect(child);
        tend(child, t);
      }
      if (found && foundedDay === null && world.mapUnlocked && kitProgress(home) >= 0.999) {
        const r = foundHole(world, config, home.holeId, pickSite(world, home));
        if (r.ok) {
          foundedDay = day;
          events.push(`d${day.toFixed(1)} convoy sets off`);
        }
      }
      if (child && !routesSet.home) {
        routesSet.home = HOME_ROUTES.every(([res, n]) => addRoute(world, home.holeId, child.holeId, res, n).ok);
        if (routesSet.home) events.push(`d${day.toFixed(1)} home routes running`);
      }
      if (child && !routesSet.child) {
        routesSet.child = addRoute(world, child.holeId, home.holeId, childExport(child), 20).ok;
        if (routesSet.child) events.push(`d${day.toFixed(1)} child routes running`);
      }
    }
    stepWorld(world, config);
    const child = world.holes[1];
    if (world.tick % config.ticksPerDay === 0) {
      const byRover = (h: SimState | undefined) =>
        Object.values(h?.ledger.days.at(-1) ?? {}).reduce(
          (n, f) => n + Object.entries(f.in).reduce((m, [label, v]) => m + (label.startsWith("Rover ") ? v : 0), 0),
          0,
        );
      delivered += byRover(child);
      deliveredHome += byRover(home);
      const r = child?.resources ?? {};
      log.push({
        day: world.tick / config.ticksPerDay,
        pops: world.holes.map((h) => h.population.count).join("/"),
        total: world.holes.reduce((n, h) => n + h.population.count, 0),
        kit: Math.round(kitProgress(home) * 100),
        kitShort: Object.entries(network.seedKit.goods)
          .filter(([k, v]) => (home.kit[k] ?? 0) < v - 1e-6)
          .map(([k]) => k)
          .join(","),
        routes: world.routes.filter((x) => x.phase !== "loading").length,
        delivered: Math.round(delivered),
        deliveredHome: Math.round(deliveredHome),
        opinions: child
          ? `${Math.round(relation(world, 1, child.holeId).opinion)}/${Math.round(relation(world, child.holeId, 1).opinion)} ${tier(relation(world, child.holeId, 1).opinion)}`
          : "",
        childO2: child ? Math.round(airPct(child, config, "o2") * 10) / 10 : 0,
        childWater: Math.round(r.water ?? 0),
        childFood: Math.round((r.rations ?? 0) + (r.rawFood ?? 0) + (r.meals ?? 0)),
        childHealth: Math.round(child?.population.health ?? 0),
        childHappy: Math.round(child?.happiness.average ?? 0),
        homeHappy: Math.round(home.happiness.average),
        stages: world.holes.map((h) => { const s = stageCounts(h); return `${s.child}/${s.adult}/${s.elder}`; }).join(" "),
        born: world.holes.reduce((n, h) => n + (h.population.born ?? 0), 0),
        beds: world.holes.map((h) => beds(h)).join("/"),
      });
    }
  }
  return {
    world,
    log,
    events,
    foundedDay,
    homeBuilt: homePlan.builtAt,
    netBuilt: netPlan.builtAt,
    childBuilt: childPlan.builtAt,
    adapted,
  };
}
