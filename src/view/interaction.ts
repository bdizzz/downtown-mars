import type { SimCommand } from "../sim/commands";
import { checkBuild } from "../sim/costs";
import { roomAt, type Layout, type Location } from "../sim/placement";
import { roomDef } from "../sim/rooms";
import type { HoverInfo, Pick, StageOptions, Tool } from "./types";

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

export function hoverInfoFor(layout: Layout, resources: Record<string, number>, tool: Tool, p: Pick): HoverInfo {
  const info: HoverInfo = { pick: p };
  if (tool?.kind === "build") {
    const at = locationFor(p, tool, layout);
    if (at) info.check = checkBuild(layout, resources, tool.room, at);
    return info;
  }
  if (p.kind === "slot") info.room = roomAt(layout, p);
  if (p.kind === "surface") {
    const id = layout.surface[surfaceSlotAt(p.angle, layout)];
    info.room = layout.rooms.find((r) => r.id === id);
  }
  return info;
}

/** Changes only when what's shown for the hover would change, so views redraw sparingly. */
export function hoverKeyFor(info: HoverInfo | null, tool: Tool, layoutVersion: number, selected: number | null): string {
  const p = info?.pick;
  // The pointer's exact angle only matters on the surface, where it picks a surface slot.
  const coarse = p && p.kind !== "surface" && "angle" in p ? { ...p, angle: undefined } : p;
  return JSON.stringify([coarse, info?.room?.id, info?.check, tool, layoutVersion, selected]);
}

/** What a click does with the current tool. */
export function clickWith(layout: Layout, tool: Tool, info: HoverInfo, opts: StageOptions): void {
  if (tool?.kind === "build") {
    const at = locationFor(info.pick, tool, layout);
    if (at && info.check?.ok) opts.onCommand?.({ type: "build", room: tool.room, at });
    else if (info.check && !info.check.ok) opts.onInvalid?.(info.check.reason);
  } else if (tool?.kind === "demolish" && info.room) {
    opts.onCommand?.({ type: "demolish", roomId: info.room.id });
  } else if (!tool) {
    opts.onSelect?.(info.room?.id ?? null);
  }
}

/** With the corridor tool, dragging lays a corridor on every cell it crosses. */
export function paints(tool: Tool): boolean {
  return tool?.kind === "build" && tool.room === "corridor";
}

/**
 * The command for painting onto a cell. It's sent even if our copy of the
 * layout says no: the corridor just painted may not have reached us yet,
 * and the sim decides anyway.
 */
export function paintCommand(tool: Tool, p: Pick): SimCommand | null {
  if (tool?.kind !== "build" || p.kind !== "slot") return null;
  return { type: "build", room: tool.room, at: { kind: "ring", floor: p.floor, ring: p.ring, slot: p.slot, w: 1, d: 1 } };
}
