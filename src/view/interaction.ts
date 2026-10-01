import type { SimCommand } from "../sim/commands";
import { config } from "../sim/config";
import { checkBuild } from "../sim/costs";
import { roomAt, type Layout, type Location } from "../sim/placement";
import { roomDef } from "../sim/rooms";
import { isOpen } from "../sim/excavation";
import { bulkheadRefusal, corridorCost, corridorRefusal, corridors, shortfall } from "../sim/corridors";
import type { Edge } from "../sim/edges";
import type { EdgeHover, HoverInfo, Pick, StageOptions, Tool } from "./types";

// The rules for turning "what's under the pointer" into hover info and
// actions. Both views use these, so building, demolishing and selecting
// behave the same in 2D and 3D; each view only has to produce a Pick.

export function surfaceSlotAt(angle: number, layout: Layout): number {
  return Math.floor((angle / 360) * layout.surface.length) % layout.surface.length;
}

/** Where the current build tool would put its room, for this pick. */
export function locationFor(p: Pick, t: Extract<Tool, { kind: "build" }>, layout: Layout): Location | null {
  if (roomDef(t.room).size === "surface") {
    return p.kind === "surface" ? { kind: "surface", slot: surfaceSlotAt(p.angle, layout) } : null;
  }
  if (p.kind !== "slot") return null;
  return { kind: "ring", floor: p.floor, ring: p.ring, slot: p.slot, w: t.shape[0], d: t.shape[1] };
}

export function hoverInfoFor(layout: Layout, resources: Record<string, number>, tool: Tool, p: Pick, gates: string[] = []): HoverInfo {
  const info: HoverInfo = { pick: p };
  if (tool?.kind === "build") {
    const at = locationFor(p, tool, layout);
    if (at) info.check = checkBuild(layout, resources, tool.room, at, config, gates);
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

/** The command for drawing (or erasing) a corridor on the border under the pointer. */
export function corridorCommand(tool: Tool, edge: EdgeHover | undefined): SimCommand | null {
  if (tool?.kind !== "corridor" || !edge) return null;
  if (tool.bulkhead) return { type: "setBulkhead", edges: [edge.id], on: !edge.erase };
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
  return JSON.stringify([coarse, info?.room?.id, info?.check, info?.edge, tool, layoutVersion, selected]);
}

/** What a click does with the current tool. */
export function clickWith(layout: Layout, tool: Tool, info: HoverInfo, opts: StageOptions): void {
  if (tool?.kind === "corridor") {
    const cmd = corridorCommand(tool, info.edge);
    if (cmd && !info.edge?.refusal) opts.onCommand?.(cmd);
    else if (info.edge?.refusal) opts.onInvalid?.(info.edge.refusal);
  } else if (tool?.kind === "build") {
    const at = locationFor(info.pick, tool, layout);
    // Over corridors: the player confirms first.
    if (at && info.check?.ok && info.check.destroys?.length) {
      opts.onConfirmBuild?.({ room: tool.room, at, destroys: info.check.destroys, strands: info.check.strands ?? { rooms: [], corridors: [] } });
    } else if (at && info.check?.ok) opts.onCommand?.({ type: "build", room: tool.room, at });
    else if (info.check && !info.check.ok) opts.onInvalid?.(info.check.reason);
  } else if (tool?.kind === "demolish" && info.room) {
    opts.onCommand?.({ type: "demolish", roomId: info.room.id });
  } else if (!tool) {
    opts.onSelect?.(info.room?.id ?? null);
  }
}

/** With the corridor tool, dragging draws (or erases) a corridor along every border it crosses. */
export function paints(tool: Tool): boolean {
  return tool?.kind === "corridor" && !tool.bulkhead;
}

/**
 * The command for painting a border while dragging. It's sent even if our
 * copy of the layout says no: the corridor just drawn beside it may not
 * have reached us yet, and the sim decides anyway.
 */
export function paintCommand(tool: Tool, edge: EdgeHover | undefined): SimCommand | null {
  return corridorCommand(tool, edge);
}
