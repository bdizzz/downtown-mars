import * as THREE from "three";
import { config } from "../sim/config";
import { checkBuild, missingCost, siteRefusal, withExtra } from "../sim/costs";
import { holeGates } from "../sim/people";
import { roomDefs } from "../sim/rooms";
import type { SimCommand } from "../sim/commands";
import type { SimState } from "../sim/state";
import { areaAt, areaScale, unitsOf } from "../sim/placement";
import { covers, spaceOf } from "../sim/space";
import { floorSpan, notchRad, pickAt, RING_D, ringRadii, TAU } from "../render3d/cylinder";
import { corridorGhostY, corridorStripGeometry, roomGeometry } from "../render3d/rooms3d";
import { corridors } from "../sim/corridors";
import { edgeById, nearestEdge, type Edge } from "../sim/edges";
import { roomSide } from "../sim/windows";
import { EMPTY_CHAIN, extendChain, type Chain } from "../view/corridorPlan";
import { proposalSummary, type ProposalSummary } from "../view/corridorProposal";
import type { Pick, Proposal, RoomProposal, StageOptions, Tool } from "../view/types";
import { areaOf, CATEGORY_NAMES, CATEGORY_ORDER, depthsOf, HOTKEYS, unitsFor } from "../view/buildCatalog";
import { clickOrFill, commitBuild, corridorCommand, dragProposal, edgeHoverFor, hoverInfoFor, placingMarks, surfaceSpots } from "../view/interaction";
import { buildLiningCost, canLineAt, liningById, liningCost, liningId, MATERIALS, type WallStep } from "../sim/materials";
import { surfaceSpotGeometry } from "../render3d/scenery3d";
import { resName } from "../ui/format";
import { roomCard, type CardContent } from "../view/roomCard";
import { previewEffects } from "../sim/effects";
import { roomDef } from "../sim/rooms";
import type { Cell } from "../sim/placement";
import { CATEGORY_COLORS, cssColor, HEAT } from "../render2d/palette";
import { FIELD_MAX } from "../render2d/planDraw";

// Building from the Godot viewer, by the web game's rules (view/interaction.ts, sim/costs.ts): the
// palette of rooms and whether each can be built here and now; what placing one at the pointer
// would do (a ghost of its footprint, its cost, or why not); and the command to build it.

export interface PaletteRoom {
  id: string;
  name: string;
  category: string;
  /** How many rings deep it may be (R turns it the other way); a surface room has one. */
  depths: number[];
  /** Its target floor area, m² (nothing for a surface room). */
  area?: number;
  /** A fill room: stretches to close a gap, and a double click fills one. */
  fill?: boolean;
  /** Stairs or an elevator: built at once, onto a stack (no proposal). */
  stacks?: boolean;
  surface: boolean;
  cost: string;
  key?: string;
  /** Why it can't be built in this hole (a deposit or a milestone it waits on), or what it's short of. */
  locked?: string;
  short?: string;
  /** The room card (view/roomCard.ts), shown while it's pointed at or in hand. */
  card: CardContent;
  /** Can it be built in a lining (T-038)? Not surface buildings, stairs, lifts or empty rooms. */
  lineable: boolean;
  /** Built in each lining but bare rock (by its first shape): the whole cost as one, whether it's short, and the card's cost lines. */
  inLining?: Record<string, { cost: string; short?: string; cardCost: CardContent["cost"] }>;
}

/** What building a room (its first shape) in a lining adds to its cost. */
function liningExtraFor(type: string, lining: WallStep): Record<string, number> {
  if (roomDef(type).size === "surface") return {};
  return buildLiningCost(type, { kind: "ring", floor: 1, ring: 1, start: 0 }, unitsFor(roomDef(type)), lining);
}

export interface PaletteMessage {
  type: "palette";
  /** Each with its colour, as the web palette's swatches (#224). */
  categories: { id: string; name: string; color: string }[];
  rooms: PaletteRoom[];
  /** The building materials rooms can be built in (T-038), bare rock first: what each adds a cell, and what it does. */
  linings: { id: string; name: string; cost: string; hint: string }[];
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
    .map((d) => {
      const lineable = d.size !== "surface" && canLineAt(d.id, { kind: "ring", floor: 1, ring: 1, start: 0 });
      const inLining = lineable
        ? Object.fromEntries(
            MATERIALS.walls.slice(1).map((w) => {
              const extra = liningExtraFor(d.id, w);
              const short = missingCost(state.resources, d.id, extra);
              return [liningId(w), { cost: costText(withExtra(d.id, extra)), ...(short ? { short } : {}), cardCost: roomCard(d, state.resources, null, extra).cost }];
            }),
          )
        : undefined;
      return {
        id: d.id,
        name: d.name,
        category: d.category,
        depths: depthsOf(d),
        ...(areaOf(d) !== null ? { area: areaOf(d)! } : {}),
        ...(d.fill ? { fill: true } : {}),
        ...(d.stacks ? { stacks: true } : {}),
        surface: d.size === "surface",
        cost: costText(d.cost),
        ...(HOTKEYS[d.id] ? { key: HOTKEYS[d.id] } : {}),
        ...(siteRefusal(d.id, gates) ? { locked: siteRefusal(d.id, gates)! } : {}),
        ...(missingCost(state.resources, d.id) ? { short: missingCost(state.resources, d.id)! } : {}),
        card: roomCard(d, state.resources, siteRefusal(d.id, gates)),
        lineable,
        ...(inLining ? { inLining } : {}),
      };
    });
  const used = new Set(rooms.map((r) => r.category));
  used.add("circulation");
  return {
    type: "palette",
    categories: CATEGORY_ORDER.filter((c) => used.has(c)).map((id) => ({ id, name: CATEGORY_NAMES[id] ?? id, color: cssColor(CATEGORY_COLORS[id] ?? 0x888888) })),
    rooms,
    linings: MATERIALS.walls.map((w, i) => ({
      id: liningId(w),
      name: w.name,
      cost: i === 0 ? "as dug" : `${costText(liningCost(w))} a cell`,
      hint:
        i === 0
          ? "The room as dug: refit it later from its panel"
          : `On top of the room's cost, in its own build time (a refit later takes extra work). Comfort +${w.comfort} in a home, wears ${Math.round((1 - w.wear) * 100)}% slower`,
    })),
    corridors: {
      finishes: corridors.finishes.map((f) => ({ id: f.id, name: f.name, cost: `${costText(f.cost)} per 10 m`, hint: f.hint })),
      bulkhead: `${costText(corridors.bulkhead.cost)} each`,
      windows: `${costText(config.windows.costPer10m)} per 10 m`,
    },
  };
}

/** What changes the palette: the gates, and which rooms the stocks can pay for, bare and in each lining. */
export function paletteKey(state: SimState): string {
  const short = (d: (typeof roomDefs)[number]) =>
    !d.buildable ? "" : MATERIALS.walls.map((w) => (missingCost(state.resources, d.id, liningExtraFor(d.id, w)) ? 1 : 0)).join("");
  return state.holeId + ":" + holeGates(state).join(",") + ":" + roomDefs.map(short).join("");
}

export interface BuildTool {
  room: string;
  /** How many rings deep (an L room turned the other way is 2). */
  depth: number;
  /** The lining to build it in (a liningId; absent or "rock": bare rock). */
  lining?: string;
  /** Snapping: off (false) puts the room at the pointer at exactly its target area (PLAN-M17). */
  snap?: boolean;
  /** A room put down but not yet built: its side walls are handles; a click on it (or Enter) builds it. */
  proposal?: RoomProposal;
}

const webTool = (tool: BuildTool): Extract<Tool, { kind: "build" }> => ({
  kind: "build",
  room: tool.room,
  depth: tool.depth ?? 1,
  ...(tool.lining ? { lining: tool.lining } : {}),
  ...(tool.snap === false ? { snap: false } : {}),
  ...(tool.proposal ? { proposal: tool.proposal } : {}),
});

/** A pick for a world point: what's there, or (off the hole) at least its angle on a floor and ring, for dragging a handle. */
function pickFor(state: SimState, at: [number, number, number], on?: { floor: number; ring: number }): Pick {
  if (!on) return pickAt(state.layout, ...at);
  const angle = ((((Math.atan2(at[2], at[0]) / TAU) % 1) + 1) % 1) * 360;
  return { kind: "slot", floor: on.floor, ring: on.ring, a0: 0, a1: 1, locked: false, digging: false, angle };
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
  /** A ring room: its floor area as it would be built, m², and where it would go (the proposal, when one is down). */
  area?: number;
  at?: RoomProposal;
  /** A proposal is down: its two side walls as strips to draw (triangles, as the ghost), and the one under the pointer, if either. */
  handles?: string;
  handle?: "start" | "end";
  /** What it snapped to: a line across the rings at each angle, as segments (float32 x y z x y z, base64). */
  ticks?: string;
  /** A surface room: every spot it could go, tinted faintly, and the one pointed at, stronger (triangles, as the ghost; T-107). */
  spots?: string;
  spot?: string;
}

/** Where a surface room could go, answering a "spots" request when it's picked (T-107). */
export interface SpotsMessage {
  type: "spots";
  /** Triangles (float32 xyz, base64), empty for a room that goes inside the hole. */
  tris: string;
}

/** Surface slots as patches of ground, as triangles (render3d/scenery3d.ts surfaceSpotGeometry). */
function spotTris(state: SimState, slots: number[]): string {
  const geo = surfaceSpotGeometry(state.layout.hole, state.layout.surface.length, slots);
  const tris = b64((geo.getAttribute("position") as THREE.BufferAttribute).array);
  geo.dispose();
  return tris;
}

export function spots(state: SimState, room: string): SpotsMessage {
  return { type: "spots", tris: spotTris(state, surfaceSpots(state.layout, room)) };
}

const b64 = (a: ArrayLike<number>) => Buffer.from(new Float32Array(a).buffer).toString("base64");

/** The room's strongest spreading effect, previewed where it would go (render3d/stage3d.ts drawHalo): cells grouped by strength. */
function halo(state: SimState, type: string, cells: Cell[]): HoveredMessage["halo"] {
  const effects = roomDef(type).effects.filter((e) => !e.residentsOnly && e.radius > 0);
  if (!effects.length) return undefined;
  const main = effects.reduce((a, b) => (Math.abs(b.strength) > Math.abs(a.strength) ? b : a));
  const grid = previewEffects(state.layout, type, cells)[main.type];
  if (!grid) return undefined;
  const bands = new Map<number, Cell[]>();
  for (const rings of spaceOf(state.layout).pieces) {
    for (const list of rings) {
      for (const piece of list) {
        const v = grid[piece.floor - 1]?.[piece.ring - 1]?.[piece.a0] ?? 0;
        if (Math.abs(v) < 0.05 || covers(cells, piece.floor, piece.ring, (piece.a0 + piece.a1) / 2)) continue;
        const band = Math.round(v * 3) / 3;
        if (!bands.has(band)) bands.set(band, []);
        bands.get(band)!.push(piece);
      }
    }
  }
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

/** Edges as strips on their floor (triangles, as the ghost): a proposal's handles. */
function stripTris(state: SimState, ids: string[]): string {
  const pos: number[] = [];
  for (const id of ids) {
    const e = edgeById(state.layout.hole, id);
    if (!e) continue;
    const geo = corridorStripGeometry(state.layout, e, floorSpan(e.floor)[1] + 0.06);
    const g = geo.index ? geo.toNonIndexed() : geo;
    const a = (g.getAttribute("position") as THREE.BufferAttribute).array;
    for (let i = 0; i < a.length; i++) pos.push(a[i]!);
    geo.dispose();
    g.dispose();
  }
  return b64(pos);
}

export function hover(state: SimState, tool: BuildTool, at: [number, number, number]): HoveredMessage {
  const web = webTool(tool);
  const info = hoverInfoFor(state.layout, state.resources, web, pickFor(state, at), holeGates(state));
  const where = info.at;
  const check = info.check;
  const def = roomDefs.find((d) => d.id === tool.room);
  let cost = def ? costText(def.cost) : "";
  const all = def?.size === "surface" ? { spots: spots(state, tool.room).tris } : {};
  if (!where || !check) return { type: "hovered", ok: false, text: def?.size === "surface" ? "Goes on the surface" : "Point at a ring of the hole", cost, ...all };
  const lining = liningById(tool.lining);
  const scale = check.ok ? areaScale(state.layout.hole, tool.room, check.at) : 1;
  const extra = buildLiningCost(tool.room, where, unitsOf(state.layout.hole, check.cells), lining);
  if (Object.keys(extra).length || scale !== 1) cost = costText(withExtra(tool.room, extra, scale));
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
  const spot = check.ok && check.surfaceCells.length ? { spot: spotTris(state, check.surfaceCells) } : {};
  // Placing by area: its size, a proposal's handles, and a tick on what it snapped to.
  const ring = where.kind === "ring" ? { kind: "ring" as const, floor: where.floor, ring: where.ring, depth: where.depth ?? 1, start: where.start, span: where.span ?? 0 } : null;
  const marks = placingMarks(state.layout, web, info);
  const ticks: number[] = [];
  for (const t of marks.ticks) {
    const a = notchRad(t.notch);
    const y = floorSpan(t.floor)[1] + 0.05;
    const [rIn] = ringRadii(state.layout.hole, t.ring0);
    const [, rOut] = ringRadii(state.layout.hole, t.ring1);
    ticks.push(rIn * Math.cos(a), y, rIn * Math.sin(a), rOut * Math.cos(a), y, rOut * Math.sin(a));
  }
  return {
    type: "hovered",
    ok: check.ok,
    text,
    cost,
    ...(ghost ? { ghost } : {}),
    ...(glow?.length ? { halo: glow } : {}),
    ...all,
    ...spot,
    ...(ring ? { area: Math.round(areaAt(state.layout.hole, ring)), at: ring } : {}),
    ...(marks.handles.length ? { handles: stripTris(state, marks.handles) } : {}),
    ...(info.handle ? { handle: info.handle } : {}),
    ...(ticks.length ? { ticks: b64(ticks) } : {}),
  };
}

export interface Placed {
  command?: SimCommand;
  confirm?: string;
  refusal?: string;
  /** The room in hand's proposal after the click: put down (or moved), or dropped (null) once it's built. Absent: unchanged. */
  proposal?: RoomProposal | null;
}

/**
 * A click with the tool, by the web's rules (view/interaction.ts clickOrFill): a ring room goes down as a
 * proposal first, and a click on it builds it (cutting through corridors, only once confirmed); stairs and
 * surface rooms are built at once; a double click with a fill room fills the gap. Or why not.
 */
export function place(state: SimState, tool: BuildTool, at: [number, number, number], confirmed: boolean, double = false, commit = false): Placed {
  const web = webTool(tool);
  const pick = pickFor(state, at);
  const out: Placed = {};
  const opts: StageOptions = {
    onCommand: (command) => (out.command = command),
    onInvalid: (reason) => (out.refusal = reason),
    onProposeRoom: (p) => (out.proposal = p),
    onConfirmBuild: (b) => {
      if (confirmed) {
        out.command = { type: "build", room: b.room, at: b.at, confirmed: true, ...(b.material ? { material: b.material, finish: b.finish } : {}) };
        return;
      }
      const stranded = b.strands.rooms.length;
      out.confirm = `This cuts through ${b.destroys.length} corridor segment${b.destroys.length > 1 ? "s" : ""}${stranded ? `, cutting off ${stranded} room${stranded > 1 ? "s" : ""}` : ""}. Build it anyway?`;
    },
  };
  const gates = holeGates(state);
  const info = hoverInfoFor(state.layout, state.resources, web, pick, gates);
  // Answering "build it anyway?" (or Enter): the proposal itself, wherever the pointer has gone.
  if (web.proposal && (confirmed || commit)) commitBuild(web, { ...info, at: web.proposal, check: checkBuild(state.layout, state.resources, web.room, web.proposal, config, gates, liningById(web.lining)) }, opts);
  else clickOrFill(state.layout, state.resources, web, info, opts, gates, double);
  // Asked to confirm: the proposal stays down until it's answered.
  if (out.confirm) delete out.proposal;
  if (!out.command && !out.confirm && !out.refusal && out.proposal === undefined && !info.check) out.refusal = "Point at a ring of the hole";
  return out;
}

/** A proposal with one side wall dragged to a world point (view/interaction.ts dragProposal). */
export function dragHandle(state: SimState, tool: BuildTool, side: "start" | "end", at: [number, number, number]): RoomProposal | null {
  if (!tool.proposal) return null;
  return dragProposal(state.layout, webTool(tool), side, pickFor(state, at, tool.proposal));
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
  const p = pickAt(state.layout, ...at);
  if (p.kind !== "slot" && p.kind !== "gallery") return { pick: p, edge: null, point: null };
  const rings = Math.max(0.001, (Math.hypot(at[0], at[2]) - hole.shaftRadiusM) / RING_D);
  const point = { rings, turn: Math.atan2(at[2], at[0]) / TAU };
  return { pick: p, edge: nearestEdge(state.layout, p.floor, point.rings, point.turn, RING_D), point };
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
    const geo = corridorStripGeometry(state.layout, e, room ? floorSpan(e.floor)[0] + 0.08 : corridorGhostY(state.layout, e), room ? (roomSide(state.layout, room, e) ?? undefined) : undefined);
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
    const geo = corridorStripGeometry(state.layout, e, corridorGhostY(state.layout, e));
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
  const { edge, point } = edgeAt(state, at);
  const next = extendChain(state.layout, cs.chain, edge, cs.erase, point);
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
