import { config, type Priority, type SimConfig } from "./config";
import { overlappingSlots, ringSize, wrapSlot, type Hole } from "./geometry";
import { recomputeAccess, wouldConnect } from "./corridors";
import { isRoomType, roomDef } from "./rooms";

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
  /** Reachable from the shaft gallery. Surface rooms always are. */
  connected: boolean;
  /** A blueprint on the floor still being dug; switches on when it's done. */
  planned: boolean;
  /** Who gets workers and inputs first during a shortage. */
  priority: Priority;
  /** Farms only. */
  crop?: string;
  /** Switched off by the player: no staff, no inputs, no output. */
  paused?: boolean;
  /** Idle (and release its staff) while its main output is at or above this stock. */
  stopAt?: number;
  /** When it was placed, for undo. Absent for the landing kit and old saves. */
  builtTick?: number;
}

export interface Layout {
  version: number;
  hole: Hole;
  rooms: RoomInstance[];
  /** grid[floor - 1][ring - 1][slot] = room id, or 0 if empty. */
  grid: number[][][];
  /** surface[slot] = room id, or 0 if empty. */
  surface: number[];
  nextRoomId: number;
  /** Corridors along the borders between cells: edge id (see edges.ts) → finish. */
  corridors: Record<string, string>;
  /** Which corridors reach the shaft; recomputed with access. */
  corridorLinked?: Record<string, boolean>;
}

export type CheckResult =
  | { ok: true; cells: Cell[]; surfaceCells: number[]; planned: boolean; /** No corridor reaches it yet: it can go here, but won't work until one does. */ unconnected?: boolean }
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
  const height = def.floors ?? 1;
  const bottom = at.floor + height - 1;
  if (at.floor < 1 || bottom > hole.floors + 1) {
    return { ok: false, reason: height > 1 ? `${def.name} spans ${height} floors: the lower one isn't dug yet` : "That floor isn't dug yet", ...none };
  }
  if (at.ring < 1) return { ok: false, reason: "Not a ring", ...none };

  const lastRing = at.ring + at.d - 1;
  if (lastRing > hole.unlockedRings) {
    const cells = at.ring <= hole.ringSlots.length ? footprint(hole, at.floor, at.ring, at.slot, at.w, at.d) : [];
    return { ok: false, reason: `Ring ${hole.unlockedRings + 1}+ needs reinforcement frames`, cells, surfaceCells: [] };
  }
  if (at.w > ringSize(hole, at.ring)) return { ok: false, reason: "Too wide for this ring", ...none };

  // Tall rooms repeat their footprint on each floor they span.
  const cells: Cell[] = [];
  for (let f = at.floor; f <= bottom; f++) cells.push(...footprint(hole, f, at.ring, at.slot, at.w, at.d));
  for (const c of cells) {
    const other = roomAt(layout, c);
    if (other) return { ok: false, reason: `Overlaps ${roomDef(other.type).name}`, cells, surfaceCells: [] };
  }
  // Rooms can go anywhere; one no corridor reaches yet just won't work until one does.
  const unconnected = !def.public && !wouldConnect(layout, cells);
  return { ok: true, cells, surfaceCells: [], planned: bottom > hole.floors, ...(unconnected ? { unconnected } : {}) };
}

function nameOf(layout: Layout, id: number): string {
  const r = layout.rooms.find((x) => x.id === id);
  return r ? roomDef(r.type).name : "another room";
}

export function placeRoom(layout: Layout, type: string, at: Location, cfg: SimConfig = config): CheckResult & { id?: number } {
  const check = checkPlacement(layout, type, at, cfg);
  if (!check.ok) return check;
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
  for (const c of room.cells) layout.grid[c.floor - 1]![c.ring - 1]![c.slot] = 0;
  for (const s of room.surfaceCells) layout.surface[s] = 0;
  layout.rooms = layout.rooms.filter((r) => r.id !== id);
  recomputeAccess(layout);
  layout.version++;
  return { ok: true };
}

export { recomputeAccess };
