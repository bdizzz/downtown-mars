import raw from "../../data/network.json";

/** Network-wide settings from data/network.json. */
export const network = raw as unknown as {
  holeNames: string[];
  marsRadiusKm: number;
  deposits: Record<string, { count: number; radius: [number, number] }>;
};
