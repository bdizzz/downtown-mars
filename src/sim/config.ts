import raw from "../../data/config.json";

export interface GeometryConfig {
  slotWidthM: number;
  roomDepthM: number;
  maxRings: number;
}

export interface SimConfig {
  ticksPerDay: number;
  startHour: number;
  ticksPerSecondAt1x: number;
  speeds: number[];
  snapshotsPerSecond: number;
  maxTicksPerFrame: number;
  seed: number;
  geometry: GeometryConfig & { surfaceSlots: number };
  /** Allowed [wide, deep] shapes per room size. */
  shapes: Partial<Record<"S" | "M" | "L" | "H", [number, number][]>>;
  starterHole: {
    shaftRadiusM: number;
    floors: number;
    unlockedRings: number;
  };
  digging: {
    /** Ticks to dig floor 2; each deeper floor takes depthGrowth longer. */
    ticksForFirstFloor: number;
    depthGrowth: number;
    /** Rock yielded per unlocked ring slot dug out. */
    rockPerSlot: number;
    maxFloors: number;
  };
  startingStock: Record<string, number>;
  landingKit: {
    surface: { room: string; slot: number }[];
    ring: { room: string; floor: number; ring: number; slot: number }[];
  };
}

// JSON imports widen tuples to arrays, so cast via unknown; tests check the values.
export const config: SimConfig = raw as unknown as SimConfig;
