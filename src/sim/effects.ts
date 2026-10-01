import { overlappingSlots, ringSize, wrapSlot } from "./geometry";
import type { Cell, Layout, RoomInstance } from "./placement";
import { roomDef, type EffectDef, type EffectType } from "./rooms";
import { distancesFrom, pathsFor, STEP_M } from "./paths";
import { corridorBetween, corridors as corridorCfg } from "./corridors";
import { config } from "./config";

// Neighbor effects: every built room radiates its effects outward from its own
// cells, step by step along the ring, across rings (by angle) and between
// floors, fading linearly to nothing just past its radius. Sources add up.
// Corridors soak up noise and smell: they don't cross a border that's all corridor.
//
// Airborne effects (air quality, smell) ride the air instead: through the
// sealed network of corridors, tubes and stairs to the rooms along it, fading
// with every step (paths.ts), reaching `stepsPerRadius` steps per point of
// radius. They leak through walls only as far as `leak` (smell to the room
// next door; air quality not at all). Where a room gets one source both ways,
// the stronger counts. Air quality also has a baseline by ring: the further
// from the air trunk in the shaft wall, the staler.

export const FIELD_TYPES: EffectType[] = ["noise", "smell", "health", "comfort", "airQuality"];

/** How each effect reads in text ("air −1.2"). */
export const EFFECT_NAMES: Record<string, string> = { noise: "noise", smell: "smell", health: "health", comfort: "comfort", airQuality: "air" };
export const effectName = (t: string) => EFFECT_NAMES[t] ?? t;

/** field[type][floor - 1][ring - 1][slot] */
export type EffectField = Record<string, number[][][]>;

export interface Effects {
  version: number;
  /** How bad the dust through the airlocks is, as a multiple (1 in clear weather; more in a storm). */
  dust?: number;
  field: EffectField;
}

function emptyField(layout: Layout): EffectField {
  const field: EffectField = {};
  for (const t of FIELD_TYPES) field[t] = layout.grid.map((floor) => floor.map((ring) => ring.map(() => 0)));
  return field;
}

/** Cells one step away: along the ring, across rings by angle, and straight up and down. */
export function stepNeighbors(layout: Layout, c: Cell): Cell[] {
  const hole = layout.hole;
  const n = ringSize(hole, c.ring);
  const out: Cell[] = [
    { ...c, slot: wrapSlot(c.slot - 1, n) },
    { ...c, slot: wrapSlot(c.slot + 1, n) },
  ];
  for (const r of [c.ring - 1, c.ring + 1]) {
    if (r < 1 || r > hole.ringSlots.length) continue;
    for (const s of overlappingSlots(hole, c.ring, c.slot, r)) out.push({ floor: c.floor, ring: r, slot: s });
  }
  for (const f of [c.floor - 1, c.floor + 1]) {
    if (f >= 1 && f <= layout.grid.length) out.push({ ...c, floor: f });
  }
  return out;
}

/** Falloff: full strength at the source, dropping by 1/(radius+1) per step. */
export function falloff(strength: number, radius: number, distance: number): number {
  return distance > radius ? 0 : strength * (1 - distance / (radius + 1));
}

function blocks(layout: Layout, from: Cell, to: Cell, type: EffectType): boolean {
  return corridorCfg.blocksEffects.includes(type) && corridorBetween(layout, from, to);
}

const cellKey = (c: Cell) => `${c.floor}:${c.ring}:${c.slot}`;

/** One effect by nearness, out to `reach` steps: each cell it gets to, and how much. */
function nearness(layout: Layout, cells: Cell[], eff: EffectDef, reach: number): Map<string, [Cell, number]> {
  const out = new Map<string, [Cell, number]>();
  const seen = new Set(cells.map(cellKey));
  let frontier = cells;
  for (let d = 0; d <= reach && frontier.length; d++) {
    const next: Cell[] = [];
    for (const c of frontier) {
      out.set(cellKey(c), [c, falloff(eff.strength, eff.radius, d)]);
      for (const nb of stepNeighbors(layout, c)) {
        const k = cellKey(nb);
        if (seen.has(k)) continue;
        // A corridor between them soaks it up; it may still get there another way.
        if (blocks(layout, c, nb, eff.type)) continue;
        seen.add(k);
        next.push(nb);
      }
    }
    frontier = next;
  }
  return out;
}

function addTo(field: EffectField, type: string, got: Map<string, [Cell, number]>): void {
  const grid = field[type]!;
  for (const [c, v] of got.values()) grid[c.floor - 1]![c.ring - 1]![c.slot]! += v;
}

/** Everything a room radiates, by nearness only (the halo while placing, before it's on the network). */
function radiate(layout: Layout, field: EffectField, room: RoomInstance): void {
  for (const eff of roomDef(room.type).effects) {
    if (eff.residentsOnly || !field[eff.type]) continue;
    addTo(field, eff.type, nearness(layout, room.cells, eff, eff.radius));
  }
}

/** Everything a built room radiates: by nearness, and airborne effects along the network too. */
function radiateBuilt(layout: Layout, field: EffectField, room: RoomInstance, rooms: Map<number, RoomInstance>, dust: number): void {
  const fx = config.effects;
  const def = roomDef(room.type);
  for (const base of def.effects) {
    // An airlock lets in Mars dust: worse in a storm.
    const eff = def.surfaceLink && base.type === "airQuality" ? { ...base, strength: base.strength * dust } : base;
    if (eff.residentsOnly || !field[eff.type]) continue;
    const air = fx.airborne[eff.type];
    if (!air) {
      addTo(field, eff.type, nearness(layout, room.cells, eff, eff.radius));
      continue;
    }
    const got = nearness(layout, room.cells, eff, Math.min(eff.radius, air.leak));
    const reach = eff.radius * fx.stepsPerRadius;
    for (const [id, m] of distancesFrom(pathsFor(layout), room.id, "air", (reach + 1) * STEP_M)) {
      if (id === room.id) continue;
      const v = falloff(eff.strength, reach, m / STEP_M);
      if (!v) continue;
      for (const c of rooms.get(id)?.cells ?? []) {
        const k = cellKey(c);
        const had = got.get(k)?.[1] ?? 0;
        // The stronger way wins, not both.
        if (Math.abs(v) > Math.abs(had)) got.set(k, [c, v]);
      }
    }
    addTo(field, eff.type, got);
  }
}

/**
 * What a room would radiate if it were placed on these cells: the halo shown
 * while placing. Only this room's own effects, on an otherwise empty field, by
 * nearness (it isn't on the network until it's built).
 */
export function previewEffects(layout: Layout, type: string, cells: Cell[]): EffectField {
  const field = emptyField(layout);
  const ghost: RoomInstance = {
    id: -1,
    type,
    at: { kind: "ring", floor: cells[0]?.floor ?? 1, ring: cells[0]?.ring ?? 1, slot: cells[0]?.slot ?? 0, w: 1, d: 1 },
    cells,
    surfaceCells: [],
    connected: true,
    planned: false,
    priority: "normal",
  };
  radiate(layout, field, ghost);
  return field;
}

export function computeEffects(layout: Layout, dust = 1): EffectField {
  const field = emptyField(layout);
  // Air goes stale away from the shaft: each ring out starts a little worse, before any room's effect.
  const byRing = config.effects.airQualityByRing;
  // Under the dome the shaft is one big shared volume of air: fresher everywhere.
  const dome = layout.domed ? config.dome.air : 0;
  field.airQuality!.forEach((floor) => floor.forEach((ring, r) => ring.fill((byRing[r] ?? byRing.at(-1) ?? 0) + dome)));
  const rooms = new Map(layout.rooms.map((r) => [r.id, r]));
  for (const room of layout.rooms) {
    if (room.planned || room.building || room.at.kind !== "ring") continue;
    radiateBuilt(layout, field, room, rooms, dust);
  }
  return field;
}

/** Recompute only when the layout (or the dust through the airlocks) has changed since last time. */
export function refreshEffects(layout: Layout, cached: Effects | null, dust = cached?.dust ?? 1): Effects {
  if (cached && cached.version === layout.version && (cached.dust ?? 1) === dust) return cached;
  return { version: layout.version, dust, field: computeEffects(layout, dust) };
}

/** How bad the airlocks' dust is now: 1, rising to the storm factor as a dust storm blows (in quarter steps, so the field isn't rebuilt every tick). */
export function dustNow(storm: number): number {
  const f = config.effects.dust.stormFactor;
  return 1 + Math.round(storm * (f - 1) * 4) / 4;
}

export function effectAt(field: EffectField, type: string, c: Cell): number {
  return field[type]?.[c.floor - 1]?.[c.ring - 1]?.[c.slot] ?? 0;
}

/** Average of an effect over a room's cells, for the inspector and happiness. */
export function effectOnRoom(field: EffectField, type: string, room: RoomInstance): number {
  if (!room.cells.length) return 0;
  return room.cells.reduce((sum, c) => sum + effectAt(field, type, c), 0) / room.cells.length;
}
