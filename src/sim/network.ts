import raw from "../../data/network.json";

/** Network-wide settings from data/network.json. */
export const network = raw as unknown as {
  holeNames: string[];
  marsRadiusKm: number;
  deposits: Record<string, { count: number; radius: [number, number] }>;
  /** Colonists across all holes before the map opens up. */
  mapUnlockPopulation: number;
  /** How far a rover convoy travels in a game day. */
  roverKmPerDay: number;
  /** Before the map unlocks, deposits this close to a hole are known. */
  scoutRadiusDeg: number;
  firstSite: { minLat: number; maxLat: number; extraDepositRadiusDeg: number };
};
