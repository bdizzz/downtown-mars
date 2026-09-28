import raw from "../../data/construction.json";
import type { SimConfig } from "./config";
import { recomputeAccess } from "./corridors";
import { edgeById, edgeLengthM } from "./edges";
import { isActive } from "./economy";
import { postMessage } from "./messages";
import type { Cell, Layout, RoomInstance } from "./placement";
import { openCells, rockCells, yieldRock } from "./excavation";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

// Construction time. Everything the player commits to goes into the hole's
// queue and is built one job at a time, in order, at the hole's construction
// bandwidth (work-hours per game hour). Construction offices add bandwidth.
// Until a job is done, its room holds its slots but doesn't run, and its
// corridors don't join the network.
//
// A room on solid rock is excavated first: the crews dig out its rock cells
// one at a time (each opens when its hours are done, and brings up its rock
// as it goes), then build. On empty space there's nothing to dig.

export const construction = raw as unknown as {
  instant: boolean;
  baseBandwidth: number;
  hoursBySize: Record<string, number>;
  corridorHoursPer10m: number;
  /** Work-hours to dig out one slot of solid rock, before building. */
  excavationHoursPerSlot: number;
};

export interface Job {
  id: number;
  /** A room, corridor segments to carve or to fill in, or more floors for stairs or an elevator. */
  kind: "room" | "corridors" | "fill" | "extend";
  roomId?: number;
  edges?: string[];
  /** Work needed and done, in work-hours (excavation included). */
  work: number;
  done: number;
  /** The first `dig` hours of the work are excavation, of these rock cells in order. */
  dig?: number;
  digCells?: Cell[];
}

export interface ConstructionState {
  queue: Job[];
  nextJobId: number;
}

export function createConstruction(): ConstructionState {
  return { queue: [], nextJobId: 1 };
}

/** Work-hours to build a room. */
export function roomWork(type: string): number {
  const def = roomDef(type);
  return def.buildHours ?? construction.hoursBySize[def.size] ?? construction.hoursBySize.S!;
}

/** Work-hours to carve corridors: by length. */
export function corridorWork(layout: Layout, edges: string[], cfg: SimConfig): number {
  let metres = 0;
  for (const id of edges) {
    const e = edgeById(layout.hole, id);
    if (e) metres += edgeLengthM(layout.hole, e, cfg.geometry.roomDepthM);
  }
  return (metres / 10) * construction.corridorHoursPer10m;
}

/** Work-hours per game hour: the base, plus every construction office, scaled by how it's running. */
export function bandwidth(state: SimState): number {
  let b = construction.baseBandwidth;
  for (const r of state.layout.rooms) {
    const add = roomDef(r.type).constructionBandwidth;
    if (add && isActive(r) && !r.building) b += add * (state.roomStatus[r.id]?.rate ?? 0);
  }
  return b;
}

function add(state: SimState, job: Omit<Job, "id" | "done">): Job | null {
  if (construction.instant) return null;
  const c = (state.construction ??= createConstruction());
  const full: Job = { ...job, id: c.nextJobId++, done: 0 };
  c.queue.push(full);
  return full;
}

/** The excavation part of a job for these cells: the rock ones, and their hours. */
function digFor(state: SimState, cells: Cell[]): { dig?: number; digCells?: Cell[] } {
  const rock = rockCells(state.layout, cells);
  return rock.length ? { dig: rock.length * construction.excavationHoursPerSlot, digCells: rock } : {};
}

/** Dig these cells out at once, with their rock (sandbox, and blueprints when their floor is dug). */
export function excavateNow(state: SimState, cells: Cell[], cfg: SimConfig): void {
  const rock = rockCells(state.layout, cells);
  openCells(state.layout, rock);
  yieldRock(state, cfg, rock.length);
}

/** A room just committed: excavated if need be, then under construction until its job is done. */
export function queueRoom(state: SimState, room: RoomInstance, cfg: SimConfig): void {
  const dig = room.planned ? { dig: room.cells.length * construction.excavationHoursPerSlot, digCells: room.cells } : digFor(state, room.cells);
  const job = add(state, { kind: "room", roomId: room.id, work: (dig.dig ?? 0) + roomWork(room.type), ...dig });
  if (job) room.building = true;
  else if (!room.planned) finishInstantly(state, room, cfg);
}

/** Sandbox: dug and built at once. An empty room leaves only its empty space. */
function finishInstantly(state: SimState, room: RoomInstance, cfg: SimConfig): void {
  excavateNow(state, room.cells, cfg);
  if (roomDef(room.type).excavationOnly) removeRoom(state.layout, room);
}

/** A blueprint's floor is dug: in the sandbox (nothing queued), it's dug out and built there and then. */
export function blueprintReady(state: SimState, room: RoomInstance, cfg: SimConfig): void {
  if (!room.building) finishInstantly(state, room, cfg);
}

/** Stairs or an elevator reaching further: the new floors join when built. */
export function queueExtension(state: SimState, room: RoomInstance, cells: Cell[], cfg: SimConfig): void {
  const dig = digFor(state, cells);
  const job = add(state, { kind: "extend", roomId: room.id, work: (dig.dig ?? 0) + roomWork(room.type), ...dig });
  if (!job) {
    excavateNow(state, cells, cfg);
    return;
  }
  const key = (c: Cell) => `${c.floor}:${c.ring}:${c.slot}`;
  const fresh = new Set(cells.map(key));
  room.pendingCells = [...(room.pendingCells ?? []), ...room.cells.filter((c) => fresh.has(key(c)))];
  room.cells = room.cells.filter((c) => !fresh.has(key(c)));
}

/** Corridors just carved: waiting for the crews. */
export function queueCorridors(state: SimState, edges: string[], cfg: SimConfig): void {
  if (!edges.length) return;
  const job = add(state, { kind: "corridors", edges: [...edges], work: corridorWork(state.layout, edges, cfg) });
  if (!job) return;
  const layout = state.layout;
  layout.corridorsBuilding ??= {};
  for (const id of edges) layout.corridorsBuilding[id] = job.id;
}

/** Corridors to fill in: they stay usable until the crews get to them. Returns false if it happened at once (instant). */
export function queueFill(state: SimState, edges: string[], cfg: SimConfig): boolean {
  if (!edges.length) return false;
  const job = add(state, { kind: "fill", edges: [...edges], work: corridorWork(state.layout, edges, cfg) });
  if (!job) return false;
  const layout = state.layout;
  layout.corridorsFilling ??= {};
  for (const id of edges) layout.corridorsFilling[id] = job.id;
  return true;
}

/** The job building this room (or extending it), if any. */
export function jobForRoom(state: SimState, roomId: number): Job | undefined {
  return state.construction?.queue.find((j) => j.roomId === roomId);
}

/** Can the crews work on this job yet? A blueprint on a floor still being dug waits. */
function workable(state: SimState, job: Job): boolean {
  if (job.kind === "corridors" || job.kind === "fill") return (job.edges ?? []).every((id) => (edgeById(state.layout.hole, id)?.floor ?? 0) <= state.layout.hole.floors);
  const room = state.layout.rooms.find((r) => r.id === job.roomId);
  return !!room && !room.planned;
}

/** A job's phase: digging out rock, or building. */
export function phaseOf(job: Job): "excavating" | "building" {
  return job.dig && job.done < job.dig - 1e-9 ? "excavating" : "building";
}

/** Dig out the job's rock cells whose hours are done, bringing up their rock. */
function excavate(state: SimState, job: Job, before: number, cfg: SimConfig): void {
  if (!job.dig || !job.digCells) return;
  const dug = Math.min(job.done, job.dig) - Math.min(before, job.dig);
  if (dug <= 0) return;
  yieldRock(state, cfg, dug / construction.excavationHoursPerSlot);
  const cells = Math.min(job.digCells.length, Math.floor(Math.min(job.done, job.dig) / construction.excavationHoursPerSlot + 1e-9));
  const fresh = rockCells(state.layout, job.digCells.slice(0, cells));
  if (!fresh.length) return;
  openCells(state.layout, fresh);
  state.layout.version++;
}

/** Take a room out of the layout, leaving what's been dug as empty space. */
function removeRoom(layout: Layout, room: RoomInstance): void {
  for (const c of room.cells) layout.grid[c.floor - 1]![c.ring - 1]![c.slot] = 0;
  layout.rooms = layout.rooms.filter((r) => r !== room);
  recomputeAccess(layout);
  layout.version++;
}

function finish(state: SimState, job: Job, cfg: SimConfig): void {
  const layout = state.layout;
  const room = job.roomId !== undefined ? layout.rooms.find((r) => r.id === job.roomId) : undefined;
  if (job.digCells) openCells(layout, job.digCells);
  // An empty room is only ever a hole in the rock: done, it's empty space.
  if (job.kind === "room" && room && roomDef(room.type).excavationOnly) {
    removeRoom(layout, room);
    postMessage(state, cfg, `${roomDef(room.type).name} dug out.`);
    return;
  }
  if (job.kind === "room" && room) room.building = false;
  if (job.kind === "extend" && room) {
    room.cells = [...room.cells, ...(room.pendingCells ?? [])].sort((a, b) => a.floor - b.floor);
    delete room.pendingCells;
  }
  if (job.kind === "corridors") for (const id of job.edges ?? []) if (layout.corridorsBuilding?.[id] === job.id) delete layout.corridorsBuilding[id];
  if (job.kind === "fill") {
    for (const id of job.edges ?? []) {
      if (layout.corridorsFilling?.[id] !== job.id) continue;
      delete layout.corridorsFilling[id];
      delete layout.corridors[id];
    }
  }
  recomputeAccess(layout);
  layout.version++;
  if (job.kind !== "corridors" && job.kind !== "fill" && room) postMessage(state, cfg, `${roomDef(room.type).name} ${job.kind === "extend" ? "extended" : "built"}.`);
}

/** Each tick: bandwidth goes to the first job that can be worked, any left over to the next. */
export function stepConstruction(state: SimState, cfg: SimConfig): void {
  const c = state.construction;
  if (!c?.queue.length) return;
  let budget = (bandwidth(state) * 24) / cfg.ticksPerDay;
  for (const job of [...c.queue]) {
    if (budget <= 0) break;
    if (!workable(state, job)) continue;
    const use = Math.min(budget, job.work - job.done);
    const before = job.done;
    job.done += use;
    budget -= use;
    excavate(state, job, before, cfg);
    if (job.done >= job.work - 1e-9) {
      c.queue = c.queue.filter((j) => j !== job);
      finish(state, job, cfg);
    }
  }
}

/** Move a job to the front of the queue. */
export function prioritize(state: SimState, jobId: number): boolean {
  const c = state.construction;
  const job = c?.queue.find((j) => j.id === jobId);
  if (!c || !job) return false;
  c.queue = [job, ...c.queue.filter((j) => j !== job)];
  return true;
}

/** A room's job is cancelled (it was demolished or undone before it was built). */
export function dropRoomJobs(state: SimState, roomId: number): void {
  const c = state.construction;
  if (c) c.queue = c.queue.filter((j) => j.roomId !== roomId);
}

/** Corridors taken off the plan before they were built: out of their job. Returns those that were pending. */
export function dropCorridors(state: SimState, edges: string[], cfg: SimConfig): string[] {
  const layout = state.layout;
  const c = state.construction;
  const pending = edges.filter((id) => layout.corridorsBuilding?.[id] !== undefined);
  if (!pending.length || !c) return pending;
  for (const id of pending) {
    const job = c.queue.find((j) => j.id === layout.corridorsBuilding![id]);
    delete layout.corridorsBuilding![id];
    if (!job) continue;
    job.edges = (job.edges ?? []).filter((x) => x !== id);
    job.work = Math.max(job.done, corridorWork(layout, job.edges, cfg));
  }
  c.queue = c.queue.filter((j) => j.kind !== "corridors" || (j.edges ?? []).length);
  return pending;
}

/** Finish everything at once (sandbox, tests, and old saves). */
export function finishAll(state: SimState, cfg: SimConfig): void {
  for (const job of [...(state.construction?.queue ?? [])]) {
    const before = job.done;
    job.done = job.work;
    excavate(state, job, before, cfg);
    finish(state, job, cfg);
  }
  if (state.construction) state.construction.queue = [];
}

export interface JobView {
  id: number;
  kind: Job["kind"];
  roomId?: number;
  label: string;
  /** 0..1. */
  progress: number;
  /** Digging out rock first, or building. */
  phase: "excavating" | "building";
  work: number;
  /** Hours until it's done at today's bandwidth, counting the jobs ahead of it; null while it can't be worked. */
  hoursLeft: number | null;
}

/** The queue as the UI sees it: in order, with progress and when each will be done. */
export function queueView(state: SimState): { bandwidth: number; jobs: JobView[] } {
  const b = bandwidth(state);
  let ahead = 0;
  const jobs = (state.construction?.queue ?? []).map((job): JobView => {
    const room = job.roomId !== undefined ? state.layout.rooms.find((r) => r.id === job.roomId) : undefined;
    const name = room ? roomDef(room.type).name : "";
    const n = job.edges?.length ?? 0;
    const label =
      job.kind === "corridors"
        ? `Corridors (${n} ${n === 1 ? "segment" : "segments"})`
        : job.kind === "fill"
          ? `Filling in corridors (${n} ${n === 1 ? "segment" : "segments"})`
        : job.kind === "extend"
          ? `${name}: another floor`
          : phaseOf(job) === "excavating" && room && !roomDef(room.type).excavationOnly
            ? `${name} (excavating)`
            : name;
    const canWork = workable(state, job);
    if (canWork) ahead += job.work - job.done;
    return {
      id: job.id,
      kind: job.kind,
      ...(job.roomId !== undefined ? { roomId: job.roomId } : {}),
      label,
      progress: job.work > 0 ? job.done / job.work : 1,
      phase: phaseOf(job),
      work: job.work,
      hoursLeft: canWork ? ahead / b : null,
    };
  });
  return { bandwidth: b, jobs };
}
