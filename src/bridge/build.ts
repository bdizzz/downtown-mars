import * as THREE from "three";
import { config } from "../sim/config";
import { checkBuild, missingCost, siteRefusal } from "../sim/costs";
import { holeGates } from "../sim/people";
import { roomDefs } from "../sim/rooms";
import type { SimCommand } from "../sim/commands";
import type { SimState } from "../sim/state";
import type { Location } from "../sim/placement";
import { pickAt } from "../render3d/cylinder";
import { roomGeometry } from "../render3d/rooms3d";
import { CATEGORY_NAMES, CATEGORY_ORDER, HOTKEYS, shapesFor } from "../view/buildCatalog";
import { locationFor } from "../view/interaction";
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
  return { type: "palette", categories: CATEGORY_ORDER.filter((c) => used.has(c)).map((id) => ({ id, name: CATEGORY_NAMES[id] ?? id })), rooms };
}

/** What changes the palette: the gates, and which rooms the stocks can pay for. */
export function paletteKey(state: SimState): string {
  return holeGates(state).join(",") + ":" + roomDefs.map((d) => (d.buildable && missingCost(state.resources, d.id) ? 1 : 0)).join("");
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
