/// <reference lib="webworker" />
import { applyCommand } from "../sim/commands";
import { config } from "../sim/config";
import { deserialize, serialize, summarize } from "../sim/save";
import { makeSnapshot, type HoleSummary, type RelationView, type RouteView } from "../sim/snapshot";
import { cultureTarget, loadFactor, relation, tier } from "../sim/culture";
import { destination } from "../sim/migration";
import { foundHole, travelTicks } from "../sim/founding";
import { addRoute, removeRoute, routesFrom, roversAt, TRADEABLE } from "../sim/rovers";
import { degreesApart } from "../sim/mapgeo";
import { network } from "../sim/network";
import { createWorld, holeById, networkMessages, type World } from "../sim/world";
import { stepWorld } from "../sim/worldstep";
import type { FromWorker, ToWorker, WireSnapshot } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

let world: World = createWorld(config);
/** The hole the player is looking at: commands go to it and snapshots describe it. */
let activeHoleId = world.holes[0]!.holeId;
/** Bumps on every new game or load, so views drop what they cached. */
let gameId = 1;
let speed = 1;
let tickDebt = 0; // fractional ticks owed to real time
let last = performance.now();
let sentLayout = "";
let sentHistory = "";

function reply(msg: FromWorker): void {
  self.postMessage(msg);
}

function active() {
  return holeById(world, activeHoleId) ?? world.holes[0]!;
}

function summaries(): HoleSummary[] {
  return world.holes.map((h) => ({
    id: h.holeId,
    name: h.name,
    population: h.population.count,
    waiting: h.office.waiting.length,
    site: h.site,
    deposits: h.deposits ?? [],
    rovers: roversAt(h),
    stock: Object.fromEntries(TRADEABLE.map((r) => [r, h.resources[r] ?? 0])),
    culture: h.culture,
    cultureTarget: cultureTarget(h, config),
  }));
}

function relationViews(): RelationView[] {
  return world.holes.flatMap((a) =>
    world.holes
      .filter((b) => b !== a)
      .map((b) => {
        const opinion = relation(world, a.holeId, b.holeId).opinion;
        return { from: a.holeId, to: b.holeId, opinion, tier: tier(opinion) };
      }),
  );
}

function routeViews(): RouteView[] {
  return world.routes.map((r) => {
    const from = holeById(world, r.fromHoleId);
    const to = holeById(world, r.toHoleId);
    const legTicks = from?.site && to?.site ? travelTicks(from.site, to.site, config) : 0;
    const span = Math.max(1, r.legEndTick - r.legStartTick);
    return {
      id: r.id,
      fromHoleId: r.fromHoleId,
      toHoleId: r.toHoleId,
      resource: r.resource,
      amountPerTrip: r.amountPerTrip,
      phase: r.phase,
      cargo: r.cargo,
      progress: r.phase === "loading" ? 0 : Math.min(1, (world.tick - r.legStartTick) / span),
      legDays: legTicks / config.ticksPerDay,
      idle: !!from && routesFrom(world, from.holeId).indexOf(r) >= roversAt(from),
      loadFactor: from && to ? loadFactor(world, from, to) : 1,
    };
  });
}

/** Everything once the map is open; before that, only what's near a hole. */
function knownDeposits() {
  if (world.mapUnlocked) return world.map.deposits;
  const sites = world.holes.flatMap((h) => (h.site ? [h.site] : []));
  return world.map.deposits.filter((d) => sites.some((s) => degreesApart(s, d) <= network.scoutRadiusDeg + d.radiusDeg));
}

function post(): void {
  const hole = active();
  const { layout, effects, history, ...rest } = makeSnapshot(hole, config);
  const key = `${gameId}:${hole.holeId}:${layout.version}`;
  const fresh = key !== sentLayout;
  sentLayout = key;
  const historyKey = `${gameId}:${hole.holeId}:${history?.version ?? -1}`;
  const freshHistory = historyKey !== sentHistory;
  sentHistory = historyKey;
  const snapshot: WireSnapshot = {
    ...rest,
    gameId,
    holes: summaries(),
    deposits: knownDeposits(),
    convoys: world.convoys.map((c) => ({
      name: c.name,
      from: holeById(world, c.fromHoleId)?.site ?? null,
      to: c.site,
      progress: (world.tick - c.departTick) / Math.max(1, c.arriveTick - c.departTick),
      daysLeft: (c.arriveTick - world.tick) / config.ticksPerDay,
    })),
    routes: routeViews(),
    migrations: world.migrations.map((m) => ({
      from: m.fromHoleId,
      to: m.toHoleId,
      count: m.people.reduce((n, c) => n + c.count, 0),
      progress: (world.tick - m.departTick) / Math.max(1, m.arriveTick - m.departTick),
      daysLeft: (m.arriveTick - world.tick) / config.ticksPerDay,
    })),
    leavingFor: destination(world, hole)?.name ?? null,
    relations: relationViews(),
    mapUnlocked: world.mapUnlocked,
    // News from every hole, so nothing elsewhere goes unnoticed.
    messages: networkMessages(world, config.messages.keep),
    layoutVersion: layout.version,
    ...(fresh ? { layout, effects } : {}),
    ...(freshHistory ? { history } : {}),
  };
  reply({ type: "snapshot", snapshot, speed });
}

function frame(): void {
  const now = performance.now();
  tickDebt += ((now - last) / 1000) * config.ticksPerSecondAt1x * speed;
  last = now;

  // If we fall far behind (tab hidden, slow machine), drop the backlog
  // rather than freezing to catch up.
  const due = Math.min(Math.floor(tickDebt), config.maxTicksPerFrame);
  for (let i = 0; i < due; i++) stepWorld(world, config);
  tickDebt = due === config.maxTicksPerFrame ? 0 : tickDebt - due;

  post();
}

function replaceWorld(next: World): void {
  world = next;
  activeHoleId = world.holes[0]!.holeId;
  gameId++;
  tickDebt = 0;
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  switch (msg.type) {
    case "setSpeed":
      if (config.speeds.includes(msg.speed)) speed = msg.speed;
      break;
    case "advance": {
      const ticks = Math.max(0, Math.min(365, msg.days)) * config.ticksPerDay;
      for (let i = 0; i < ticks; i++) stepWorld(world, config);
      reply({ type: "commandResult", id: msg.id, result: { ok: true } });
      break;
    }
    case "setActiveHole":
      if (holeById(world, msg.holeId)) activeHoleId = msg.holeId;
      break;
    case "found":
      // Founded from the hole you're looking at.
      reply({ type: "commandResult", id: msg.id, result: foundHole(world, config, activeHoleId, msg.site) });
      break;
    case "route": {
      const a = msg.action;
      const result =
        a.kind === "add" ? addRoute(world, a.fromHoleId, a.toHoleId, a.resource, a.amountPerTrip) : removeRoute(world, a.routeId);
      reply({ type: "commandResult", id: msg.id, result });
      break;
    }
    case "command":
      // Applied between ticks, so building works while paused.
      reply({ type: "commandResult", id: msg.id, result: applyCommand(active(), msg.command) });
      break;
    case "save":
      reply({ type: "saved", id: msg.id, data: serialize(world), summary: summarize(world, config) });
      break;
    case "load": {
      const r = deserialize(msg.data);
      if (r.ok) replaceWorld(r.world);
      reply({ type: "loaded", id: msg.id, result: r.ok ? { ok: true } : { ok: false, reason: r.reason } });
      break;
    }
    case "newGame":
      // Each new game gets its own seed, so the map (and everything else random) differs.
      replaceWorld(createWorld(config, (Math.random() * 0xffffffff) >>> 0 || 1));
      reply({ type: "loaded", id: msg.id, result: { ok: true } });
      break;
  }
  post();
};

setInterval(frame, 1000 / config.snapshotsPerSecond);
post();
