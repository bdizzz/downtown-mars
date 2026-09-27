import raw from "../../data/rooms.json";

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
  blocksEffects?: EffectType[];
  effects: EffectDef[];
  cost: Record<string, number>;
  buildable: boolean;
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
