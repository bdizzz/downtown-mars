import * as THREE from "three";
import { config } from "../sim/config";
import { checkBuild, missingCost, siteRefusal } from "../sim/costs";
import { holeGates } from "../sim/people";
import { roomDefs } from "../sim/rooms";
import type { SimCommand } from "../sim/commands";
import type { SimState } from "../sim/state";
import type { Location } from "../sim/placement";
import { floorSpan, pickAt, RING_D, TAU } from "../render3d/cylinder";
import { corridorStripGeometry, roomGeometry } from "../render3d/rooms3d";
import { corridors } from "../sim/corridors";
import { nearestEdge } from "../sim/edges";
import { CATEGORY_NAMES, CATEGORY_ORDER, HOTKEYS, shapesFor } from "../view/buildCatalog";
import { corridorCommand, edgeHoverFor, locationFor } from "../view/interaction";
import { resName } from "../ui/format";

// Building from the Godot viewer, by the web game's rules (view/interaction.ts, sim/costs.ts): the
// palette of rooms and whether each can be built here and now; what placing one at the pointer
// would do (a ghost of its footprint, its cost, or why not); and the command to build it.

export interface PaletteRoom {
  id: string;
  name: string;
  category: string;
  /** Its shapes, [width in slots, depth in rings]; surface rooms have one. */
  shapes: [number, number][];
  surface: boolean;
  cost: string;
  key?: string;
  /** Why it can't be built in this hole (a deposit or a milestone it waits on), or what it's short of. */
  locked?: string;
  short?: string;
}

export interface PaletteMessage {
  type: "palette";
  categories: { id: string; name: string }[];
  rooms: PaletteRoom[];
  /** The corridor tool (in Access): its finishes, and bulkheads and windows, with what they cost. */
  corridors: { finishes: { id: string; name: string; cost: string; hint: string }[]; bulkhead: string; windows: string };
}

const costText = (cost: Record<string, number>) =>
  Object.entries(cost)
    .map(([id, v]) => `${resName(id)} ${v}`)
    .join(", ") || "Free";

export function palette(state: SimState): PaletteMessage {
  const gates = holeGates(state);
  const rooms = roomDefs
    .filter((d) => d.buildable)
    .map((d) => ({
      id: d.id,
      name: d.name,
      category: d.category,
      shapes: shapesFor(d),
      surface: d.size === "surface",
      cost: costText(d.cost),
      ...(HOTKEYS[d.id] ? { key: HOTKEYS[d.id] } : {}),
      ...(siteRefusal(d.id, gates) ? { locked: siteRefusal(d.id, gates)! } : {}),
      ...(missingCost(state.resources, d.id) ? { short: missingCost(state.resources, d.id)! } : {}),
    }));
  const used = new Set(rooms.map((r) => r.category));
  used.add("circulation");
  return {
    type: "palette",
    categories: CATEGORY_ORDER.filter((c) => used.has(c)).map((id) => ({ id, name: CATEGORY_NAMES[id] ?? id })),
    rooms,
    corridors: {
      finishes: corridors.finishes.map((f) => ({ id: f.id, name: f.name, cost: `${costText(f.cost)} per 10 m`, hint: f.hint })),
      bulkhead: `${costText(corridors.bulkhead.cost)} each`,
      windows: `${costText(config.windows.costPer10m)} per 10 m`,
    },
  };
}

/** What changes the palette: the gates, and which rooms the stocks can pay for. */
export function paletteKey(state: SimState): string {
  return state.holeId + ":" + holeGates(state).join(",") + ":" + roomDefs.map((d) => (d.buildable && missingCost(state.resources, d.id) ? 1 : 0)).join("");
}

export interface BuildTool {
  room: string;
  shape: [number, number];
}

function locate(state: SimState, tool: BuildTool, at: [number, number, number]): Location | null {
  return locationFor(pickAt(state.layout.hole, ...at), { kind: "build", room: tool.room, shape: tool.shape }, state.layout);
}

export interface HoveredMessage {
  type: "hovered";
  ok: boolean;
  /** Why not, or (when it can go) a note on what it does, like extending stairs. */
  text: string;
  cost: string;
  /** Its footprint as triangles (float32 xyz, base64), to show where it would go. */
  ghost?: string;
}

export function hover(state: SimState, tool: BuildTool, at: [number, number, number]): HoveredMessage {
  const where = locate(state, tool, at);
  const def = roomDefs.find((d) => d.id === tool.room);
  const cost = def ? costText(def.cost) : "";
  if (!where) return { type: "hovered", ok: false, text: def?.size === "surface" ? "Goes on the surface" : "Point at a slot in the hole", cost };
  const check = checkBuild(state.layout, state.resources, tool.room, where, config, holeGates(state));
  let text = check.ok ? (check.note ?? (check.planned ? "A blueprint: builds when its floor is dug" : check.unconnected ? "No corridor reaches it yet: it won't work until one does" : "")) : check.reason;
  if (check.ok && check.destroys?.length) text = `Cuts through ${check.destroys.length} corridor segment${check.destroys.length > 1 ? "s" : ""}`;
  let ghost: string | undefined;
  if (check.cells.length) {
    const geo = roomGeometry(state.layout, check.cells, 0.1, false);
    const g = geo.index ? geo.toNonIndexed() : geo;
    ghost = Buffer.from(new Float32Array((g.getAttribute("position") as THREE.BufferAttribute).array).buffer).toString("base64");
    geo.dispose();
    g.dispose();
  }
  return { type: "hovered", ok: check.ok, text, cost, ...(ghost ? { ghost } : {}) };
}

/** The command for a click with the tool: build it, or (cutting through corridors) only once confirmed; or why not. */
export function place(state: SimState, tool: BuildTool, at: [number, number, number], confirmed: boolean): { command?: SimCommand; confirm?: string; refusal?: string } {
  const where = locate(state, tool, at);
  if (!where) return { refusal: "Point at a slot in the hole" };
  const check = checkBuild(state.layout, state.resources, tool.room, where, config, holeGates(state));
  if (!check.ok) return { refusal: check.reason };
  if (check.destroys?.length && !confirmed) {
    const stranded = check.strands?.rooms.length ?? 0;
    return { confirm: `This cuts through ${check.destroys.length} corridor segment${check.destroys.length > 1 ? "s" : ""}${stranded ? `, cutting off ${stranded} room${stranded > 1 ? "s" : ""}` : ""}. Build it anyway?` };
  }
  return { command: { type: "build", room: tool.room, at: where, ...(confirmed ? { confirmed: true } : {}) } };
}

// ---- corridors, bulkheads and windows: the border under the pointer ----

export interface CorridorTool {
  finish: string;
  erase: boolean;
  bulkhead?: boolean;
  windows?: boolean;
}

/** The border nearest a world point, as the web view finds it (stage3d.ts edgeAtPick). */
function edgeAt(state: SimState, at: [number, number, number]) {
  const hole = state.layout.hole;
  const p = pickAt(hole, ...at);
  if (p.kind !== "slot" && p.kind !== "gallery") return { pick: p, edge: null };
  const rings = Math.max(0.001, (Math.hypot(at[0], at[2]) - hole.shaftRadiusM) / RING_D);
  return { pick: p, edge: nearestEdge(hole, p.floor, rings, Math.atan2(at[2], at[0]) / TAU, RING_D) };
}

export interface EdgeHoveredMessage {
  type: "edgeHovered";
  ok: boolean;
  text: string;
  cost: string;
  /** The border's strip (where the corridor would run), as triangles: float32 xyz, base64. */
  strip?: string;
}

/** What the tool would do at the border under the pointer: its cost, or why not (view/interaction.ts edgeHoverFor). */
export function edgeHover(state: SimState, tool: CorridorTool, at: [number, number, number]): EdgeHoveredMessage {
  const { pick, edge } = edgeAt(state, at);
  if (!edge || !("floor" in pick)) return { type: "edgeHovered", ok: false, text: "Point at a border between cells", cost: "" };
  const info = edgeHoverFor(state.layout, state.resources, { kind: "corridor", ...tool }, pick, edge, tool.erase).edge;
  const geo = corridorStripGeometry(state.layout, edge, floorSpan(pick.floor)[0] + 0.08);
  const strip = Buffer.from(new Float32Array((geo.getAttribute("position") as THREE.BufferAttribute).array).buffer).toString("base64");
  geo.dispose();
  const what = tool.windows ? "Windows" : tool.bulkhead ? "Bulkhead" : "Corridor";
  return {
    type: "edgeHovered",
    ok: !info?.refusal,
    text: info?.refusal ?? (info?.erase ? `Remove ${what.toLowerCase()}` : what),
    cost: info && Object.keys(info.cost).length ? costText(info.cost) : "",
    strip,
  };
}

/** The command for the tool at the border under the pointer (sent even if our view says no while painting: the sim decides), or why not. */
export function edgeCommand(state: SimState, tool: CorridorTool, at: [number, number, number]): { command?: SimCommand; refusal?: string } {
  const { pick, edge } = edgeAt(state, at);
  if (!edge || !("floor" in pick)) return { refusal: "Point at a border between cells" };
  const info = edgeHoverFor(state.layout, state.resources, { kind: "corridor", ...tool }, pick, edge, tool.erase).edge;
  const command = corridorCommand({ kind: "corridor", ...tool }, info);
  return command ? { command, ...(info?.refusal ? { refusal: info.refusal } : {}) } : { refusal: info?.refusal ?? "Nothing to do here" };
}

