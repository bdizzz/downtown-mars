import { config } from "./config";
import { charge, checkBuild, CONSTRUCTION, refund } from "./costs";
import { record } from "./ledger";
import { refreshEffects } from "./effects";
import { demolishRoom, placeRoom, type Location } from "./placement";
import type { Priority } from "./config";
import { enact, repeal } from "./ordinances";
import { isCrop } from "./resources";
import { mainOutput } from "./economy";
import { corridorCost, corridorRefusal, CORRIDORS, isFinish, recomputeAccess, routeToRoom, shortfall, totalCost } from "./corridors";
import { edgeById } from "./edges";
import { dropCorridors, dropRoomJobs, prioritize, queueCorridors, queueExtension, queueFill, queueRoom } from "./construction";
import { holeGates } from "./people";
import { answerVisit } from "./visits";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

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
  /** Start or stop the staging bay gathering a seed kit. */
  | { type: "setGathering"; gathering: boolean };

/** roomId is set when a build succeeds, so the UI can offer undo. */
export type CommandResult = { ok: true; roomId?: number } | { ok: false; reason: string };

export function applyCommand(state: SimState, cmd: SimCommand): CommandResult {
  const result = apply(state, cmd);
  state.effects = refreshEffects(state.layout, state.effects);
  return result;
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
    layout.corridors[id] = finish;
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
        queueExtension(state, room, r.fresh ?? []);
        recomputeAccess(layout);
        return { ok: true };
      }
      room.builtTick = state.tick;
      queueRoom(state, room);
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
