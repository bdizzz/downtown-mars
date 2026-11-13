import elevationData from "../../data/mars-elevation.json";
import { degreesApart, DEPOSIT_KINDS, depositsAt, mapColor, rgbHex, wrapLon, type Deposit, type DepositKind, type MapState } from "./mapgeo";
import { network } from "./network";

export * from "./mapgeo";

// The planet: MOLA elevation at 1° and each game's resource deposits.
// Deposits are placed with the world's seed, so every game differs, but they
// follow the terrain the way the real planet suggests: ice toward the poles
// and in northern lowlands, aquifers in deep basins, ore on volcanic and
// highland ground, silica along the highland–lowland boundary.

const elev = elevationData as { width: number; height: number; unitMeters: number; elevation: number[] };

/** Elevation in metres at a latitude and east longitude (nearest 1° cell). */
export function elevationAt(lat: number, lon: number): number {
  const y = Math.min(elev.height - 1, Math.max(0, Math.floor(90 - lat)));
  const x = Math.floor(wrapLon(lon)) % elev.width;
  return elev.elevation[y * elev.width + x]! * elev.unitMeters;
}

/** The map's colour at a site, unlit (#rrggbb): the soil the 3D ground leans toward there. */
export function soilAt(site: { lat: number; lon: number }): string {
  return rgbHex(mapColor(elevationAt(site.lat, site.lon), site.lat));
}

/** How likely each kind is at a place, from latitude and elevation. */
const SUITABILITY: Record<DepositKind, (lat: number, e: number) => number> = {
  // Poles, and the cold northern lowlands (Utopia, Arcadia) with ground ice.
  ice: (lat, e) => (Math.abs(lat) > 60 ? 1 : lat > 35 && e < -3000 ? 0.7 : 0),
  // Deep basins hold groundwater.
  aquifer: (lat, e) => (Math.abs(lat) < 60 && e < -4000 ? 1 : 0),
  // Volcanic provinces and old highlands.
  ore: (lat, e) => (Math.abs(lat) < 50 && e > 2500 ? 1 : Math.abs(lat) < 50 && e > 500 ? 0.35 : 0),
  // Sediments along the highland–lowland boundary and in crater deltas.
  silica: (lat, e) => (Math.abs(lat) < 40 && e > -3000 && e < 0 ? 1 : 0),
};

/** A small seeded generator, so the map is the same for the same world seed. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateMap(seed: number): MapState {
  const rand = rng(seed ^ 0x51f15eed);
  const deposits: Deposit[] = [];
  const cfg = network.deposits as Record<DepositKind, { count: number; radius: [number, number] }>;
  for (const kind of DEPOSIT_KINDS) {
    const { count, radius } = cfg[kind];
    let placed = 0;
    // Rejection sampling: pick random points, keep them in proportion to suitability.
    for (let tries = 0; placed < count && tries < 20000; tries++) {
      // Uniform over the sphere, not over the lat/lon rectangle.
      const lat = (Math.asin(2 * rand() - 1) * 180) / Math.PI;
      const lon = rand() * 360;
      if (rand() >= SUITABILITY[kind](lat, elevationAt(lat, lon))) continue;
      // Keep deposits of one kind from piling on top of each other.
      if (deposits.some((d) => d.kind === kind && degreesApart(d, { lat, lon }) < radius[1] * 2)) continue;
      deposits.push({ kind, lat, lon, radiusDeg: radius[0] + rand() * (radius[1] - radius[0]) });
      placed++;
    }
  }
  return { deposits };
}

/**
 * The first hole's site: at 20-25° north (#395), so its first floor always
 * rests at 40-45 °F, with ice underneath (water to survive) and ore or silica
 * (something to grow on, but not everything). Of a few spots along the band,
 * one on ore, else the lowest without silica; ice sits further north on
 * this map, so a small deposit of it, and of ore if there's none, is added,
 * and the design's "survives alone, can't grow alone" always holds. (Ore is
 * rare this far south; a silica start is a later hole's.)
 */
export function chooseFirstSite(map: MapState, seed: number): { lat: number; lon: number } {
  const rand = rng(seed ^ 0xf1257);
  const fs = network.firstSite;
  // Of a few spots along the band: one on ore if there is one (metal to build with), else the
  // lowest without silica, where ore is planted.
  let site = { lat: (fs.minLat + fs.maxLat) / 2, lon: 185 };
  let best = -Infinity;
  for (let i = 0; i < fs.tries; i++) {
    const spot = { lat: fs.minLat + rand() * (fs.maxLat - fs.minLat), lon: rand() * 360 };
    const here = depositsAt(map, spot);
    const score = (here.includes("ore") ? 2e5 : here.includes("silica") ? 0 : 1e5) - elevationAt(spot.lat, spot.lon);
    if (score > best) {
      best = score;
      site = spot;
    }
  }
  const under = depositsAt(map, site);
  if (!under.includes("ice")) map.deposits.push({ kind: "ice", ...site, radiusDeg: fs.extraDepositRadiusDeg });
  if (!under.includes("ore") && !under.includes("silica")) {
    map.deposits.push({ kind: "ore", ...site, radiusDeg: fs.extraDepositRadiusDeg });
  }
  return site;
}
