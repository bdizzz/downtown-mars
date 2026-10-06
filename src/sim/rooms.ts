import raw from "../../data/rooms.json";

import type { DepositKind } from "./mapgeo";

/** Rooms that unlock when a hole reaches a size (config unlocks.rooms). */
export type RoomUnlock = "brickworks" | "leisure" | "recycling" | "hospital";

export type RoomSize = "S" | "M" | "L" | "H" | "surface";
export type EffectType = "noise" | "smell" | "health" | "comfort" | "airQuality" | "heat" | "safety";

export interface EffectDef {
  type: EffectType;
  strength: number;
  radius: number;
  residentsOnly?: boolean;
}

export interface RoomDef {
  id: string;
  name: string;
  short: string;
  category: string;
  size: RoomSize;
  surfaceSlots?: number;
  staff: number;
  uses: Record<string, number>;
  makes: Record<string, number>;
  stores?: Record<string, number>;
  houses?: number;
  effects: EffectDef[];
  cost: Record<string, number>;
  buildable: boolean;
  /** Inputs that can stand in when the main one runs out, used in order. */
  substitutes?: Record<string, string[]>;
  /** Removed from the air, above a reserve left for farms. */
  scrubs?: Record<string, number>;
  /**
   * The air it makes (O2) stops at the air's target: it fills the air, never past it.
   * Its inputs other than power are spent only on the O2 it makes, so scrubbing at
   * the target costs power alone.
   */
  topsUpAir?: boolean;
  /** Colonists served by restrooms. */
  sanitation?: number;
  /** Share of users' water returned as each kind of wastewater. */
  returnsWater?: Record<string, number>;
  growsCrops?: boolean;
  defaultCrop?: string;
  priority?: "critical" | "high" | "normal" | "low";
  ordinanceSlots?: number;
  /** Colonists a clinic can look after. */
  cares?: number;
  /** Diners it seats: galleys and canteens. Kitchens cook but seat no one. */
  serves?: number;
  /** How far on foot (steps) its service reaches homes: seats, care, school places. */
  reach?: number;
  /** A place to go: comfort and/or health for the homes within `reach` steps on foot, fading with distance (amenities.ts). */
  amenity?: { comfort?: number; health?: number; reach: number };
  /** Only buildable in a hole that sits on this deposit. */
  requiresDeposit?: DepositKind;
  /** Gathers the seed kit for founding a new hole. */
  stagesSeedKit?: boolean;
  /** Children it teaches. */
  teaches?: number;
  /** The dead it can hold, for good. */
  rests?: number;
  /** Elders it looks after. */
  caresForElders?: number;
  /** Not buildable until the hole has reached this (see UNLOCKS in costs.ts). */
  unlockedBy?: "children" | "elders" | "cargo" | "basicHomes" | "standardHomes" | "luxuryHomes" | "cleaning" | RoomUnlock;
  /** A service room that repairs other rooms' condition: any room, or only the people-heavy (cleanable) ones. */
  maintains?: "all" | "cleanable";
  /** Units of storage for dry goods (data/storage.json). */
  storage?: number;
  /** How its storage starts out allocated (the landing pod); otherwise empty. */
  defaultAllocation?: Record<string, number>;
  /** Work-hours to build it; otherwise its size's hours (data/construction.json). */
  buildHours?: number;
  /** Construction bandwidth it adds at full staff (construction offices). */
  constructionBandwidth?: number;
  /** Floors tall, counting down from the floor it's placed on (default 1). */
  floors?: number;
  /** Pieces chain: a new one placed on the bottom of an existing one extends it (stairs, elevators). */
  stacks?: boolean;
  /** How the hover names it when extending ("stairs", "the elevator"). */
  stackNoun?: string;
  /** The most floors one stack may span. */
  maxFloors?: number;
  /** Opens onto the surface: how people and goods get in and out (the entrance, a cargo elevator's stop). */
  surfaceLink?: boolean;
  /** A shaft from the surface down to the floor it's placed on: it stops only there, and every floor above must be clear. */
  cargoShaft?: boolean;
  /** Only digs out rock: when the job's done, the room is gone and its cells are empty space. */
  excavationOnly?: boolean;
  /** Walk-through: every side counts as a corridor, so neighbours open onto it. */
  public?: boolean;
  /** Moves people between floors in a car: people ride it, air doesn't (elevators). */
  lift?: boolean;
  /** A working one lets colonists have children. */
  enablesBirths?: boolean;
  /** Rovers this room provides for trade routes. */
  rovers?: number;
}

// JSON imports widen literal types, so the shape is checked in tests/rooms.test.ts.
export const roomDefs: RoomDef[] = raw.rooms as unknown as RoomDef[];

const byId = new Map(roomDefs.map((r) => [r.id, r]));

export function roomDef(id: string): RoomDef {
  const def = byId.get(id);
  if (!def) throw new Error(`unknown room type "${id}"`);
  return def;
}

export function isRoomType(id: string): boolean {
  return byId.has(id);
}
