import type { Growth } from "./food";
import { config, type Priority, type SimConfig } from "./config";
import { ringSize, slotsToAngles, spanArea, wrapNotch, wrapSlot, type Hole } from "./geometry";
import { corridorsInside, recomputeAccess, strandedBy, wouldConnect } from "./corridors";
import { isRoomType, roomDef } from "./rooms";
import { areaOf, cell, cellKey, covers, pieceAt, piecesIn, rockCells, type Cell, type Span } from "./space";

// Where rooms can go. A ring room is anchored at its innermost ring and its
// start angle, spans `span` notches round and `depth` rings outward, and takes
// the same angles on every ring it covers: a clean wedge (F-004, PLAN-M17).
// Its size is an area: placing it turns its target area and the ring's depth
// into an angle.

export type { Cell } from "./space";

export type Location =
  | {
      kind: "ring";
      floor: number;
      ring: number;
      /** How many rings deep, outward from `ring`. */
      depth: number;
      /** Its angle range in notches: from `start`, `span` notches round. */
      start: number;
      span: number;
    }
  | { kind: "surface"; slot: number };

/**
 * Where a room is asked to go. A ring room may leave out its span (its target
 * area on that ring) and depth (its size's first). `fixed` takes the span as
 * given, whatever its area: old slot-shaped rooms, and tests laid out on the
 * old slots.
 */
export type Spot =
  | { kind: "ring"; floor: number; ring: number; start: number; span?: number; depth?: number; fixed?: boolean }
  | { kind: "surface"; slot: number };

export interface RoomInstance {
  id: number;
  type: string;
  at: Location;
  /** The ring cells covered: its angle range on each floor and ring it spans (empty for surface rooms). */
  cells: Cell[];
  /** Its floor in whole units of 100 m² (unitsOf): what its linings, floors and crowding count by. Set as it is placed, extended and loaded. */
  units?: number;
  /** Surface slots covered (empty for ring rooms). */
  surfaceCells: number[];
  /** Reachable from the surface, through the entrance. Surface rooms always are. */
  connected: boolean;
  /** A blueprint on the floor still being dug; switches on when it's done. */
  planned: boolean;
  /** Who gets workers and inputs first during a shortage. */
  priority: Priority;
  /** Farms only. */
  crop?: string;
  /** Farms only: the harvest cycle (food.ts); absent until it first works. */
  growth?: Growth;
  /** What a tank holds, of its kind's choices (rooms.json holds); absent means the first. */
  holds?: string;
  /** Committed but still in the construction queue: holds its slots, doesn't run. */
  building?: boolean;
  /** Stairs or an elevator reaching further: cells held for floors still being built. */
  pendingCells?: Cell[];
  /** Storage rooms: the goods it takes in; absent means everything (storage.ts). */
  allows?: string[];
  /** Storage rooms: what it holds now, by good, in units. */
  contents?: Record<string, number>;
  /** Old saves only (before v22): space set aside per good, now `allows`. */
  allocation?: Record<string, number>;
  /** Storage space overriding the room's own (old saves' landing pod). */
  storageUnits?: number;
  /** Switched off by the player: no staff, no inputs, no output. */
  paused?: boolean;
  /** Idle (and release its staff) while its main output is at or above this stock. */
  stopAt?: number;
  /** When it was placed, for undo. Absent for the landing kit and old saves. */
  builtTick?: number;
  /** How worn it is, 0..1 (see condition.ts); absent means 100%. */
  condition?: number;
  /** A repair under way or handed back part-done: work-hours done and needed. */
  repair?: { done: number; work: number };
  /** The player's own name for it (rename), shown instead of its type's. */
  name?: string;
  /** Borders (edge ids) of its walls the player has put windows in (see windows.ts). */
  windows?: string[];
  /** Its walls' lining (see materials.ts): absent means bare rock. */
  material?: "rock" | "marscrete" | "brick" | "metal";
  /** The lining's finish: absent means its base step. */
  finish?: "base" | "fine";
  /** Its floor upgrade (a flooring id in data/materials.json): absent means it matches the walls. */
  flooring?: string;
}

export interface Layout {
  version: number;
  hole: Hole;
  rooms: RoomInstance[];
  /** open[floor - 1][ring - 1] = the angle ranges excavated (a room or empty space), merged and in order; the rest is solid rock. */
  open?: Span[][][];
  /** Corridors whose border has been cut since a job last looked: old id → its parts (space.ts; construction.ts follows them). */
  corridorSplits?: Record<string, string[]>;
  /** Old saves (v14 and older): the shaft still links every floor, as it did before stairs mattered. */
  openShaft?: boolean;
  /** surface[slot] = room id, or 0 if empty. */
  surface: number[];
  nextRoomId: number;
  /** Corridors along the borders between pieces: edge id (see edges.ts) → finish. Each is one whole edge piece. */
  corridors: Record<string, string>;
  /** Which floors' galleries are reached from the surface (floorLinked[floor - 1]); recomputed with access. */
  floorLinked?: boolean[];
  /** Which corridors reach the surface; recomputed with access. */
  corridorLinked?: Record<string, boolean>;
  /** Corridors still in the construction queue: edge id → job id. */
  corridorsBuilding?: Record<string, number>;
  /** Corridors being filled in (still usable until the job's done): edge id → job id. */
  corridorsFilling?: Record<string, number>;
  /** Corridors being refitted in another lining (still usable meanwhile): edge id → job id. */
  corridorsRelining?: Record<string, number>;
  /** Corridor segments with a sealed bulkhead: people pass, air doesn't (edge id → true). */
  bulkheads?: Record<string, true>;
  /** The shaft dome is built: the shaft is pressurized, every floor's gallery open walkway. */
  domed?: boolean;
}

export type CheckResult =
  | {
      ok: true;
      /** Where it goes, with its span and depth filled in. */
      at: Location;
      cells: Cell[];
      surfaceCells: number[];
      planned: boolean;
      /** No corridor reaches it yet: it can go here, but won't work until one does. */
      unconnected?: boolean;
      /** Stacking rooms: existing stairs (or elevators) this piece joins onto. */
      merges?: number[];
      /** What the placement does, when it isn't obvious ("Extend stairs to cover floors 1–3"). */
      note?: string;
      /** Floor area still solid rock, m²: it's excavated first. */
      rock?: number;
      /** Corridors inside the footprint that placing it would fill in, and what that would cut off. */
      destroys?: string[];
      strands?: { rooms: number[]; corridors: string[] };
    }
  | { ok: false; reason: string; cells: Cell[]; surfaceCells: number[] };

const N = config.geometry.notchesPerTurn;

export function createLayout(hole: Hole, cfg: SimConfig = config): Layout {
  const layout: Layout = {
    version: 0,
    hole,
    rooms: [],
    surface: new Array(cfg.geometry.surfaceSlots).fill(0),
    nextRoomId: 1,
    corridors: {},
  };
  ensureFloors(layout);
  return layout;
}

/** Grow what's kept per floor to cover every dug floor plus the one being dug. */
export function ensureFloors(layout: Layout): void {
  layout.open ??= [];
  while (layout.open.length < layout.hole.floors + 1) layout.open.push(layout.hole.ringSlots.map(() => []));
}

/** The cells a room covers on one floor: the same angles on each ring it spans. */
export function footprint(hole: Hole, floor: number, ring: number, start: number, span: number, depth: number): Cell[] {
  const cells: Cell[] = [];
  for (let r = ring; r < ring + depth && r <= hole.ringSlots.length; r++) cells.push(cell(floor, r, start, span));
  return cells;
}

/** Pieces sharing a side with the group: along the ring, or across rings by angle. */
export function neighborCells(layout: Layout, cells: Cell[]): Cell[] {
  const out = new Map<string, Cell>();
  const add = (p: Cell | null) => {
    if (p && !covers(cells, p.floor, p.ring, (p.a0 + p.a1) / 2)) out.set(cellKey(p), p);
  };
  for (const c of cells) {
    add(pieceAt(layout, c.floor, c.ring, c.a0 - 0.5));
    add(pieceAt(layout, c.floor, c.ring, c.a1 + 0.5));
    for (const r of [c.ring - 1, c.ring + 1]) {
      if (r < 1 || r > layout.hole.ringSlots.length) continue;
      for (const p of piecesIn(layout, { ...c, ring: r })) add(p);
    }
  }
  return [...out.values()];
}

/** The room holding the start of a cell. */
export function roomAt(layout: Layout, c: Cell): RoomInstance | undefined {
  const id = pieceAt(layout, c.floor, c.ring, c.a0 + 0.5)?.room;
  return id ? layout.rooms.find((r) => r.id === id) : undefined;
}

/** A room type's target floor area, m²: its own, or its size's. */
export function targetArea(type: string, cfg: SimConfig = config): number {
  const def = roomDef(type);
  return def.area ?? cfg.sizes[def.size as "S"] ?? cfg.sizes.S!;
}

/** The depths (in rings) a room type may be. */
export function depthsFor(type: string, cfg: SimConfig = config): number[] {
  return cfg.depths[roomDef(type).size as "S"] ?? [1];
}

/** How wide a room may be on a ring, in notches: its target, and the least and most its leeway (or a fill room's range) allows. */
export function spanRange(hole: Hole, type: string, ring: number, depth: number, cfg: SimConfig = config): { target: number; min: number; max: number } {
  const def = roomDef(type);
  const per = spanArea(hole.shaftRadiusM, ring, depth, 1, cfg.geometry);
  const area = targetArea(type, cfg);
  const p = cfg.placement;
  const lo = def.fill ? p.fill.min : 1 - p.leeway;
  const hi = def.fill ? p.fill.max : 1 + p.leeway;
  const cap = def.fill ? Math.floor(p.fill.maxTurn * N) : N;
  const target = Math.min(cap, Math.max(1, Math.round(area / per)));
  return { target, min: Math.min(target, Math.max(1, Math.ceil((area * lo) / per - 1e-9))), max: Math.max(target, Math.min(cap, Math.floor((area * hi) / per + 1e-9))) };
}

/** The floor area of a ring location, m². */
export function areaAt(hole: Hole, at: { ring: number; depth: number; span: number }, cfg: SimConfig = config): number {
  return spanArea(hole.shaftRadiusM, at.ring, at.depth, at.span, cfg.geometry);
}

/** A room's floor area, m² (0 on the surface). */
export function roomArea(hole: Hole, room: RoomInstance, cfg: SimConfig = config): number {
  return room.at.kind === "ring" ? areaAt(hole, room.at, cfg) : 0;
}

/**
 * How a room's cost and work scale with its area: 1, except a fill room (empty
 * space, a plaza, the park), which pays for the floor it takes.
 */
export function areaScale(hole: Hole, type: string, at: Location | Spot, cfg: SimConfig = config): number {
  if (at.kind !== "ring" || !isRoomType(type) || !roomDef(type).fill) return 1;
  const depth = at.depth ?? depthsFor(type, cfg)[0]!;
  const span = at.span ?? spanRange(hole, type, at.ring, depth, cfg).target;
  return spanArea(hole.shaftRadiusM, at.ring, depth, span, cfg.geometry) / targetArea(type, cfg);
}

/**
 * How much floor these cells are, in whole units of 100 m² (at least one a floor): what linings, floors and
 * crowding count by. An S room is 1, an M 2, an L 4, whatever its exact area.
 */
export function unitsOf(hole: Hole, cells: Cell[]): number {
  const byFloor = new Map<number, number>();
  for (const c of cells) byFloor.set(c.floor, (byFloor.get(c.floor) ?? 0) + spanArea(hole.shaftRadiusM, c.ring, 1, c.a1 - c.a0, config.geometry));
  let n = 0;
  for (const area of byFloor.values()) n += Math.max(1, Math.round(area / 100));
  return n;
}

/** A room's floor in whole units of 100 m² (a surface room: its slots). */
export function roomUnits(room: RoomInstance): number {
  return Math.max(1, room.units ?? (room.cells.length || room.surfaceCells.length));
}

/** The spot the old slots gave: `w` slots from `slot` of the ring's grid, `d` rings deep, its span taken as it is. */
export function slotSpot(hole: Hole, floor: number, ring: number, slot: number, w = 1, d = 1): Spot & { kind: "ring" } {
  const { start, span } = slotsToAngles(slot, w, ringSize(hole, ring), N);
  return { kind: "ring", floor, ring, start, span, depth: d, fixed: true };
}

export function checkPlacement(layout: Layout, type: string, spot: Spot, cfg: SimConfig = config): CheckResult {
  const none = { cells: [], surfaceCells: [] };
  if (!isRoomType(type)) return { ok: false, reason: `Unknown room "${type}"`, ...none };
  const def = roomDef(type);
  const hole = layout.hole;

  if (spot.kind === "surface") {
    if (def.size !== "surface") return { ok: false, reason: `${def.name} goes inside the hole`, ...none };
    const n = layout.surface.length;
    const width = def.surfaceSlots ?? 1;
    const surfaceCells = Array.from({ length: width }, (_, i) => wrapSlot(spot.slot + i, n));
    const hit = surfaceCells.map((s) => layout.surface[s]).find((id) => id);
    if (hit) return { ok: false, reason: `Overlaps ${nameOf(layout, hit)}`, cells: [], surfaceCells };
    return { ok: true, at: spot, cells: [], surfaceCells, planned: false };
  }

  if (def.size === "surface") return { ok: false, reason: `${def.name} goes on the surface`, ...none };
  const depths = depthsFor(type, cfg);
  const depth = spot.depth ?? depths[0]!;
  if (!depths.includes(depth)) return { ok: false, reason: `${def.name} can't be ${depth} rings deep`, ...none };
  if (spot.ring < 1 || spot.ring > hole.ringSlots.length) return { ok: false, reason: "Not a ring", ...none };
  const range = spanRange(hole, type, spot.ring, depth, cfg);
  const span = Math.round(spot.span ?? range.target);
  const at: Location = { kind: "ring", floor: spot.floor, ring: spot.ring, depth, start: wrapNotch(Math.round(spot.start), N), span };
  // The floor below the deepest dug one is being excavated and can be planned.
  // Tall rooms (stairs, elevators) reach down to floors that must already be dug.
  const height = def.floors ?? 1;
  const bottom = at.floor + height - 1;
  if (at.floor < 1 || at.floor > hole.floors + 1) return { ok: false, reason: "That floor isn't dug yet", ...none };
  if (height > 1 && bottom > hole.floors) {
    return { ok: false, reason: `The floor below (floor ${bottom}) isn't excavated yet`, ...none };
  }
  // A cargo elevator runs from the surface down to its stop, which must be below the entrance's floor, and dug.
  if (def.cargoShaft && at.floor < 2) return { ok: false, reason: "Its stop goes below floor 1: the entrance serves floor 1", ...none };
  if (def.cargoShaft && at.floor > hole.floors) return { ok: false, reason: "That floor isn't dug yet", ...none };
  if (span < 1 || span > N) return { ok: false, reason: "Too wide for this ring", ...none };

  // Tall rooms repeat their footprint on each floor they span; a cargo shaft on every floor above its stop too.
  const cells: Cell[] = [];
  const top = def.cargoShaft ? 1 : at.floor;
  for (let f = top; f <= bottom; f++) cells.push(...footprint(hole, f, at.ring, at.start, span, depth));
  const lastRing = at.ring + depth - 1;
  if (lastRing > hole.unlockedRings) {
    return { ok: false, reason: `Ring ${hole.unlockedRings + 1}+ needs reinforcement frames`, cells, surfaceCells: [] };
  }
  const sameSpot = (other: RoomInstance) => other.type === type && other.at.kind === "ring" && other.at.ring === at.ring && other.at.start === at.start && other.at.span === span && other.at.depth === depth;
  const merges = new Set<number>();
  let fresh = 0;
  for (const c of cells) {
    const others = piecesIn(layout, c).filter((p) => p.room);
    if (!others.length) {
      fresh++;
      continue;
    }
    for (const p of others) {
      const other = layout.rooms.find((r) => r.id === p.room)!;
      // Stairs and elevators chain: a piece may sit on an existing one of the same kind and join it.
      if (def.stacks && sameSpot(other)) {
        merges.add(other.id);
        continue;
      }
      const where = c.floor === at.floor ? "Overlaps" : c.floor < at.floor ? `Floor ${c.floor} above: its shaft overlaps` : `Floor ${c.floor} below: overlaps`;
      return { ok: false, reason: `${where} ${roomDef(other.type).name}`, cells, surfaceCells: [] };
    }
  }
  if (!fresh) return { ok: false, reason: `Already ${def.stackNoun ?? def.name.toLowerCase()} here`, cells, surfaceCells: [] };
  // A piece that meets a stack end to end (just above its top, or just below its bottom) joins it too.
  if (def.stacks) {
    for (const f of [at.floor - 1, bottom + 1]) {
      const r = f >= 1 ? roomAt(layout, cell(f, at.ring, at.start, span)) : undefined;
      if (r && sameSpot(r)) merges.add(r.id);
    }
  }
  // Its size: within its leeway of its target area (a fill room, much further). A piece joining a stack takes the stack's.
  if (!spot.fixed && !merges.size) {
    const area = Math.round(spanArea(hole.shaftRadiusM, at.ring, depth, 1, cfg.geometry) * (span < range.min ? range.min : range.max));
    if (span < range.min) return { ok: false, reason: `Too small: at least ${area} m²`, cells, surfaceCells: [] };
    if (span > range.max) return { ok: false, reason: def.fill && range.max >= Math.floor(cfg.placement.fill.maxTurn * N) ? "Too wide: at most a quarter of the way round" : `Too big: up to ${area} m²`, cells, surfaceCells: [] };
  }
  let note: string | undefined;
  if (merges.size) {
    const floors = [...cells, ...layout.rooms.filter((r) => merges.has(r.id)).flatMap((r) => r.cells)].map((c) => c.floor);
    const top = Math.min(...floors);
    const low = Math.max(...floors);
    if (def.maxFloors && low - top + 1 > def.maxFloors) {
      return { ok: false, reason: `${def.name} can span at most ${def.maxFloors} floors`, cells, surfaceCells: [] };
    }
    note = `Extend ${def.stackNoun ?? def.name.toLowerCase()} to cover floors ${top}–${low}`;
  }
  const rock = Math.round(areaOf(hole, rockCells(layout, cells)));
  if (def.excavationOnly && !rock) return { ok: false, reason: "Already dug out", cells, surfaceCells: [] };
  // Rooms can go anywhere; one no corridor reaches yet just won't work until one does.
  const unconnected = !def.public && !wouldConnect(layout, cells);
  // A room laid over corridors fills them in; say so, and what it would cut off.
  const destroys = corridorsInside(layout, cells);
  return {
    ok: true,
    at,
    cells,
    surfaceCells: [],
    planned: bottom > hole.floors,
    ...(unconnected ? { unconnected } : {}),
    ...(rock ? { rock } : {}),
    ...(merges.size ? { merges: [...merges].sort((a, b) => a - b), note } : {}),
    ...(destroys.length ? { destroys, strands: strandedBy(layout, destroys) } : {}),
  };
}

/** Join a new stair (or elevator) piece onto the stacks it touches: one room, spanning them all. */
function extendStack(layout: Layout, check: Extract<CheckResult, { ok: true }>): CheckResult & { id?: number; extended?: boolean; fresh?: Cell[] } {
  const [keep, ...others] = check.merges!.map((id) => layout.rooms.find((r) => r.id === id)!);
  const room = keep!;
  const key = (c: Cell) => `${c.floor}:${c.ring}`;
  const before = new Set([room, ...others].flatMap((r) => [...r!.cells, ...(r!.pendingCells ?? [])]).map(key));
  const fresh = check.cells.filter((c) => !before.has(key(c)));
  const cells = new Map(room.cells.map((c) => [key(c), c]));
  for (const other of others) {
    for (const c of other!.cells) cells.set(key(c), c);
    if (other!.pendingCells?.length) room.pendingCells = [...(room.pendingCells ?? []), ...other!.pendingCells];
  }
  for (const c of check.cells) cells.set(key(c), c);
  room.cells = [...cells.values()].sort((a, b) => a.floor - b.floor || a.ring - b.ring);
  room.units = unitsOf(layout.hole, [...room.cells, ...(room.pendingCells ?? [])]);
  if (room.at.kind === "ring") room.at = { ...room.at, floor: room.cells[0]!.floor };
  layout.rooms = layout.rooms.filter((r) => !others.includes(r));
  layout.version++;
  recomputeAccess(layout);
  return { ...check, id: room.id, extended: true, fresh };
}

function nameOf(layout: Layout, id: number): string {
  const r = layout.rooms.find((x) => x.id === id);
  return r ? roomDef(r.type).name : "another room";
}

export function placeRoom(layout: Layout, type: string, at: Spot, cfg: SimConfig = config): CheckResult & { id?: number; extended?: boolean; fresh?: Cell[] } {
  const check = checkPlacement(layout, type, at, cfg);
  if (!check.ok) return check;
  if (check.merges?.length) return extendStack(layout, check);
  const id = layout.nextRoomId++;
  const def = roomDef(type);
  layout.rooms.push({
    id,
    type,
    at: check.at,
    cells: check.cells,
    ...(check.cells.length ? { units: unitsOf(layout.hole, check.cells) } : {}),
    surfaceCells: check.surfaceCells,
    connected: true,
    planned: check.planned,
    priority: def.priority ?? cfg.economy.defaultPriority,
    ...(def.defaultCrop ? { crop: def.defaultCrop } : {}),
  });
  for (const s of check.surfaceCells) layout.surface[s] = id;
  layout.version++;
  recomputeAccess(layout);
  return { ...check, id };
}

export function demolishRoom(layout: Layout, id: number): { ok: true } | { ok: false; reason: string } {
  const room = layout.rooms.find((r) => r.id === id);
  if (!room) return { ok: false, reason: "No such room" };
  const def = roomDef(room.type);
  if (!def.buildable) return { ok: false, reason: `The ${def.name.toLowerCase()} can't be demolished` };
  // What was dug stays dug: the room's cells are empty space now (a blueprint's rock stays rock).
  for (const s of room.surfaceCells) layout.surface[s] = 0;
  layout.rooms = layout.rooms.filter((r) => r.id !== id);
  layout.version++;
  recomputeAccess(layout);
  return { ok: true };
}

export { recomputeAccess };
