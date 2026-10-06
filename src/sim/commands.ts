import { ROOM_NAME_MAX } from "./roomName";
import { hasCondition } from "./condition";
import { config } from "./config";
import { charge, checkBuild, CONSTRUCTION, refund } from "./costs";
import { record } from "./ledger";
import { refreshEffects } from "./effects";
import { demolishRoom, placeRoom, type Location } from "./placement";
import type { Priority } from "./config";
import { enact, repeal } from "./ordinances";
import { isCrop, resourceDefs } from "./resources";
import { capacities, mainOutput } from "./economy";
import { bulkheadRefusal, corridorCost, corridorRefusal, corridors, CORRIDORS, finishFor, isFinish, recomputeAccess, routeToRoom, shortfall, totalCost } from "./corridors";
import { edgeById, outsideEdges } from "./edges";
import { setRoomWindows, wallOf, windowCost, windowRefusal } from "./windows";
import { domeRefusal, dropCorridors, dropRoomJobs, finishAll, prioritize, queueCorridors, queueDome, queueExtension, queueFill, queueRoom } from "./construction";
import { holeGates, unlock, UNLOCK_GATES } from "./people";
import { allocationRefusal } from "./storage";
import { answerVisit } from "./visits";
import { answerEvent, consoleEvent } from "./events";
import { padReady } from "./earth";
import { roomDef } from "./rooms";
import { canLine, flooringDef, MATERIALS } from "./materials";
import { buildShowcase } from "./showcase";
import type { SimState } from "./state";
import type { DepositKind } from "./mapgeo";

export type SimCommand =
  /** `confirmed`: the player has agreed to fill in any corridors inside the footprint. */
  | { type: "build"; room: string; at: Location; confirmed?: boolean }
  | { type: "demolish"; roomId: number }
  | { type: "undoBuild"; roomId: number }
  | { type: "setDrill"; active: boolean }
  | { type: "setCrop"; roomId: number; crop: string }
  | { type: "setPriority"; roomId: number; priority: Priority }
  /** Pause a room, or have it stop while its main output is at or above stopAt (null clears it). */
  | { type: "setRoomControl"; roomId: number; paused?: boolean; stopAt?: number | null }
  | { type: "answerVisit"; visitId: number; choice: string }
  /** Answer an event (a find, a ship, a celebration) with one of its choices. */
  | { type: "answerEvent"; eventId: number; choice: string }
  | { type: "setOrdinance"; id: string; enacted: boolean }
  /** Carve corridors along these borders (edge ids, see edges.ts), in a finish. Skips any that can't go. */
  /** With `all`, carve every one or none (a snaked chain is no use half built). */
  | { type: "drawCorridors"; edges: string[]; finish: string; all?: boolean }
  | { type: "removeCorridors"; edges: string[]; all?: boolean }
  /** Draw the shortest corridor that connects this room to the network. */
  | { type: "connectRoom"; roomId: number; finish: string }
  /** Move a construction job to the front of the queue. */
  | { type: "prioritize"; jobId: number }
  /** Take a job out of the queue before it's done, with a full refund. */
  | { type: "cancelJob"; jobId: number }
  /** Share a storage room's space among goods (units per good; the rest is left free). */
  | { type: "setAllocation"; roomId: number; allocation: Record<string, number> }
  /** Start or stop the staging bay gathering a seed kit. */
  | { type: "setGathering"; gathering: boolean }
  /** Testing, from the browser console: set resources to amounts, add to them (negative takes away), or raise them to at least an amount. */
  | { type: "consoleResources"; set?: Record<string, number>; add?: Record<string, number>; atLeast?: Record<string, number> }
  /** Testing, from the browser console: unlock rooms that wait on a milestone (all of them, or one gate), or put a deposit under the hole (by name). */
  | { type: "consoleUnlock"; gate?: string }
  /** Testing, from the browser console: finish every job in the construction queue at once. */
  | { type: "consoleFinish" }
  /** Console: dig to this many floors and fill rings 1–3 with built, furnished rooms (for looking at and stress tests). */
  | { type: "consoleShowcase"; floors: number }
  /** Testing, from the browser console: a dust storm, starting in `inDays` (0: now) and lasting `days`; or clear skies (days 0). */
  | { type: "consoleStorm"; inDays?: number; days?: number }
  /** Console: raise an event now (a find on the deepest floor, a belt ship, a celebration). */
  | { type: "consoleEvent"; kind: string }
  /** Testing, from the browser console: set rooms' condition (0..1): one room, or every room that has one. */
  | { type: "consoleWear"; condition: number; roomId?: number }
  /** Testing, from the browser console: line a room's walls (and floor) outright, for nothing. Null flooring: back to matching the walls. */
  | { type: "consoleLining"; roomId: number; material?: string; finish?: string; flooring?: string | null }
  /** Fit sealed bulkheads across built corridor segments (on), or take them out (off, free). */
  | { type: "setBulkhead"; edges: string[]; on: boolean }
  /** Put windows in (or take them out of) a room's wall: the borders along it. */
  | { type: "setWindows"; roomId: number; edges: string[]; on: boolean }
  /** Start building the dome over the shaft. */
  | { type: "buildDome" }
  /** Give a room its own name; an empty name goes back to the default. */
  | { type: "renameRoom"; roomId: number; name: string };

/** roomId is set when a build succeeds, so the UI can offer undo. */
export type CommandResult = { ok: true; roomId?: number } | { ok: false; reason: string };

export function applyCommand(state: SimState, cmd: SimCommand): CommandResult {
  const result = apply(state, cmd);
  state.effects = refreshEffects(state.layout, state.effects);
  return result;
}

/** Deposits the console can put under a hole, for testing rooms that need one. */
/** What windows are recorded as in the ledger. */
const WINDOWS = "Windows";

const DEPOSITS: DepositKind[] = ["ice", "aquifer", "ore", "silica"];

/** What console changes are recorded as in the ledger. */
export const CONSOLE = "Console";

/**
 * The console's resource tweak: every id is checked first (a resource or a
 * crop), then each is set or added to, never below zero, and recorded in the
 * ledger so the flow report stays honest. Past what the hole can hold, it
 * makes extra room (kept with the hole), so the amount sticks.
 */
function consoleResources(state: SimState, set: Record<string, number>, add: Record<string, number>, atLeast: Record<string, number>): CommandResult {
  const known = new Set([...resourceDefs.map((r) => r.id), ...Object.keys(state.resources)]);
  const bad = [...Object.keys(set), ...Object.keys(add), ...Object.keys(atLeast)].filter((id) => !known.has(id) && !isCrop(id));
  if (bad.length) return { ok: false, reason: `Unknown resource ${bad.map((id) => `"${id}"`).join(", ")}` };
  const amounts = [...Object.values(set), ...Object.values(add), ...Object.values(atLeast)];
  if (amounts.some((v) => typeof v !== "number" || !Number.isFinite(v))) return { ok: false, reason: "Amounts must be numbers" };
  const change = (id: string, to: number) => {
    const from = state.resources[id] ?? 0;
    const next = Math.max(0, to);
    state.resources[id] = next;
    // More than the hole can hold: make room for it, or the next tick would throw the rest away.
    const cap = capacities(state, config)[id] ?? Infinity;
    if (next > cap) {
      state.consoleSpace ??= {};
      state.consoleSpace[id] = (state.consoleSpace[id] ?? 0) + (next - cap);
    }
    if (next > from) record(state, id, "in", CONSOLE, next - from);
    else record(state, id, "out", CONSOLE, from - next);
  };
  for (const [id, v] of Object.entries(set)) change(id, v);
  for (const [id, v] of Object.entries(add)) change(id, (state.resources[id] ?? 0) + v);
  for (const [id, v] of Object.entries(atLeast)) if ((state.resources[id] ?? 0) < v) change(id, v);
  return { ok: true };
}

/**
 * Carve corridors, paying for each in the finish. With `all`, it's all or
 * nothing (a route is no use half built); otherwise whatever can go, goes.
 */
function drawCorridors(state: SimState, edges: string[], finish: string, all = false): CommandResult {
  const layout = state.layout;
  if (!isFinish(finish)) return { ok: false, reason: `Unknown finish "${finish}"` };
  const ok = edges.filter((id, i) => edges.indexOf(id) === i && corridorRefusal(layout, id) === null);
  if (!ok.length) return { ok: false, reason: corridorRefusal(layout, edges[0] ?? "") ?? "Nothing to carve" };
  if (all) {
    const short = shortfall(state.resources, totalCost(layout.hole, ok, finish, config));
    if (short) return { ok: false, reason: short };
  }
  let built = 0;
  const carved: string[] = [];
  let firstShort: string | null = null;
  for (const id of ok) {
    const cost = corridorCost(layout.hole, edgeById(layout.hole, id)!, finish, config);
    const short = shortfall(state.resources, cost);
    if (short) {
      firstShort ??= short;
      continue;
    }
    for (const [r, v] of Object.entries(cost)) {
      state.resources[r] = (state.resources[r] ?? 0) - v;
      record(state, r, "out", CORRIDORS, v);
    }
    layout.corridors[id] = finishFor(edgeById(layout.hole, id)!, finish);
    carved.push(id);
    built++;
  }
  if (!built) return { ok: false, reason: firstShort ?? "Nothing to carve" };
  queueCorridors(state, carved, config);
  recomputeAccess(layout);
  layout.version++;
  return { ok: true };
}

function apply(state: SimState, cmd: SimCommand): CommandResult {
  const layout = state.layout;
  switch (cmd.type) {
    case "build": {
      const check = checkBuild(layout, state.resources, cmd.room, cmd.at, config, holeGates(state));
      if (!check.ok) return { ok: false, reason: check.reason };
      if (check.destroys?.length) {
        const n = check.destroys.length;
        if (!cmd.confirmed) return { ok: false, reason: `It would fill in ${n} corridor ${n === 1 ? "segment" : "segments"}: confirm first` };
        // The room's walls take the corridors' place: they're gone, and any not yet built are refunded.
        for (const id of dropCorridors(state, check.destroys, config)) {
          for (const [r, v] of Object.entries(corridorCost(layout.hole, edgeById(layout.hole, id)!, layout.corridors[id]!, config))) state.resources[r] = (state.resources[r] ?? 0) + v;
        }
        for (const id of check.destroys) {
          delete layout.corridors[id];
          if (layout.corridorsFilling?.[id] !== undefined) delete layout.corridorsFilling[id];
        }
        // Queued fill-ins of those corridors have nothing left to do.
        const gone = new Set(check.destroys);
        if (state.construction) {
          for (const j of state.construction.queue) if (j.kind === "fill") j.edges = (j.edges ?? []).filter((id) => !gone.has(id));
          state.construction.queue = state.construction.queue.filter((j) => j.kind !== "fill" || (j.edges ?? []).length);
        }
      }
      const r = placeRoom(layout, cmd.room, cmd.at);
      if (!r.ok) return { ok: false, reason: r.reason };
      charge(state.resources, cmd.room);
      for (const [id, amt] of Object.entries(roomDef(cmd.room).cost)) record(state, id, "out", CONSTRUCTION, amt);
      const room = layout.rooms.find((x) => x.id === r.id)!;
      // Extending stairs or an elevator isn't a new room: nothing to undo as one.
      if (r.extended) {
        queueExtension(state, room, r.fresh ?? [], config);
        recomputeAccess(layout);
        return { ok: true };
      }
      room.builtTick = state.tick;
      queueRoom(state, room, config);
      recomputeAccess(layout);
      layout.version++;
      return { ok: true, roomId: r.id! };
    }
    case "demolish": {
      const room = layout.rooms.find((r) => r.id === cmd.roomId);
      const cells = room ? [...room.cells, ...(room.pendingCells ?? [])] : [];
      if (room?.pendingCells) {
        room.cells = cells; // demolish takes the whole stack, built or not
        delete room.pendingCells;
      }
      const result = demolishRoom(layout, cmd.roomId);
      if (result.ok && room) {
        // Stairs and elevators refund every piece: the first spans two floors, each extension one more.
        const pieces = roomDef(room.type).stacks ? Math.max(1, new Set(cells.map((c) => c.floor)).size - 1) : 1;
        // Blueprints and rooms still waiting in the queue were never built: a full refund.
        const unbuilt = room.planned || room.building;
        refund(state.resources, room.type, (unbuilt ? 1 : config.economy.demolishRefund) * pieces);
        dropRoomJobs(state, room.id);
      }
      return result;
    }
    case "undoBuild": {
      const room = layout.rooms.find((r) => r.id === cmd.roomId);
      if (!room) return { ok: false, reason: "Nothing to undo" };
      if (room.builtTick === undefined || state.tick - room.builtTick > config.economy.undoWindowTicks) {
        return { ok: false, reason: "Too late to undo: demolish it instead" };
      }
      const result = demolishRoom(layout, cmd.roomId);
      if (result.ok) {
        refund(state.resources, room.type, 1);
        dropRoomJobs(state, room.id);
      }
      return result;
    }
    case "consoleResources":
      return consoleResources(state, cmd.set ?? {}, cmd.add ?? {}, cmd.atLeast ?? {});
    case "consoleWear": {
      const c = Math.max(0, Math.min(1, cmd.condition));
      const rooms = layout.rooms.filter((r) => (cmd.roomId === undefined || r.id === cmd.roomId) && hasCondition(r));
      if (!rooms.length) return { ok: false, reason: cmd.roomId === undefined ? "No rooms with a condition" : "That room has no condition" };
      for (const r of rooms) {
        r.condition = c;
        delete r.repair;
      }
      return { ok: true };
    }
    case "consoleLining": {
      const room = layout.rooms.find((r) => r.id === cmd.roomId);
      if (!room) return { ok: false, reason: "No such room" };
      if (!canLine(room)) return { ok: false, reason: `${roomDef(room.type).name} can't have a lining` };
      const material = cmd.material ?? room.material ?? "rock";
      const finish = cmd.finish ?? (cmd.material ? "base" : (room.finish ?? "base"));
      const step = MATERIALS.walls.find((w) => w.material === material && w.finish === finish);
      if (!step) return { ok: false, reason: `No lining "${material}" (${finish}): ${MATERIALS.walls.map((w) => `${w.material}/${w.finish}`).join(", ")}` };
      if (cmd.flooring && !flooringDef(cmd.flooring)) return { ok: false, reason: `No flooring "${cmd.flooring}": ${MATERIALS.floorings.map((f) => f.id).join(", ")}` };
      if (step === MATERIALS.walls[0]) {
        delete room.material;
        delete room.finish;
      } else {
        room.material = step.material;
        if (step.finish === "base") delete room.finish;
        else room.finish = step.finish;
      }
      if (cmd.flooring) room.flooring = cmd.flooring;
      else if (cmd.flooring === null) delete room.flooring;
      // The views draw rooms by their lining.
      layout.version++;
      return { ok: true };
    }
    case "consoleEvent":
      return consoleEvent(state, config, cmd.kind);
    case "consoleStorm": {
      const tpd = config.ticksPerDay;
      const days = cmd.days ?? 1;
      if (days <= 0) {
        if (state.weather) state.weather.storm = undefined;
        return { ok: true };
      }
      const start = state.tick + Math.round((cmd.inDays ?? 0) * tpd);
      state.weather = { storm: { start, end: start + Math.round(days * tpd) } };
      return { ok: true };
    }
    case "consoleShowcase": {
      const r = buildShowcase(state, cmd.floors);
      return r.rooms ? { ok: true } : { ok: false, reason: "No room left to fill" };
    }
    case "consoleFinish": {
      const n = state.construction?.queue.length ?? 0;
      finishAll(state, config);
      recomputeAccess(layout);
      return n ? { ok: true } : { ok: false, reason: "Nothing is waiting to be built" };
    }
    case "consoleUnlock": {
      const deposit = DEPOSITS.find((d) => d === cmd.gate);
      if (deposit) {
        if (!state.deposits.includes(deposit)) state.deposits.push(deposit);
        return { ok: true };
      }
      const gates = cmd.gate === undefined ? [...UNLOCK_GATES] : UNLOCK_GATES.filter((g) => g === cmd.gate);
      if (!gates.length) return { ok: false, reason: `Unknown gate "${cmd.gate}": try ${[...UNLOCK_GATES, ...DEPOSITS].join(", ")}` };
      gates.forEach((g) => unlock(state, g));
      return { ok: true };
    }
    case "cancelJob": {
      const job = state.construction?.queue.find((j) => j.id === cmd.jobId);
      if (!job) return { ok: false, reason: "Nothing in the queue by that number" };
      if (job.kind === "room" && job.roomId !== undefined) return apply(state, { type: "demolish", roomId: job.roomId });
      if (job.kind === "corridors") return apply(state, { type: "removeCorridors", edges: job.edges ?? [] });
      if (job.kind === "fill") {
        // The corridors stay; what was paid to fill them in comes back.
        for (const id of job.edges ?? []) {
          const finish = layout.corridors[id];
          if (finish) for (const [r, v] of Object.entries(corridorCost(layout.hole, edgeById(layout.hole, id)!, finish, config))) state.resources[r] = (state.resources[r] ?? 0) + v;
          delete layout.corridorsFilling?.[id];
        }
      } else if (job.kind === "dome") {
        // Its materials come back in full.
        for (const [r, v] of Object.entries(config.dome.cost)) state.resources[r] = (state.resources[r] ?? 0) + v;
      } else if (job.kind === "extend" && job.roomId !== undefined) {
        // The waiting floors are let go, and their piece refunded.
        const room = layout.rooms.find((r) => r.id === job.roomId);
        for (const c of room?.pendingCells ?? []) layout.grid[c.floor - 1]![c.ring - 1]![c.slot] = 0;
        if (room) {
          delete room.pendingCells;
          refund(state.resources, room.type, 1);
        }
      }
      state.construction.queue = state.construction.queue.filter((j) => j !== job);
      recomputeAccess(layout);
      layout.version++;
      return { ok: true };
    }
    case "buildDome": {
      const why = domeRefusal(state);
      if (why) return { ok: false, reason: why };
      for (const [r, v] of Object.entries(config.dome.cost)) {
        state.resources[r] = (state.resources[r] ?? 0) - v;
        record(state, r, "out", CONSTRUCTION, v);
      }
      queueDome(state, config);
      return { ok: true };
    }
    case "setBulkhead": {
      const ids = cmd.edges.filter((id, i) => cmd.edges.indexOf(id) === i && bulkheadRefusal(layout, id, cmd.on) === null);
      if (!ids.length) return { ok: false, reason: bulkheadRefusal(layout, cmd.edges[0] ?? "", cmd.on) ?? "Nothing to do" };
      if (cmd.on) {
        const cost: Record<string, number> = {};
        for (const [r, v] of Object.entries(corridors.bulkhead.cost)) cost[r] = v * ids.length;
        const short = shortfall(state.resources, cost);
        if (short) return { ok: false, reason: short };
        for (const [r, v] of Object.entries(cost)) {
          state.resources[r] = (state.resources[r] ?? 0) - v;
          record(state, r, "out", CORRIDORS, v);
        }
        layout.bulkheads ??= {};
        for (const id of ids) layout.bulkheads[id] = true;
      } else for (const id of ids) delete layout.bulkheads?.[id];
      layout.version++;
      return { ok: true };
    }
    case "setWindows": {
      const room = layout.rooms.find((r) => r.id === cmd.roomId);
      const own = room ? new Set(outsideEdges(layout.hole, room.cells).map((e) => e.id)) : new Set<string>();
      // Only the room's own borders, and (putting them in) only where there's something to look out on.
      const edges = room ? cmd.edges.filter((id, i) => cmd.edges.indexOf(id) === i && own.has(id) && (!cmd.on || (wallOf(layout, room, id) ?? []).some((e) => e.id === id))) : [];
      const refusal = windowRefusal(room, edges, cmd.on);
      if (refusal || !room) return { ok: false, reason: refusal ?? "No room there" };
      if (cmd.on) {
        const fresh = edges.filter((id) => !room.windows?.includes(id)).map((id) => edgeById(layout.hole, id)!);
        const cost = windowCost(layout, fresh);
        const short = shortfall(state.resources, cost);
        if (short) return { ok: false, reason: short };
        for (const [r, v] of Object.entries(cost)) {
          state.resources[r] = (state.resources[r] ?? 0) - v;
          record(state, r, "out", WINDOWS, v);
        }
      }
      setRoomWindows(room, edges, cmd.on);
      layout.version++;
      return { ok: true };
    }
    case "prioritize":
      return prioritize(state, cmd.jobId) ? { ok: true } : { ok: false, reason: "Nothing in the queue by that number" };
    case "drawCorridors":
      return drawCorridors(state, cmd.edges, cmd.finish, cmd.all);
    case "removeCorridors": {
      // Filling a corridor in costs what carving it did: the walls around it are rebuilt.
      const all = cmd.edges.filter((id, i) => layout.corridors[id] && cmd.edges.indexOf(id) === i);
      if (!all.length) return { ok: false, reason: "No corridor there" };
      // Not built yet: taken off the plan, with a full refund.
      for (const id of dropCorridors(state, all, config)) {
        for (const [r, v] of Object.entries(corridorCost(layout.hole, edgeById(layout.hole, id)!, layout.corridors[id]!, config))) {
          state.resources[r] = (state.resources[r] ?? 0) + v;
        }
        delete layout.corridors[id];
      }
      const gone = all.filter((id) => layout.corridors[id] && layout.corridorsFilling?.[id] === undefined);
      if (!gone.length) {
        recomputeAccess(layout);
        layout.version++;
        return { ok: true };
      }
      if (cmd.all) {
        const total: Record<string, number> = {};
        for (const id of gone) {
          for (const [r, v] of Object.entries(corridorCost(layout.hole, edgeById(layout.hole, id)!, layout.corridors[id]!, config))) total[r] = (total[r] ?? 0) + v;
        }
        const short = shortfall(state.resources, total);
        if (short) return { ok: false, reason: short };
      }
      let removed = 0;
      const filled: string[] = [];
      let firstShort: string | null = null;
      for (const id of gone) {
        const cost = corridorCost(layout.hole, edgeById(layout.hole, id)!, layout.corridors[id]!, config);
        const short = shortfall(state.resources, cost);
        if (short) {
          firstShort ??= short;
          continue;
        }
        for (const [r, v] of Object.entries(cost)) {
          state.resources[r] = (state.resources[r] ?? 0) - v;
          record(state, r, "out", CORRIDORS, v);
        }
        filled.push(id);
        removed++;
      }
      if (!removed) return { ok: false, reason: firstShort ?? "No corridor there" };
      // Filling in takes construction time too; until then the corridor stays in use.
      if (!queueFill(state, filled, config)) for (const id of filled) delete layout.corridors[id];
      recomputeAccess(layout);
      layout.version++;
      return { ok: true };
    }
    case "connectRoom": {
      const room = layout.rooms.find((r) => r.id === cmd.roomId);
      if (!room) return { ok: false, reason: "No such room" };
      const path = routeToRoom(layout, room, config);
      if (path === null) return { ok: false, reason: "No way to reach it along rooms on this floor: build toward it first" };
      if (!path.length) return { ok: true };
      return drawCorridors(state, path, cmd.finish, true);
    }
    case "setDrill":
      state.drill.active = cmd.active;
      return { ok: true };
    case "renameRoom": {
      const room = layout.rooms.find((r) => r.id === cmd.roomId);
      if (!room) return { ok: false, reason: "No such room" };
      const name = cmd.name.replace(/\s+/g, " ").trim().slice(0, ROOM_NAME_MAX);
      if (name && name !== roomDef(room.type).name) room.name = name;
      else delete room.name;
      // The map views label rooms by name.
      layout.version++;
      return { ok: true };
    }
    case "setCrop": {
      const room = layout.rooms.find((r) => r.id === cmd.roomId);
      if (!room || !roomDef(room.type).growsCrops) return { ok: false, reason: "Only farms grow crops" };
      if (!isCrop(cmd.crop)) return { ok: false, reason: `Unknown crop "${cmd.crop}"` };
      room.crop = cmd.crop;
      layout.version++;
      return { ok: true };
    }
    case "answerVisit":
      return answerVisit(state, config, cmd.visitId, cmd.choice);
    case "answerEvent":
      return answerEvent(state, config, cmd.eventId, cmd.choice, padReady(state));
    case "setOrdinance":
      if (!cmd.enacted) {
        repeal(state, cmd.id);
        return { ok: true };
      }
      return enact(state, cmd.id);
    case "setPriority": {
      const room = layout.rooms.find((r) => r.id === cmd.roomId);
      if (!room) return { ok: false, reason: "No such room" };
      if (!config.economy.priorities.includes(cmd.priority)) return { ok: false, reason: "Unknown priority" };
      room.priority = cmd.priority;
      layout.version++;
      return { ok: true };
    }
    case "setAllocation": {
      const room = layout.rooms.find((r) => r.id === cmd.roomId);
      if (!room) return { ok: false, reason: "No such room" };
      const refusal = allocationRefusal(room, cmd.allocation);
      if (refusal) return { ok: false, reason: refusal };
      room.allocation = Object.fromEntries(Object.entries(cmd.allocation).filter(([, v]) => v > 0));
      layout.version++;
      return { ok: true };
    }
    case "setGathering":
      if (cmd.gathering && !state.layout.rooms.some((r) => roomDef(r.type).stagesSeedKit && !r.planned)) {
        return { ok: false, reason: "Build a staging bay first" };
      }
      state.gatheringKit = cmd.gathering;
      return { ok: true };
    case "setRoomControl": {
      const room = layout.rooms.find((r) => r.id === cmd.roomId);
      if (!room) return { ok: false, reason: "No such room" };
      if (cmd.paused !== undefined) room.paused = cmd.paused || undefined;
      if (cmd.stopAt !== undefined) {
        if (cmd.stopAt === null) delete room.stopAt;
        else if (!mainOutput(room, config)) return { ok: false, reason: "This room doesn't make anything to stock" };
        else if (!(cmd.stopAt >= 0)) return { ok: false, reason: "Stop at a stock of zero or more" };
        else room.stopAt = cmd.stopAt;
      }
      layout.version++;
      return { ok: true };
    }
  }
}
