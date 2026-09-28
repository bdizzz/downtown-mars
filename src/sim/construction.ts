import raw from "../../data/construction.json";
import type { SimConfig } from "./config";
import { recomputeAccess } from "./corridors";
import { edgeById, edgeLengthM } from "./edges";
import { isActive } from "./economy";
import { postMessage } from "./messages";
import type { Cell, Layout, RoomInstance } from "./placement";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

// Construction time. Everything the player commits to goes into the hole's
// queue and is built one job at a time, in order, at the hole's construction
// bandwidth (work-hours per game hour). Construction offices add bandwidth.
// Until a job is done, its room holds its slots but doesn't run, and its
// corridors don't join the network.

export const construction = raw as unknown as {
  instant: boolean;
  baseBandwidth: number;
  hoursBySize: Record<string, number>;
  corridorHoursPer10m: number;
};

export interface Job {
  id: number;
  /** A room, a set of corridor segments, or more floors for stairs or an elevator. */
  kind: "room" | "corridors" | "extend";
  roomId?: number;
  edges?: string[];
  /** Work needed and done, in work-hours. */
  work: number;
  done: number;
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

/** A room just committed: under construction until its job is done. */
export function queueRoom(state: SimState, room: RoomInstance): void {
  const job = add(state, { kind: "room", roomId: room.id, work: roomWork(room.type) });
  if (job) room.building = true;
}

/** Stairs or an elevator reaching further: the new floors join when built. */
export function queueExtension(state: SimState, room: RoomInstance, cells: Cell[]): void {
  const job = add(state, { kind: "extend", roomId: room.id, work: roomWork(room.type) });
  if (!job) return;
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

/** The job building this room (or extending it), if any. */
export function jobForRoom(state: SimState, roomId: number): Job | undefined {
  return state.construction?.queue.find((j) => j.roomId === roomId);
}

/** Can the crews work on this job yet? A blueprint on a floor still being dug waits. */
function workable(state: SimState, job: Job): boolean {
  if (job.kind === "corridors") return (job.edges ?? []).every((id) => (edgeById(state.layout.hole, id)?.floor ?? 0) <= state.layout.hole.floors);
  const room = state.layout.rooms.find((r) => r.id === job.roomId);
  return !!room && !room.planned;
}

function finish(state: SimState, job: Job, cfg: SimConfig): void {
  const layout = state.layout;
  const room = job.roomId !== undefined ? layout.rooms.find((r) => r.id === job.roomId) : undefined;
  if (job.kind === "room" && room) room.building = false;
  if (job.kind === "extend" && room) {
    room.cells = [...room.cells, ...(room.pendingCells ?? [])].sort((a, b) => a.floor - b.floor);
    delete room.pendingCells;
  }
  if (job.kind === "corridors") for (const id of job.edges ?? []) if (layout.corridorsBuilding?.[id] === job.id) delete layout.corridorsBuilding[id];
  recomputeAccess(layout);
  layout.version++;
  if (job.kind !== "corridors" && room) postMessage(state, cfg, `${roomDef(room.type).name} ${job.kind === "extend" ? "extended" : "built"}.`);
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
    job.done += use;
    budget -= use;
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
  for (const job of [...(state.construction?.queue ?? [])]) finish(state, job, cfg);
  if (state.construction) state.construction.queue = [];
}
