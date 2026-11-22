import type { SimCommand } from "../sim/commands";
import { config } from "../sim/config";
import { checkBuild } from "../sim/costs";
import { checkPlacement, roomAt, surfaceRoomId, type Cell, type Layout, type Location, type SurfaceSpot } from "../sim/placement";
import { roomDef } from "../sim/rooms";
import { effectName } from "../sim/effects";
import { isOpen } from "../sim/excavation";
import { bulkheadRefusal, corridorCost, corridorRefusal, corridors, inUnlockedRings, shortfall } from "../sim/corridors";
import { cellEdges, edgeById, edgeVertices, isGalleryEdge, type Edge } from "../sim/edges";
import { ringSize } from "../sim/geometry";
import { glazedAcross, glazedOnWall, roomForWindows, wallOf, windowComfort, windowCost, windowRefusal } from "../sim/windows";
import { corridorRefitPlan, corridorRefitRefusal, liningById, MATERIALS } from "../sim/materials";
import type { EdgeHover, HoverInfo, Pick, Proposal, StageOptions, Tool } from "./types";

/**
 * The effect a room in hand shows round itself while being placed (the halo): its strongest one that
 * spreads past its own walls. Null if it spreads none.
 */
export function haloEffect(type: string): { type: string; strength: number } | null {
  const effects = roomDef(type).effects.filter((e) => !e.residentsOnly && e.radius > 0);
  if (!effects.length) return null;
  const main = effects.reduce((a, b) => (Math.abs(b.strength) > Math.abs(a.strength) ? b : a));
  return { type: main.type, strength: main.strength };
}

/**
 * What the colours mean while placing a room (#438): "Green: fits · Red round it: the smell it spreads".
 * The halo's colours follow the colour-blind setting (orange and blue instead of red and green).
 */
export function placementLegend(type: string, colorBlind = false): string {
  const halo = haloEffect(type);
  if (!halo) return "Green: fits";
  const tint = halo.strength < 0 ? (colorBlind ? "Orange" : "Red") : colorBlind ? "Blue" : "Green";
  return `Green: fits · ${tint} round it: the ${effectName(halo.type).toLowerCase()} it spreads`;
}

// The rules for turning "what's under the pointer" into hover info and
// actions. Both views use these, so building, demolishing and selecting
// behave the same in 2D and 3D; each view only has to produce a Pick.

/** The surface spot at an angle on a surface ring (ring 1 if not given). */
export function surfaceSpotAt(angle: number, layout: Layout, ring = 1): SurfaceSpot {
  const r = Math.min(Math.max(1, ring), layout.surface.length);
  const n = layout.surface[r - 1]!.length;
  return { ring: r, slot: Math.floor((angle / 360) * n) % n };
}

/**
 * The surface spots a surface room could go on (T-107), on every surface ring (T-108): every slot in a
 * run of free ones wide enough for it. Empty for a room that goes inside the hole.
 */
export function surfaceSpots(layout: Layout, room: string): SurfaceSpot[] {
  if (roomDef(room).size !== "surface") return [];
  const out: SurfaceSpot[] = [];
  layout.surface.forEach((row, i) => {
    const ring = i + 1;
    const spots = new Set<number>();
    for (let slot = 0; slot < row.length; slot++) {
      const check = checkPlacement(layout, room, { kind: "surface", ring, slot });
      if (check.ok) check.surfaceCells.forEach((s) => spots.add(s));
    }
    for (const slot of [...spots].sort((a, b) => a - b)) out.push({ ring, slot });
  });
  return out;
}

/** Where the current build tool would put its room, for this pick. */
export function locationFor(p: Pick, t: Extract<Tool, { kind: "build" }>, layout: Layout): Location | null {
  if (roomDef(t.room).size === "surface") {
    return p.kind === "surface" ? { kind: "surface", ...surfaceSpotAt(p.angle, layout, p.ring) } : null;
  }
  if (p.kind !== "slot") return null;
  return { kind: "ring", floor: p.floor, ring: p.ring, slot: p.slot, w: t.shape[0], d: t.shape[1] };
}

export function hoverInfoFor(layout: Layout, resources: Record<string, number>, tool: Tool, p: Pick, gates: string[] = []): HoverInfo {
  const info: HoverInfo = { pick: p };
  if (tool?.kind === "build") {
    const at = locationFor(p, tool, layout);
    if (at) info.check = checkBuild(layout, resources, tool.room, at, config, gates, liningById(tool.lining));
    return info;
  }
  if (p.kind === "slot") info.room = roomAt(layout, p);
  if (p.kind === "surface") {
    const id = surfaceRoomId(layout, surfaceSpotAt(p.angle, layout, p.ring));
    info.room = layout.rooms.find((r) => r.id === id);
  }
  return info;
}

/** Hover info for the corridor tool: the border under the pointer, and what drawing (or erasing) it would do. */
export function edgeHoverFor(layout: Layout, resources: Record<string, number>, tool: Extract<Tool, { kind: "corridor" }>, p: Pick, edge: Edge | null, erase: boolean): HoverInfo {
  const info: HoverInfo = { pick: p };
  // Past the rings opened so far there's nothing to point at (#556).
  if (!edge || !inUnlockedRings(layout.hole, edge)) return info;
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
  if (removing) {
    info.edge = eraseHover(layout, resources, edge);
    return info;
  }
  // Drawing costs the chosen finish.
  const cost = finish ? {} : corridorCost(layout.hole, edge, tool.finish, config);
  const refusal = corridorRefusal(layout, edge.id) ?? shortfall(resources, cost);
  info.edge = { id: edge.id, refusal, cost, erase: false, ...(finish ? { finish, linked: !!layout.corridorLinked?.[edge.id] } : {}) };
  return info;
}

/** Filling in the corridor on a border: what it costs (the corridor's own finish, rebuilding the walls), or why not. */
function eraseHover(layout: Layout, resources: Record<string, number>, edge: Edge): EdgeHover {
  const finish = layout.corridors[edge.id];
  const cost = finish ? corridorCost(layout.hole, edge, finish, config) : {};
  const refusal = !finish ? "No corridor here to remove" : layout.corridorsFilling?.[edge.id] !== undefined ? "Already being filled in" : shortfall(resources, cost);
  return { id: edge.id, refusal, cost, erase: true, ...(finish ? { finish, linked: !!layout.corridorLinked?.[edge.id] } : {}) };
}

/** The floor-1 gallery tube the game starts with: demolish leaves it alone (#557). */
export function starterTube(e: Edge): boolean {
  return isGalleryEdge(e) && e.floor === 1;
}

/**
 * Hover info for the demolish tool (#557): the room under the pointer, or a corridor (tube, corridor or
 * bulkhead) when the pointer is on its strip or over no room. `near` is the border nearest the pointer
 * and how far off it is, in metres.
 */
export function demolishHoverFor(layout: Layout, resources: Record<string, number>, p: Pick, near: { edge: Edge; m: number } | null): HoverInfo {
  const info = hoverInfoFor(layout, resources, { kind: "demolish" }, p);
  const e = near?.edge;
  if (!e || !layout.corridors[e.id] || starterTube(e)) return info;
  // Rooms keep their interiors; corridors win on their own strip, half a corridor's width either side of the border.
  if (info.room && near.m > corridors.widthM / 2) return info;
  return { pick: p, edge: eraseHover(layout, resources, e) };
}

/** How corridor mode's map is drawn (#556), in every view: how faint the open borders are, and the tint on built corridors. */
export const CORRIDOR_MAP = { open: 0.07, built: 0x8fd0ff, builtAlpha: 0.2 };

/** A square joint where a spoke meets a ring's border, drawn once over the crossing (#556); `built` if a built corridor meets there. */
export interface MapJoint {
  /** Its vertex, as edgeVertices names it. */
  key: string;
  floor: number;
  circle: number;
  turn: number;
  built: boolean;
}

/**
 * For drawing the map in one even shade, with no notches (#556). As the scene squares off a corridor's turns
 * (corridorJoints), every crossing where a spoke meets a ring's border gets a joint, and the borders meeting
 * there stop short of it, so nothing lies over anything else. On the shaft wall there are no joints: a spoke
 * just stops short of the gallery tube. `trims` gives, for each border, which of its ends stop short, as
 * edgeVertices orders them (a spoke's inner end first; an arc's start first).
 */
export function mapJoints(layout: Layout, open: string[], built: string[]): { joints: MapJoint[]; trims: Map<string, [boolean, boolean]> } {
  const hole = layout.hole;
  const builtSet = new Set(built);
  const at = new Map<string, MapJoint & { radial: boolean; arc: boolean }>();
  const edges = [...open, ...built].flatMap((id) => edgeById(hole, id) ?? []);
  for (const e of edges) {
    for (const v of edgeVertices(hole, e)) {
      const [floor, circle, f] = v.split("|");
      const [p, q] = f!.split("/").map(Number);
      const k = at.get(v) ?? { key: v, floor: Number(floor), circle: Number(circle), turn: p! / q!, built: false, radial: false, arc: false };
      if (e.kind === "radial") k.radial = true;
      else k.arc = true;
      if (builtSet.has(e.id)) k.built = true;
      at.set(v, k);
    }
  }
  const joints: MapJoint[] = [];
  for (const k of at.values()) if (k.radial && k.arc && k.circle > 0) joints.push({ key: k.key, floor: k.floor, circle: k.circle, turn: k.turn, built: k.built });
  const trims = new Map<string, [boolean, boolean]>();
  for (const e of edges) {
    const ends = edgeVertices(hole, e).map((v) => {
      const k = at.get(v)!;
      return k.radial && k.arc && (k.circle > 0 || e.kind === "radial");
    });
    trims.set(e.id, [ends[0]!, ends[1]!]);
  }
  return { joints, trims };
}

/**
 * Corridor mode's map of a floor (#556): the borders a new corridor could go along (drawn faintly) and the
 * corridors already there, and the walk-through rooms (tinted). Erasing, refitting and bulkheads act on corridors already there, so they
 * show only those; the windows tool shows neither.
 */
export function corridorMap(layout: Layout, tool: Tool, floor: number): { open: string[]; built: string[]; publicCells: Cell[] } {
  if (tool?.kind !== "corridor" || tool.windows) return { open: [], built: [], publicCells: [] };
  const hole = layout.hole;
  const all = new Map<string, Edge>();
  for (let ring = 1; ring <= Math.min(hole.unlockedRings, hole.ringSlots.length); ring++) {
    for (let slot = 0; slot < ringSize(hole, ring); slot++) for (const e of cellEdges(hole, { floor, ring, slot })) all.set(e.id, e);
  }
  const built = [...all.keys()].filter((id) => layout.corridors[id]);
  const drawing = !tool.erase && !tool.refit && !tool.bulkhead;
  const open = drawing ? [...all.keys()].filter((id) => !corridorRefusal(layout, id)) : [];
  // Walk-through rooms (plazas, stairs, lifts, the entrance, empty rooms) carry people between corridors: shaded as corridors are.
  const publicCells = layout.rooms.filter((r) => !r.planned && roomDef(r.type).public).flatMap((r) => r.cells.filter((c) => c.floor === floor));
  return { open, built, publicCells };
}

/** Hover info for the windows tool: the wall of a room under the pointer, and what glazing (or clearing) it would do. */
function windowHover(layout: Layout, resources: Record<string, number>, p: Pick, edge: Edge, removing: boolean): HoverInfo {
  const near = p.kind === "slot" ? { floor: p.floor, ring: p.ring, slot: p.slot } : null;
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
 * bare rock only in Build mode, where it's somewhere to put a room. Never with the
 * corridor tool, which points at borders, not slots (#556).
 */
export function highlightsSlot(layout: Layout, p: Extract<Pick, { kind: "slot" }>, building: boolean, tool: Tool = null): boolean {
  if (tool?.kind === "corridor") return false;
  return building || isOpen(layout, p);
}

/** Changes only when what's shown for the hover would change, so views redraw sparingly. */
export function hoverKeyFor(info: HoverInfo | null, tool: Tool, layoutVersion: number, selected: number | null): string {
  const p = info?.pick;
  // The pointer's exact angle only matters on the surface, where it picks a surface slot.
  const coarse = p && p.kind !== "surface" && "angle" in p ? { ...p, angle: undefined } : p;
  return JSON.stringify([coarse, info?.room?.id, info?.check, info?.edge, tool, layoutVersion, selected]);
}

/**
 * The key a second tap must match to act (tap to aim). Like the hover key, but on the
 * surface by slot rather than the exact angle, which no two finger taps share.
 */
export function aimKeyFor(info: HoverInfo, tool: Tool, layout: Layout): string {
  const p = info.pick;
  const pick: Pick = p.kind === "surface" ? { ...p, angle: surfaceSpotAt(p.angle, layout, p.ring).slot } : p;
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
    const at = locationFor(info.pick, tool, layout);
    // Over corridors: the player confirms first.
    if (at && info.check?.ok && info.check.destroys?.length) {
      opts.onConfirmBuild?.({ room: tool.room, at, destroys: info.check.destroys, strands: info.check.strands ?? { rooms: [], corridors: [] }, ...liningFields(tool.lining) });
    } else if (at && info.check?.ok) opts.onCommand?.({ type: "build", room: tool.room, at, ...liningFields(tool.lining) });
    else if (info.check && !info.check.ok) opts.onInvalid?.(info.check.reason);
  } else if (tool?.kind === "demolish" && info.edge) {
    if (info.edge.refusal) opts.onInvalid?.(info.edge.refusal);
    else opts.onCommand?.({ type: "removeCorridors", edges: [info.edge.id] });
  } else if (tool?.kind === "demolish" && info.room) {
    opts.onCommand?.({ type: "demolish", roomId: info.room.id });
  } else if (!tool) {
    opts.onSelect?.(info.room?.id ?? null);
  }
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
