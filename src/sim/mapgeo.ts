import featureData from "../../data/mars-features.json";
import mapData from "../../data/mars-map.json";
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

type RGB = [number, number, number];
const RAMP = mapData.ramp.stops as unknown as [number, RGB][];
const CAPS = mapData.caps as unknown as { north: number; south: number; fade: number; color: RGB };

/** Whether a place is on a polar cap, where holes can't be dug (where the map starts whitening them). */
export const onIceCap = (site: { lat: number }) => site.lat >= CAPS.north || site.lat <= -CAPS.south;

/** Why a hole can't go here: the polar caps. */
export const ICE_CAP_REFUSAL = "Ice cap: can't dig here";

/**
 * The map's colour at a place (sRGB, 0..255), as scripts/build-relief.mjs draws it but without its
 * lighting: by elevation (metres), whitened toward the polar caps.
 */
export function mapColor(elevationM: number, lat: number): RGB {
  let c: RGB = RAMP[RAMP.length - 1]![1];
  for (let i = 1; i < RAMP.length; i++) {
    const [e1, c1] = RAMP[i]!;
    const [e0, c0] = RAMP[i - 1]!;
    if (elevationM <= e1) {
      const t = Math.max(0, (elevationM - e0) / (e1 - e0));
      c = [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
      break;
    }
  }
  const cap = Math.min(1, Math.max(0, (Math.abs(lat) - (lat > 0 ? CAPS.north : CAPS.south)) / CAPS.fade));
  return c.map((v, i) => Math.round(v + (CAPS.color[i]! - v) * cap)) as RGB;
}

export const rgbHex = (c: RGB) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
