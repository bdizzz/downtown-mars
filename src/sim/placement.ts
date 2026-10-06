import { config, type Priority, type SimConfig } from "./config";
import { overlappingSlots, ringSize, wrapSlot, type Hole } from "./geometry";
import { corridorsInside, recomputeAccess, strandedBy, wouldConnect } from "./corridors";
import { isRoomType, roomDef } from "./rooms";
import { rockCells } from "./excavation";

// Where rooms can go. A ring room is anchored at its innermost ring and
// lowest slot, and spans w slots along that ring and d rings outward. Outer
// rings are wider, so a deep room takes every outer slot whose centre falls
// inside its angle range: the "wedge".

export interface Cell {
  floor: number;
  ring: number;
  slot: number;
}

export type Location =
  | { kind: "ring"; floor: number; ring: number; slot: number; w: number; d: number }
  | { kind: "surface"; slot: number };

export interface RoomInstance {
  id: number;
  type: string;
  at: Location;
  /** Ring cells covered (empty for surface rooms). */
  cells: Cell[];
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
  /** What a tank holds, of its kind's choices (rooms.json holds); absent means the first. */
  holds?: string;
  /** Committed but still in the construction queue: holds its slots, doesn't run. */
  building?: boolean;
  /** Stairs or an elevator reaching further: cells held for floors still being built. */
  pendingCells?: Cell[];
  /** Storage rooms: space per good, in units (none by default). */
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
}

export interface Layout {
  version: number;
  hole: Hole;
  rooms: RoomInstance[];
  /** grid[floor - 1][ring - 1][slot] = room id, or 0 if empty. */
  grid: number[][][];
  /** open[floor - 1][ring - 1][slot] = 1 once excavated (a room or empty space), 0 while solid rock. */
  open?: number[][][];
  /** Old saves (v14 and older): the shaft still links every floor, as it did before stairs mattered. */
  openShaft?: boolean;
  /** surface[slot] = room id, or 0 if empty. */
  surface: number[];
  nextRoomId: number;
  /** Corridors along the borders between cells: edge id (see edges.ts) → finish. */
  corridors: Record<string, string>;
  /** Which floors' galleries are reached from the surface (floorLinked[floor - 1]); recomputed with access. */
  floorLinked?: boolean[];
  /** Which corridors reach the surface; recomputed with access. */
  corridorLinked?: Record<string, boolean>;
  /** Corridors still in the construction queue: edge id → job id. */
  corridorsBuilding?: Record<string, number>;
  /** Corridors being filled in (still usable until the job's done): edge id → job id. */
  corridorsFilling?: Record<string, number>;
  /** Corridor segments with a sealed bulkhead: people pass, air doesn't (edge id → true). */
  bulkheads?: Record<string, true>;
  /** The shaft dome is built: the shaft is pressurized, every floor's gallery open walkway. */
  domed?: boolean;
}

export type CheckResult =
  | {
      ok: true;
      cells: Cell[];
      surfaceCells: number[];
      planned: boolean;
      /** No corridor reaches it yet: it can go here, but won't work until one does. */
      unconnected?: boolean;
      /** Stacking rooms: existing stairs (or elevators) this piece joins onto. */
      merges?: number[];
      /** What the placement does, when it isn't obvious ("Extend stairs to cover floors 1–3"). */
      note?: string;
      /** Cells still solid rock: they're excavated first. */
      rock?: number;
      /** Corridors inside the footprint that placing it would fill in, and what that would cut off. */
      destroys?: string[];
      strands?: { rooms: number[]; corridors: string[] };
    }
  | { ok: false; reason: string; cells: Cell[]; surfaceCells: number[] };

const EPS = 1e-9;

export function createLayout(hole: Hole, cfg: SimConfig = config): Layout {
  const layout: Layout = {
    version: 0,
    hole,
    rooms: [],
    grid: [],
    surface: new Array(cfg.geometry.surfaceSlots).fill(0),
    nextRoomId: 1,
    corridors: {},
  };
  ensureFloors(layout);
  return layout;
}

/** Grow the grid to cover every dug floor plus the one being dug. */
export function ensureFloors(layout: Layout): void {
  while (layout.grid.length < layout.hole.floors + 1) {
    layout.grid.push(layout.hole.ringSlots.map((n) => new Array(n).fill(0)));
  }
  layout.open ??= [];
  while (layout.open.length < layout.grid.length) layout.open.push(layout.hole.ringSlots.map((n) => new Array(n).fill(0)));
}

export function footprint(hole: Hole, floor: number, ring: number, slot: number, w: number, d: number): Cell[] {
  const n0 = ringSize(hole, ring);
  const cells: Cell[] = [];
  for (let i = 0; i < w; i++) cells.push({ floor, ring, slot: wrapSlot(slot + i, n0) });
  const a = wrapSlot(slot, n0) / n0;
  const b = a + w / n0;
  for (let r = ring + 1; r < ring + d && r <= hole.ringSlots.length; r++) {
    const m = ringSize(hole, r);
    const kStart = Math.ceil(a * m - 0.5 - EPS);
    const kEnd = Math.ceil(b * m - 0.5 - EPS);
    for (let k = kStart; k < kEnd; k++) cells.push({ floor, ring: r, slot: wrapSlot(k, m) });
  }
  return cells;
}

/** Cells sharing a side with the group: along the ring, or across rings by angle. */
export function neighborCells(hole: Hole, cells: Cell[]): Cell[] {
  const key = (c: Cell) => `${c.floor}:${c.ring}:${c.slot}`;
  const own = new Set(cells.map(key));
  const out = new Map<string, Cell>();
  const add = (c: Cell) => {
    const k = key(c);
    if (!own.has(k)) out.set(k, c);
  };
  for (const c of cells) {
    const n = ringSize(hole, c.ring);
    add({ ...c, slot: wrapSlot(c.slot - 1, n) });
    add({ ...c, slot: wrapSlot(c.slot + 1, n) });
    for (const r of [c.ring - 1, c.ring + 1]) {
      if (r < 1 || r > hole.ringSlots.length) continue;
      for (const s of overlappingSlots(hole, c.ring, c.slot, r)) add({ floor: c.floor, ring: r, slot: s });
    }
  }
  return [...out.values()];
}

export function roomAt(layout: Layout, c: Cell): RoomInstance | undefined {
  const id = layout.grid[c.floor - 1]?.[c.ring - 1]?.[c.slot];
  return id ? layout.rooms.find((r) => r.id === id) : undefined;
}

export function checkPlacement(layout: Layout, type: string, at: Location, cfg: SimConfig = config): CheckResult {
  const none = { cells: [], surfaceCells: [] };
  if (!isRoomType(type)) return { ok: false, reason: `Unknown room "${type}"`, ...none };
  const def = roomDef(type);
  const hole = layout.hole;

  if (at.kind === "surface") {
    if (def.size !== "surface") return { ok: false, reason: `${def.name} goes inside the hole`, ...none };
    const n = layout.surface.length;
    const width = def.surfaceSlots ?? 1;
    const surfaceCells = Array.from({ length: width }, (_, i) => wrapSlot(at.slot + i, n));
    const hit = surfaceCells.map((s) => layout.surface[s]).find((id) => id);
    if (hit) return { ok: false, reason: `Overlaps ${nameOf(layout, hit)}`, cells: [], surfaceCells };
    return { ok: true, cells: [], surfaceCells, planned: false };
  }

  if (def.size === "surface") return { ok: false, reason: `${def.name} goes on the surface`, ...none };
  const shapes = (cfg.shapes as Record<string, [number, number][]>)[def.size] ?? [];
  if (!shapes.some(([w, d]) => w === at.w && d === at.d)) {
    return { ok: false, reason: `${def.name} can't be ${at.w}×${at.d}`, ...none };
  }
  // The floor below the deepest dug one is being excavated and can be planned.
  // Tall rooms (stairs, elevators) reach down to floors that must already be dug.
  const height = def.floors ?? 1;
  const bottom = at.floor + height - 1;
  if (at.floor < 1 || at.floor > hole.floors + 1) return { ok: false, reason: "That floor isn't dug yet", ...none };
  if (height > 1 && bottom > hole.floors) {
    return { ok: false, reason: `The floor below (floor ${bottom}) isn't excavated yet`, ...none };
  }
  if (at.ring < 1) return { ok: false, reason: "Not a ring", ...none };
  // A cargo elevator runs from the surface down to its stop, which must be below the entrance's floor, and dug.
  if (def.cargoShaft && at.floor < 2) return { ok: false, reason: "Its stop goes below floor 1: the entrance serves floor 1", ...none };
  if (def.cargoShaft && at.floor > hole.floors) return { ok: false, reason: "That floor isn't dug yet", ...none };

  const lastRing = at.ring + at.d - 1;
  if (lastRing > hole.unlockedRings) {
    const cells = at.ring <= hole.ringSlots.length ? footprint(hole, at.floor, at.ring, at.slot, at.w, at.d) : [];
    return { ok: false, reason: `Ring ${hole.unlockedRings + 1}+ needs reinforcement frames`, cells, surfaceCells: [] };
  }
  if (at.w > ringSize(hole, at.ring)) return { ok: false, reason: "Too wide for this ring", ...none };

  // Tall rooms repeat their footprint on each floor they span; a cargo shaft on every floor above its stop too.
  const cells: Cell[] = [];
  const top = def.cargoShaft ? 1 : at.floor;
  for (let f = top; f <= bottom; f++) cells.push(...footprint(hole, f, at.ring, at.slot, at.w, at.d));
  const merges = new Set<number>();
  let fresh = 0;
  for (const c of cells) {
    const other = roomAt(layout, c);
    if (!other) {
      fresh++;
      continue;
    }
    // Stairs and elevators chain: a piece may sit on an existing one of the same kind and join it.
    if (def.stacks && other.type === type && other.at.kind === "ring" && other.at.ring === at.ring && other.at.slot === at.slot) {
      merges.add(other.id);
      continue;
    }
    const where = c.floor === at.floor ? "Overlaps" : c.floor < at.floor ? `Floor ${c.floor} above: its shaft overlaps` : `Floor ${c.floor} below: overlaps`;
    return { ok: false, reason: `${where} ${roomDef(other.type).name}`, cells, surfaceCells: [] };
  }
  if (!fresh) return { ok: false, reason: `Already ${def.stackNoun ?? def.name.toLowerCase()} here`, cells, surfaceCells: [] };
  // A piece that meets a stack end to end (just above its top, or just below its bottom) joins it too.
  if (def.stacks) {
    for (const f of [at.floor - 1, bottom + 1]) {
      const r = f >= 1 ? roomAt(layout, { floor: f, ring: at.ring, slot: at.slot }) : undefined;
      if (r && r.type === type) merges.add(r.id);
    }
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
  const rock = rockCells(layout, cells).length;
  if (def.excavationOnly && !rock) return { ok: false, reason: "Already dug out", cells, surfaceCells: [] };
  // Rooms can go anywhere; one no corridor reaches yet just won't work until one does.
  const unconnected = !def.public && !wouldConnect(layout, cells);
  // A room laid over corridors fills them in; say so, and what it would cut off.
  const destroys = corridorsInside(layout, cells);
  return {
    ok: true,
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
  const key = (c: Cell) => `${c.floor}:${c.ring}:${c.slot}`;
  const before = new Set([room, ...others].flatMap((r) => [...r!.cells, ...(r!.pendingCells ?? [])]).map(key));
  const fresh = check.cells.filter((c) => !before.has(key(c)));
  const cells = new Map(room.cells.map((c) => [key(c), c]));
  for (const other of others) {
    for (const c of other!.cells) cells.set(key(c), c);
    if (other!.pendingCells?.length) room.pendingCells = [...(room.pendingCells ?? []), ...other!.pendingCells];
  }
  for (const c of check.cells) cells.set(key(c), c);
  room.cells = [...cells.values()].sort((a, b) => a.floor - b.floor);
  if (room.at.kind === "ring") room.at = { ...room.at, floor: room.cells[0]!.floor };
  layout.rooms = layout.rooms.filter((r) => !others.includes(r));
  for (const c of room.cells) layout.grid[c.floor - 1]![c.ring - 1]![c.slot] = room.id;
  recomputeAccess(layout);
  layout.version++;
  return { ...check, id: room.id, extended: true, fresh };
}

function nameOf(layout: Layout, id: number): string {
  const r = layout.rooms.find((x) => x.id === id);
  return r ? roomDef(r.type).name : "another room";
}

export function placeRoom(layout: Layout, type: string, at: Location, cfg: SimConfig = config): CheckResult & { id?: number; extended?: boolean; fresh?: Cell[] } {
  const check = checkPlacement(layout, type, at, cfg);
  if (!check.ok) return check;
  if (check.merges?.length) return extendStack(layout, check);
  const id = layout.nextRoomId++;
  const def = roomDef(type);
  layout.rooms.push({
    id,
    type,
    at,
    cells: check.cells,
    surfaceCells: check.surfaceCells,
    connected: true,
    planned: check.planned,
    priority: def.priority ?? cfg.economy.defaultPriority,
    ...(def.defaultCrop ? { crop: def.defaultCrop } : {}),
    ...(def.defaultAllocation ? { allocation: { ...def.defaultAllocation } } : {}),
  });
  for (const c of check.cells) layout.grid[c.floor - 1]![c.ring - 1]![c.slot] = id;
  for (const s of check.surfaceCells) layout.surface[s] = id;
  recomputeAccess(layout);
  layout.version++;
  return { ...check, id };
}

export function demolishRoom(layout: Layout, id: number): { ok: true } | { ok: false; reason: string } {
  const room = layout.rooms.find((r) => r.id === id);
  if (!room) return { ok: false, reason: "No such room" };
  const def = roomDef(room.type);
  if (!def.buildable) return { ok: false, reason: `The ${def.name.toLowerCase()} can't be demolished` };
  // What was dug stays dug: the room's cells are empty space now (a blueprint's rock stays rock).
  for (const c of room.cells) layout.grid[c.floor - 1]![c.ring - 1]![c.slot] = 0;
  for (const s of room.surfaceCells) layout.surface[s] = 0;
  layout.rooms = layout.rooms.filter((r) => r.id !== id);
  recomputeAccess(layout);
  layout.version++;
  return { ok: true };
}

export { recomputeAccess };
