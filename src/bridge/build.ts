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
import { edgeById, nearestEdge, type Edge } from "../sim/edges";
import { roomSide } from "../sim/windows";
import { EMPTY_CHAIN, extendChain, type Chain } from "../view/corridorPlan";
import { proposalSummary, type ProposalSummary } from "../view/corridorProposal";
import type { Proposal } from "../view/types";
import { CATEGORY_NAMES, CATEGORY_ORDER, HOTKEYS, shapesFor } from "../view/buildCatalog";
import { corridorCommand, edgeHoverFor, locationFor } from "../view/interaction";
import { resName } from "../ui/format";
import { roomCard, type CardContent } from "../view/roomCard";
import { previewEffects } from "../sim/effects";
import { roomDef } from "../sim/rooms";
import type { Cell } from "../sim/placement";
import { HEAT } from "../render2d/palette";
import { FIELD_MAX } from "../render2d/planDraw";

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
  /** The room card (view/roomCard.ts), shown while it's pointed at or in hand. */
  card: CardContent;
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
      card: roomCard(d, state.resources, siteRefusal(d.id, gates)),
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
  /** Its strongest effect on the cells round it, as the web's halo: bands of cells (triangles, as the ghost) in a colour and opacity. */
  halo?: { color: string; alpha: number; tris: string }[];
}

const b64 = (a: ArrayLike<number>) => Buffer.from(new Float32Array(a).buffer).toString("base64");

/** The room's strongest spreading effect, previewed where it would go (render3d/stage3d.ts drawHalo): cells grouped by strength. */
function halo(state: SimState, type: string, cells: Cell[]): HoveredMessage["halo"] {
  const effects = roomDef(type).effects.filter((e) => !e.residentsOnly && e.radius > 0);
  if (!effects.length) return undefined;
  const main = effects.reduce((a, b) => (Math.abs(b.strength) > Math.abs(a.strength) ? b : a));
  const grid = previewEffects(state.layout, type, cells)[main.type];
  if (!grid) return undefined;
  const own = new Set(cells.map((c) => `${c.floor}:${c.ring}:${c.slot}`));
  const bands = new Map<number, Cell[]>();
  grid.forEach((rings, fi) =>
    rings.forEach((slots, ri) =>
      slots.forEach((v, slot) => {
        if (Math.abs(v) < 0.05 || own.has(`${fi + 1}:${ri + 1}:${slot}`)) return;
        const band = Math.round(v * 3) / 3;
        if (!bands.has(band)) bands.set(band, []);
        bands.get(band)!.push({ floor: fi + 1, ring: ri + 1, slot });
      }),
    ),
  );
  const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
  return [...bands].map(([v, list]) => {
    const pos: number[] = [];
    for (const c of list) {
      const geo = roomGeometry(state.layout, [c]);
      const g = geo.index ? geo.toNonIndexed() : geo;
      const a = (g.getAttribute("position") as THREE.BufferAttribute).array;
      for (let i = 0; i < a.length; i++) pos.push(a[i]!);
      geo.dispose();
      g.dispose();
    }
    return { color: hex(v < 0 ? HEAT.normal.bad : HEAT.normal.good), alpha: Math.min(1, Math.abs(v) / FIELD_MAX) * 0.6, tris: b64(pos) };
  });
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
  const glow = check.ok && check.cells.length ? halo(state, tool.room, check.cells) : undefined;
  return { type: "hovered", ok: check.ok, text, cost, ...(ghost ? { ghost } : {}), ...(glow?.length ? { halo: glow } : {}) };
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
  // Windows: the room's whole wall, each border only on the room's half (as stage3d.ts drawOverlay).
  const w = info?.windows;
  const room = w?.roomId ? state.layout.rooms.find((r) => r.id === w.roomId) : undefined;
  const edges = room && w ? w.edges.map((id) => edgeById(state.layout.hole, id)).filter((e): e is Edge => !!e) : [edge];
  const pos: number[] = [];
  for (const e of edges) {
    const geo = corridorStripGeometry(state.layout, e, floorSpan(e.floor)[0] + 0.08, room ? (roomSide(state.layout, room, e) ?? undefined) : undefined);
    pos.push(...(geo.getAttribute("position") as THREE.BufferAttribute).array);
    geo.dispose();
  }
  const strip = Buffer.from(new Float32Array(pos).buffer).toString("base64");
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


// ---- snaking a chain of corridors (render3d/stage3d.ts snake and endSnake) ----

/** The chain being dragged out, and the one waiting on the player's answer. */
export interface ChainState {
  chain: Chain;
  erase: boolean;
  finish: string;
  proposal: Proposal | null;
}

export const newChainState = (): ChainState => ({ chain: EMPTY_CHAIN, erase: false, finish: corridors.defaultFinish, proposal: null });

const HOVER = { ok: 0x7fd67f, bad: 0xe0503a, existing: 0xffe2b0 };

export interface ChainedMessage {
  type: "chained";
  /** The chain's borders, as strips (triangles, as the ghost's) by colour: new, already there, or being filled in. */
  strips: { color: string; tris: string }[];
}

/** The chain's borders to highlight. */
export function chainedMessage(state: SimState, edges: string[], erase: boolean): ChainedMessage {
  const byColor = new Map<number, number[]>();
  for (const id of edges) {
    const e = edgeById(state.layout.hole, id);
    if (!e) continue;
    const color = erase ? HOVER.bad : state.layout.corridors[id] ? HOVER.existing : HOVER.ok;
    const geo = corridorStripGeometry(state.layout, e, floorSpan(e.floor)[0] + 0.08);
    const a = (geo.getAttribute("position") as THREE.BufferAttribute).array;
    if (!byColor.has(color)) byColor.set(color, []);
    const list = byColor.get(color)!;
    for (let i = 0; i < a.length; i++) list.push(a[i]!);
    geo.dispose();
  }
  return { type: "chained", strips: [...byColor].map(([c, pos]) => ({ color: `#${c.toString(16).padStart(6, "0")}`, tris: b64(pos) })) };
}

/** The pointer pressed (start) or dragged with the corridor tool: the chain grows to (or trims back to) the border under it. */
export function chainStep(state: SimState, cs: ChainState, tool: CorridorTool, at: [number, number, number], start: boolean): ChainedMessage | null {
  if (start) {
    cs.chain = EMPTY_CHAIN;
    cs.erase = tool.erase;
    cs.finish = tool.finish;
    cs.proposal = null;
  }
  const next = extendChain(state.layout, cs.chain, edgeAt(state, at).edge, cs.erase);
  if (next === cs.chain && !start) return null;
  cs.chain = next;
  return chainedMessage(state, next.edges, cs.erase);
}

export interface ProposalMessage extends ProposalSummary {
  type: "proposal";
}

/** Released: a chain goes to the player to confirm; a single border is just drawn (or filled in), as a click. */
export function chainEnd(state: SimState, cs: ChainState, tool: CorridorTool, at: [number, number, number]): { proposal?: ProposalMessage; command?: SimCommand; refusal?: string } {
  const done = cs.chain;
  cs.chain = EMPTY_CHAIN;
  if (done.edges.length > 1) {
    cs.proposal = { edges: done.edges, erase: cs.erase };
    return { proposal: { type: "proposal", ...proposalSummary(cs.proposal, state.layout, state.resources, cs.finish) } };
  }
  if (done.edges.length === 1) return edgeCommand(state, tool, at);
  return {};
}

/** The player's answer: carve (or fill in) the whole chain, or not. */
export function answerProposal(cs: ChainState, accept: boolean): SimCommand | null {
  const p = cs.proposal;
  cs.proposal = null;
  if (!p || !accept) return null;
  return p.erase ? { type: "removeCorridors", edges: p.edges, all: true } : { type: "drawCorridors", edges: p.edges, finish: cs.finish, all: true };
}
