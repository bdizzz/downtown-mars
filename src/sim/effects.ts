import { overlappingSlots, ringSize, wrapSlot } from "./geometry";
import type { Cell, Layout, RoomInstance } from "./placement";
import { roomDef, type EffectType } from "./rooms";
import { corridorBetween, corridors as corridorCfg } from "./corridors";
import { config } from "./config";

// Neighbor effects: every built room radiates its effects outward from its own
// cells, step by step along the ring, across rings (by angle) and between
// floors, fading linearly to nothing just past its radius. Sources add up.
// Corridors soak up noise and smell: they don't cross a border that's all corridor.
// Air quality also has a baseline by ring: the further from the shaft, the staler.

export const FIELD_TYPES: EffectType[] = ["noise", "smell", "health", "comfort", "airQuality"];

/** How each effect reads in text ("air −1.2"). */
export const EFFECT_NAMES: Record<string, string> = { noise: "noise", smell: "smell", health: "health", comfort: "comfort", airQuality: "air" };
export const effectName = (t: string) => EFFECT_NAMES[t] ?? t;

/** field[type][floor - 1][ring - 1][slot] */
export type EffectField = Record<string, number[][][]>;

export interface Effects {
  version: number;
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

function radiate(layout: Layout, field: EffectField, room: RoomInstance): void {
  const def = roomDef(room.type);
  for (const eff of def.effects) {
    if (eff.residentsOnly || !field[eff.type]) continue;
    const grid = field[eff.type]!;
    const key = (c: Cell) => `${c.floor}:${c.ring}:${c.slot}`;
    const seen = new Set(room.cells.map(key));
    let frontier = room.cells;
    for (let d = 0; d <= eff.radius && frontier.length; d++) {
      const next: Cell[] = [];
      for (const c of frontier) {
        grid[c.floor - 1]![c.ring - 1]![c.slot]! += falloff(eff.strength, eff.radius, d);
        for (const nb of stepNeighbors(layout, c)) {
          const k = key(nb);
          if (seen.has(k)) continue;
          // A corridor between them soaks it up; it may still get there another way.
          if (blocks(layout, c, nb, eff.type)) continue;
          seen.add(k);
          next.push(nb);
        }
      }
      frontier = next;
    }
  }
}

/**
 * What a room would radiate if it were placed on these cells: the halo shown
 * while placing. Only this room's own effects, on an otherwise empty field.
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

export function computeEffects(layout: Layout): EffectField {
  const field = emptyField(layout);
  // Air goes stale away from the shaft: each ring out starts a little worse, before any room's effect.
  const byRing = config.effects.airQualityByRing;
  field.airQuality!.forEach((floor) => floor.forEach((ring, r) => ring.fill(byRing[r] ?? byRing.at(-1) ?? 0)));
  for (const room of layout.rooms) {
    if (room.planned || room.building || room.at.kind !== "ring") continue;
    radiate(layout, field, room);
  }
  return field;
}

/** Recompute only when the layout has changed since last time. */
export function refreshEffects(layout: Layout, cached: Effects | null): Effects {
  if (cached && cached.version === layout.version) return cached;
  return { version: layout.version, field: computeEffects(layout) };
}

export function effectAt(field: EffectField, type: string, c: Cell): number {
  return field[type]?.[c.floor - 1]?.[c.ring - 1]?.[c.slot] ?? 0;
}

/** Average of an effect over a room's cells, for the inspector and happiness. */
export function effectOnRoom(field: EffectField, type: string, room: RoomInstance): number {
  if (!room.cells.length) return 0;
  return room.cells.reduce((sum, c) => sum + effectAt(field, type, c), 0) / room.cells.length;
}
