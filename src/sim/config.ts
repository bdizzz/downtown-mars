import raw from "../../data/config.json";

export interface GeometryConfig {
  slotWidthM: number;
  roomDepthM: number;
  maxRings: number;
}

export type Priority = "critical" | "high" | "normal" | "low";

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
  colonists: {
    start: number;
    needsPerDay: Record<string, number>;
    makesPerDay: Record<string, number>;
    /** Health lost per day when a need goes entirely unmet (scaled by the shortfall). */
    healthLossPerDay: Record<string, number>;
    noSanitationHealthLossPerDay: number;
    co2DangerLevel: number;
    co2HealthLossPerDay: number;
    healthRecoveryPerDay: number;
  };
  economy: {
    priorities: Priority[];
    defaultPriority: Priority;
    /** Life support leaves this much CO2 in the air for farms. */
    co2ScrubFloor: number;
    demolishRefund: number;
    /** A room can be undone for a full refund this long after it was placed. */
    undoWindowTicks: number;
    rateSmoothingDays: number;
    /** Slots a room of each size nominally covers; deep rooms covering more scale up. */
    nominalSlots: Record<string, number>;
  };
  earth: {
    firstDropDay: number;
    intervalDays: number;
    /** Drops cover the food, water and O2 gap for the interval plus this many days. */
    coverBufferDays: number;
    /** Sent every drop regardless of need. */
    fixed: Record<string, number>;
    /** Upper limit; arrivals also need free beds. */
    colonistsPerDrop: number;
    delayChance: number;
    delayDays: number;
    /** How often a drop waiting for a working landing pad tries again. */
    retryDays: number;
    /** How long the lander is visible coming down before it lands. */
    descentDays: number;
  };
  happiness: {
    /** Happiness with every factor at 0. */
    base: number;
    /** Happiness points per unit of each factor (factors run −factorLimit..+factorLimit). */
    weights: Record<"noise" | "comfort" | "health", number>;
    factorLimit: number;
    /** Comfort for homes in ring 1, which look out over the shaft. */
    shaftViewComfort: number;
    homelessComfort: number;
    /** Health factor when no clinic covers anyone; scaled by the uncovered share. */
    noCareHealth: number;
    /** Roughly how long happiness takes to settle on its target. */
    easeDays: number;
    updateEveryTicks: number;
    /** Room output multiplier at 0 happiness, rising to 1 at productivityFullAt. */
    productivityAtZero: number;
    productivityFullAt: number;
  };
  messages: { keep: number };
  landingKit: {
    surface: { room: string; slot: number }[];
    ring: { room: string; floor: number; ring: number; slot: number }[];
  };
}

// JSON imports widen tuples to arrays, so cast via unknown; tests check the values.
export const config: SimConfig = raw as unknown as SimConfig;
