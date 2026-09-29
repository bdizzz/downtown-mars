import raw from "../../data/config.json";

export interface GeometryConfig {
  slotWidthM: number;
  roomDepthM: number;
  maxRings: number;
  /** Height of one floor, used by the 3D view. */
  floorHeightM: number;
    /** Rock between the top floor's ceiling and the surface, metres. */
    surfaceDepthM: number;
  /** Width of the walkway ledge ringing the shaft, used by the 3D view. */
  galleryWidthM: number;
  /**
   * Rings come in pairs that share a slot count: ring 2 has ring 1's, ring 4
   * ring 3's, ring 6 ring 5's. Fewer, simpler borders between them, at the
   * cost of larger slots in the even rings.
   */
  pairedRings?: boolean;
  /**
   * Each pair of rings has a whole multiple of the slots of the pair inside
   * it (the nearest one), so every border of an inner pair runs on outward and
   * borders meet in four-way crossings.
   */
  nestedPairs?: boolean;
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
    /** Rings of floor 1 already excavated at the start; the rest is rock. */
    openRings: number;
  };
  digging: {
    /** Ticks to dig floor 2; each deeper floor takes depthGrowth longer. */
    ticksForFirstFloor: number;
    depthGrowth: number;
    /** Rock yielded per slot dug out: the shaft's area by the drill, a room's cells by excavation. */
    rockPerSlot: number;
    /** Extra yield per slot when the hole sits on a deposit, e.g. ore → { ore: 0.4 }. */
    depositYieldsPerSlot: Record<string, Record<string, number>>;
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
    /** Complete days the flow diagram averages over. */
    ledgerDays: number;
    /** Slots a room of each size nominally covers; deep rooms covering more scale up. */
    nominalSlots: Record<string, number>;
  };
  weather: {
    /**
     * Dust storms: none before `earliestDay`; after that, each day a storm may
     * be forecast, `warningDays` ahead, lasting `lastsDays` (both [least, most]).
     * It builds and clears over `rampHours`. While it blows, the rooms in
     * `affects` (solar) make only `output` of what they would.
     */
    dustStorm: { earliestDay: number; chancePerDay: number; warningDays: [number, number]; lastsDays: [number, number]; rampHours: number; affects: string[]; output: number };
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
    /** Earth sends no colonists while the hole's health is below this. */
    colonistsNeedHealth: number;
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
  unlocks: {
    /** Colonists in a hole before it can build a cargo elevator. */
    cargoPopulation: number;
    /** Colonists in a hole before each tier of apartments (ROOMS.md, Housing). */
    homes: { basic: number; standard: number; luxury: number };
    /** Colonists in a hole before it can have a cleaning service. */
    cleaningPopulation: number;
  };
  landingKit: {
    surface: { room: string; slot: number }[];
    ring: { room: string; floor: number; ring: number; slot: number }[];
  };
}

// JSON imports widen tuples to arrays, so cast via unknown; tests check the values.
export const config: SimConfig = raw as unknown as SimConfig;
