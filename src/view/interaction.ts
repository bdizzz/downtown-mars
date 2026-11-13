import type { SimCommand } from "../sim/commands";
import { config } from "../sim/config";
import { checkBuild } from "../sim/costs";
import { checkPlacement, depthsFor, roomAt, type Layout, type Spot } from "../sim/placement";
import { dragSide, fillGap, notchesFor, placeAt } from "../sim/snap";
import { roomDef } from "../sim/rooms";
import { isOpen } from "../sim/excavation";
import { bulkheadRefusal, corridorCost, corridorRefusal, corridors, shortfall } from "../sim/corridors";
import type { Edge } from "../sim/edges";
import { glazedAcross, glazedOnWall, roomForWindows, wallOf, windowComfort, windowCost, windowRefusal } from "../sim/windows";
import { corridorRefitPlan, corridorRefitRefusal, liningById, MATERIALS } from "../sim/materials";
import type { EdgeHover, HoverInfo, Pick, Proposal, RoomProposal, StageOptions, Tool } from "./types";

// The rules for turning "what's under the pointer" into hover info and
// actions. Both views use these, so building, demolishing and selecting
// behave the same in 2D and 3D; each view only has to produce a Pick.

export function surfaceSlotAt(angle: number, layout: Layout): number {
  return Math.floor((angle / 360) * layout.surface.length) % layout.surface.length;
}

/**
 * The surface slots a surface room could go on (T-107): every slot in a run of free ones wide enough for it.
 * Empty for a room that goes inside the hole.
 */
export function surfaceSpots(layout: Layout, room: string): number[] {
  if (roomDef(room).size !== "surface") return [];
  const spots = new Set<number>();
  for (let slot = 0; slot < layout.surface.length; slot++) {
    const check = checkPlacement(layout, room, { kind: "surface", slot });
    if (check.ok) check.surfaceCells.forEach((s) => spots.add(s));
  }
  return [...spots].sort((a, b) => a - b);
}

const N = config.geometry.notchesPerTurn;

/** A pick's pointer angle, in notches. */
export const pickNotch = (p: { angle: number }) => (((p.angle % 360) + 360) % 360) * (N / 360);

/** Does this room type go down as a proposal first (a ring room that isn't a stack piece)? */
function proposes(t: Extract<Tool, { kind: "build" }>): boolean {
  const def = roomDef(t.room);
  return def.size !== "surface" && !def.stacks;
}

/** Where the current build tool would put its room, for this pick, and what it snapped to. */
export function placementFor(p: Pick, t: Extract<Tool, { kind: "build" }>, layout: Layout): { at: Spot; ticks: number[] } | null {
  if (roomDef(t.room).size === "surface") {
    return p.kind === "surface" ? { at: { kind: "surface", slot: surfaceSlotAt(p.angle, layout) }, ticks: [] } : null;
  }
  if (p.kind !== "slot") return null;
  const depth = depthsFor(t.room).includes(t.depth) ? t.depth : depthsFor(t.room)[0]!;
  const placed = placeAt(layout, t.room, p.floor, p.ring, depth, pickNotch(p), t.snap !== false);
  return { at: { kind: "ring", floor: p.floor, ring: p.ring, depth, start: placed.start, span: placed.span }, ticks: placed.ticks };
}

/** Where the current build tool would put its room, for this pick. */
export function locationFor(p: Pick, t: Extract<Tool, { kind: "build" }>, layout: Layout): Spot | null {
  return placementFor(p, t, layout)?.at ?? null;
}

/** How near a proposal's side wall the pointer must be to grab it, metres. */
const HANDLE_M = 1.5;

/** Which of a proposal's side walls the pointer is on, if either. */
export function handleAt(layout: Layout, proposal: RoomProposal, p: Pick): "start" | "end" | undefined {
  if (p.kind !== "slot" || p.floor !== proposal.floor || p.ring < proposal.ring || p.ring >= proposal.ring + proposal.depth) return undefined;
  const tol = notchesFor(layout, p.ring, 1, HANDLE_M);
  const off = (a: number) => Math.abs(((((pickNotch(p) - a) % N) + N + N / 2) % N) - N / 2);
  const ds = off(proposal.start);
  const de = off(proposal.start + proposal.span);
  if (Math.min(ds, de) > tol) return undefined;
  return ds <= de ? "start" : "end";
}

/** Is the pointer on the proposal itself (a second click there builds it)? */
export function onProposal(proposal: RoomProposal, p: Pick): boolean {
  if (p.kind !== "slot" || p.floor !== proposal.floor || p.ring < proposal.ring || p.ring >= proposal.ring + proposal.depth) return false;
  return (((pickNotch(p) - proposal.start) % N) + N) % N < proposal.span;
}

/** A proposal with one side wall dragged to the pointer. */
export function dragProposal(layout: Layout, t: Extract<Tool, { kind: "build" }>, side: "start" | "end", p: Pick): RoomProposal | null {
  if (!t.proposal || !("angle" in p)) return null;
  const placed = dragSide(layout, t.room, t.proposal, side, pickNotch(p), t.snap !== false);
  return { ...t.proposal, start: placed.start, span: placed.span };
}

export function hoverInfoFor(layout: Layout, resources: Record<string, number>, tool: Tool, p: Pick, gates: string[] = []): HoverInfo {
  const info: HoverInfo = { pick: p };
  if (tool?.kind === "build") {
    // A proposal that's down is what's being looked at, wherever the pointer is.
    const placed = tool.proposal ? { at: tool.proposal, ticks: [] } : placementFor(p, tool, layout);
    if (placed) {
      info.at = placed.at;
      if (placed.ticks.length) info.ticks = placed.ticks;
      info.check = checkBuild(layout, resources, tool.room, placed.at, config, gates, liningById(tool.lining));
    }
    if (tool.proposal) {
      const handle = handleAt(layout, tool.proposal, p);
      if (handle) info.handle = handle;
    }
    return info;
  }
  if (p.kind === "slot") info.room = roomAt(layout, p);
  if (p.kind === "surface") {
    const id = layout.surface[surfaceSlotAt(p.angle, layout)];
    info.room = layout.rooms.find((r) => r.id === id);
  }
  return info;
}

/** Hover info for the corridor tool: the border under the pointer, and what drawing (or erasing) it would do. */
export function edgeHoverFor(layout: Layout, resources: Record<string, number>, tool: Extract<Tool, { kind: "corridor" }>, p: Pick, edge: Edge | null, erase: boolean): HoverInfo {
  const info: HoverInfo = { pick: p };
  if (!edge) return info;
  const finish = layout.corridors[edge.id];
  const removing = erase || tool.erase;
  if (tool.windows) return windowHover(layout, resources, p, edge, removing);
  if (tool.refit) {
    const to = liningById(tool.refit) ?? MATERIALS.walls[0]!;
    const refusal = corridorRefitRefusal(layout, edge.id, to);
    const cost = refusal ? {} : (corridorRefitPlan(layout, edge.id, to, config)?.cost ?? {});
    info.edge = { id: edge.id, refusal: refusal ?? shortfall(resources, cost), cost, erase: false, refit: tool.refit, ...(finish ? { finish, linked: !!layout.corridorLinked?.[edge.id] } : {}) };
    return info;
  }
  if (tool.bulkhead) {
    const refusal = bulkheadRefusal(layout, edge.id, !removing) ?? (removing ? null : shortfall(resources, corridors.bulkhead.cost));
    info.edge = { id: edge.id, refusal, cost: removing ? {} : corridors.bulkhead.cost, erase: removing, bulkhead: true, ...(finish ? { finish, linked: !!layout.corridorLinked?.[edge.id] } : {}) };
    return info;
  }
  let refusal: string | null;
  if (removing) refusal = !finish ? "No corridor here to remove" : layout.corridorsFilling?.[edge.id] !== undefined ? "Already being filled in" : null;
  else refusal = corridorRefusal(layout, edge.id);
  // Drawing costs the chosen finish; removing costs the corridor's own (rebuilding the walls).
  const cost = removing ? (finish ? corridorCost(layout.hole, edge, finish, config) : {}) : finish ? {} : corridorCost(layout.hole, edge, tool.finish, config);
  if (!refusal) refusal = shortfall(resources, cost);
  info.edge = { id: edge.id, refusal, cost, erase: removing, ...(finish ? { finish, linked: !!layout.corridorLinked?.[edge.id] } : {}) };
  return info;
}

/** Hover info for the windows tool: the wall of a room under the pointer, and what glazing (or clearing) it would do. */
function windowHover(layout: Layout, resources: Record<string, number>, p: Pick, edge: Edge, removing: boolean): HoverInfo {
  const near = p.kind === "slot" ? { floor: p.floor, ring: p.ring, a0: p.a0, a1: p.a1 } : null;
  const room = roomForWindows(layout, edge.id, near);
  const wall = room ? (removing ? glazedOnWall(layout, room, edge.id) : (wallOf(layout, room, edge.id) ?? [])) : [];
  const ids = wall.map((e) => e.id);
  let refusal = windowRefusal(room, ids, !removing);
  const fresh = room ? wall.filter((e) => !room.windows?.includes(e.id)) : [];
  const cost = removing || !fresh.length ? {} : windowCost(layout, fresh);
  if (!refusal) refusal = shortfall(resources, cost);
  const across = room && wall[0] ? glazedAcross(layout, room, wall[0]) : null;
  // What a home would get from it: its comfort from windows, with this wall's in (or out).
  const comfort = room && roomDef(room.type).houses && !refusal ? windowComfort(layout, { ...room, windows: removing ? room.windows?.filter((id) => !ids.includes(id)) : [...new Set([...(room.windows ?? []), ...ids])] }) : null;
  return { pick: p, edge: { id: edge.id, refusal, cost, erase: removing, windows: { roomId: room?.id ?? 0, edges: ids.length ? ids : [edge.id], across, comfort } } };
}

/** The command for drawing (or erasing) a corridor on the border under the pointer. */
export function corridorCommand(tool: Tool, edge: EdgeHover | undefined): SimCommand | null {
  if (tool?.kind !== "corridor" || !edge) return null;
  if (tool.windows) return edge.windows?.roomId ? { type: "setWindows", roomId: edge.windows.roomId, edges: edge.windows.edges, on: !edge.erase } : null;
  if (tool.bulkhead) return { type: "setBulkhead", edges: [edge.id], on: !edge.erase };
  if (tool.refit) return refitCommand([edge.id], tool.refit);
  return edge.erase ? { type: "removeCorridors", edges: [edge.id] } : { type: "drawCorridors", edges: [edge.id], finish: tool.finish };
}

/**
 * Does an empty slot under the pointer light up? Dug-out space always does;
 * bare rock only in Build mode, where it's somewhere to put a room.
 */
export function highlightsSlot(layout: Layout, p: Extract<Pick, { kind: "slot" }>, building: boolean): boolean {
  return building || isOpen(layout, p);
}

/** Changes only when what's shown for the hover would change, so views redraw sparingly. */
export function hoverKeyFor(info: HoverInfo | null, tool: Tool, layoutVersion: number, selected: number | null): string {
  const p = info?.pick;
  // The pointer's exact angle only matters on the surface, where it picks a surface slot.
  const coarse = p && p.kind !== "surface" && "angle" in p ? { ...p, angle: undefined } : p;
  return JSON.stringify([coarse, info?.room?.id, info?.check, info?.at, info?.ticks, info?.handle, info?.edge, tool, layoutVersion, selected]);
}

/**
 * The key a second tap must match to act (tap to aim). Like the hover key, but on the
 * surface by slot rather than the exact angle, which no two finger taps share.
 */
export function aimKeyFor(info: HoverInfo, tool: Tool, layout: Layout): string {
  const p = info.pick;
  const pick: Pick = p.kind === "surface" ? { ...p, angle: surfaceSlotAt(p.angle, layout) } : p;
  return hoverKeyFor({ ...info, pick }, tool, 0, null);
}

/** A build tool's lining as the build command takes it: its material and finish (nothing for bare rock). */
export function liningFields(lining: string | undefined): { material?: string; finish?: string } {
  const step = liningById(lining);
  return step && step !== MATERIALS.walls[0] ? { material: step.material, finish: step.finish } : {};
}

/** What a click does with the current tool. */
export function clickWith(layout: Layout, tool: Tool, info: HoverInfo, opts: StageOptions): void {
  if (tool?.kind === "corridor") {
    const cmd = corridorCommand(tool, info.edge);
    if (cmd && !info.edge?.refusal) opts.onCommand?.(cmd);
    else if (info.edge?.refusal) opts.onInvalid?.(info.edge.refusal);
  } else if (tool?.kind === "build") {
    // A proposal is down: a click on it builds it; a click elsewhere moves it there.
    if (tool.proposal && onProposal(tool.proposal, info.pick)) {
      commitBuild(tool, info, opts);
      return;
    }
    const placed = placementFor(info.pick, tool, layout);
    if (!placed) {
      if (info.check && !info.check.ok && !tool.proposal) opts.onInvalid?.(info.check.reason);
      return;
    }
    // A ring room goes down as a proposal first, its side walls on handles; stairs, elevators and surface rooms are built at once.
    if (placed.at.kind === "ring" && proposes(tool) && opts.onProposeRoom) {
      opts.onProposeRoom({ kind: "ring", floor: placed.at.floor, ring: placed.at.ring, depth: placed.at.depth ?? 1, start: placed.at.start, span: placed.at.span ?? 1 });
      return;
    }
    commitBuild(tool, info, opts);
  } else if (tool?.kind === "demolish" && info.room) {
    opts.onCommand?.({ type: "demolish", roomId: info.room.id });
  } else if (!tool) {
    opts.onSelect?.(info.room?.id ?? null);
  }
}

/** Build what the hover shows (the proposal, or the room at the pointer): asking first if it would fill in corridors, saying why if it can't go. */
export function commitBuild(tool: Extract<Tool, { kind: "build" }>, info: HoverInfo, opts: StageOptions): boolean {
  const at = info.at;
  if (!at || !info.check) return false;
  if (!info.check.ok) {
    opts.onInvalid?.(info.check.reason);
    return false;
  }
  if (info.check.destroys?.length) {
    opts.onConfirmBuild?.({ room: tool.room, at, destroys: info.check.destroys, strands: info.check.strands ?? { rooms: [], corridors: [] }, ...liningFields(tool.lining) });
  } else opts.onCommand?.({ type: "build", room: tool.room, at, ...liningFields(tool.lining) });
  opts.onProposeRoom?.(null);
  return true;
}

/**
 * Double-clicking a gap with a fill room selected fills it, wall to wall (PLAN-M17). True if the
 * double click was taken (built, or refused with a reason); false if it isn't a fill room's.
 */
export function fillAt(layout: Layout, resources: Record<string, number>, tool: Tool, p: Pick, opts: StageOptions, gates: string[] = []): boolean {
  if (tool?.kind !== "build" || !roomDef(tool.room).fill || p.kind !== "slot") return false;
  const fill = fillGap(layout, tool.room, p.floor, p.ring, pickNotch(p));
  if (!fill.ok) {
    opts.onInvalid?.(fill.reason);
    return true;
  }
  const at: Spot = { kind: "ring", floor: p.floor, ring: p.ring, depth: depthsFor(tool.room)[0]!, start: fill.start, span: fill.span };
  const check = checkBuild(layout, resources, tool.room, at, config, gates, liningById(tool.lining));
  commitBuild(tool, { pick: p, at, check }, opts);
  return true;
}

/**
 * What to mark on a room being placed: the two side walls of a proposal that's down (its handles, as
 * radial edge ids), and the lines it snapped to (ticks: an angle, across its rings and the one either side).
 */
export function placingMarks(layout: Layout, tool: Tool, info: HoverInfo): { handles: string[]; ticks: { floor: number; notch: number; ring0: number; ring1: number }[] } {
  const at = info.at;
  if (tool?.kind !== "build" || !at || at.kind !== "ring") return { handles: [], ticks: [] };
  const depth = at.depth ?? 1;
  const span = at.span ?? 0;
  const rings = layout.hole.ringSlots.length;
  const handles: string[] = [];
  if (tool.proposal) {
    for (let r = at.ring; r < at.ring + depth; r++) handles.push(`R${at.floor}.${r}.${((at.start % N) + N) % N}`, `R${at.floor}.${r}.${(at.start + span) % N}`);
  }
  // A tick is a thin line across the room's rings and the one either side: what it lined up with.
  const ticks = (info.ticks ?? []).map((t) => ({ floor: at.floor, notch: ((t % N) + N) % N, ring0: Math.max(1, at.ring - 1), ring1: Math.min(rings, at.ring + depth) }));
  return { handles, ticks };
}

/** Tells a double click (or double tap) from two clicks: the second within this long and this near the first. */
export class DoubleClick {
  private last = { t: -Infinity, x: 0, y: 0 };
  /** Note a click; true if it's the second of a double. */
  click(x: number, y: number, now = performance.now()): boolean {
    const double = now - this.last.t < 350 && Math.hypot(x - this.last.x, y - this.last.y) < 12;
    this.last = double ? { t: -Infinity, x, y } : { t: now, x, y };
    return double;
  }
}

/**
 * A click with the current tool; with a fill room in hand, the second click of a double click fills the
 * gap under the pointer wall to wall instead (PLAN-M17). The first click's proposal is dropped for it.
 */
export function clickOrFill(layout: Layout, resources: Record<string, number>, tool: Tool, info: HoverInfo, opts: StageOptions, gates: string[], double: boolean): void {
  if (double && tool?.kind === "build" && roomDef(tool.room).fill && info.pick.kind === "slot") {
    const { proposal: _dropped, ...bare } = tool;
    opts.onProposeRoom?.(null);
    if (fillAt(layout, resources, bare, info.pick, opts, gates)) return;
  }
  clickWith(layout, tool, info, opts);
}

/** With the corridor tool, dragging draws (or erases, or refits) a corridor along every border it crosses. */
export function paints(tool: Tool): boolean {
  return tool?.kind === "corridor" && !tool.bulkhead && !tool.windows;
}

/** Does a snaked chain follow built corridors (filling in, or refitting) rather than carve new ones? */
export function followsCorridors(tool: Tool, shift: boolean): boolean {
  return tool?.kind === "corridor" && (shift || tool.erase || !!tool.refit);
}

/** The proposal a released chain makes: to carve, fill in, or refit in the tool's lining. */
export function proposalFor(tool: Tool, edges: string[], follows: boolean): Proposal {
  const refit = tool?.kind === "corridor" ? tool.refit : undefined;
  return refit ? { edges, erase: false, refit } : { edges, erase: follows };
}

/** Refit these corridor segments in a lining, by its id ("brick_fine"). */
export function refitCommand(edges: string[], lining: string): SimCommand {
  const to = liningById(lining) ?? MATERIALS.walls[0]!;
  return { type: "refitCorridors", edges, material: to.material, finish: to.finish };
}

/**
 * The command for painting a border while dragging. It's sent even if our
 * copy of the layout says no: the corridor just drawn beside it may not
 * have reached us yet, and the sim decides anyway.
 */
export function paintCommand(tool: Tool, edge: EdgeHover | undefined): SimCommand | null {
  return corridorCommand(tool, edge);
}
