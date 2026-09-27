import featureData from "../../data/mars-features.json";
import { network } from "./network";

// Map geometry that needs no elevation data: deposit types, named features,
// distances and what lies under a site. Split from map.ts so the UI can use
// it without pulling the elevation grid into the main bundle.

export type DepositKind = "ice" | "aquifer" | "ore" | "silica";
export const DEPOSIT_KINDS: DepositKind[] = ["ice", "aquifer", "ore", "silica"];

export interface Deposit {
  kind: DepositKind;
  lat: number;
  lon: number;
  radiusDeg: number;
}

export interface MarsFeature {
  name: string;
  lat: number;
  lon: number;
  kind: string;
}

export interface MapState {
  deposits: Deposit[];
}

export const features = featureData.features as MarsFeature[];

export const wrapLon = (lon: number) => ((lon % 360) + 360) % 360;

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * network.marsRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Angular distance in degrees, for "is this inside a deposit". */
export function degreesApart(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  return (distanceKm(a, b) / network.marsRadiusKm) * (180 / Math.PI);
}

export function depositsAt(map: MapState, site: { lat: number; lon: number }): DepositKind[] {
  const kinds = new Set<DepositKind>();
  for (const d of map.deposits) if (degreesApart(site, d) <= d.radiusDeg) kinds.add(d.kind);
  return DEPOSIT_KINDS.filter((k) => kinds.has(k));
}

export function nearestFeature(site: { lat: number; lon: number }): { feature: MarsFeature; km: number } {
  let best = { feature: features[0]!, km: Infinity };
  for (const f of features) {
    const km = distanceKm(site, f);
    if (km < best.km) best = { feature: f, km };
  }
  return best;
}
