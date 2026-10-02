import { degreesApart, depositsAt, distanceKm, nearestFeature, wrapLon, type DepositKind } from "../sim/mapgeo";
import { network } from "../sim/network";
import type { RouteView, Snapshot } from "../sim/snapshot";
import { num } from "../ui/format";

// The network as the map and the network panel show it, shared by the web (ui/MapScreen.tsx,
// ui/NetworkPanel.tsx) and the Godot viewer (src/bridge/network.ts): deposits' look, each hole's
// colour, what a route is doing, and what a site offers and whether a hole can be founded there.

export const DEPOSIT_STYLE: Record<DepositKind, { name: string; color: string; hint: string }> = {
  ice: { name: "Ice", color: "#d6ecff", hint: "Water ice: mine it for water" },
  aquifer: { name: "Aquifer", color: "#3f8fff", hint: "Groundwater: a deep well pump draws it" },
  ore: { name: "Ore", color: "#c7a3a3", hint: "Metal ore: a smelter turns it into metal" },
  silica: { name: "Silica", color: "#f0d46a", hint: "Silica: the start of silicon and electronics" },
};

const HOLE_COLORS = ["#e07a3f", "#6fb3c9", "#b48ad8", "#9bc46a", "#e0c050"];
/** A hole's colour in the network panel and on the map, by its place in the list. */
export const holeColor = (s: Pick<Snapshot, "holes">, id: number) => HOLE_COLORS[s.holes.findIndex((h) => h.id === id) % HOLE_COLORS.length]!;

/** What a trade route is doing, in words. */
export function phaseText(r: RouteView): string {
  if (r.idle) return "parked: no free rover";
  if (r.loadFactor === 0) return "they refuse to load: relations are hostile";
  if (r.phase === "loading") return "waiting for a load";
  const left = Math.max(0, r.legDays * (1 - r.progress));
  const eta = left < 0.05 ? "arriving" : `${left.toFixed(1)} d`;
  return r.phase === "outbound" ? `carrying ${num(r.cargo)} · ${eta}` : `driving back · ${eta}`;
}

export type Elevation = { width: number; height: number; unitMeters: number; elevation: number[] };

/** The ground's height at a place, metres. */
export function elevationAt(e: Elevation, lat: number, lon: number): number {
  return e.elevation[Math.min(e.height - 1, Math.floor(90 - lat)) * e.width + (Math.floor(wrapLon(lon)) % e.width)]! * e.unitMeters;
}

export const fmtLat = (lat: number) => `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}`;

export interface SiteReport {
  where: string;
  near: string;
  /** Scouted: near a hole, or the map is open. */
  known: boolean;
  deposits: DepositKind[];
  distances: string[];
  checks: [boolean, string][];
  ready: boolean;
}

/** A site: where it is, what's in the ground, how far from each hole, and what founding a hole there still needs. */
export function siteReport(s: Snapshot, site: { lat: number; lon: number }, elevation: Elevation | null): SiteReport {
  const kit = network.seedKit;
  const pop = s.holes.find((h) => h.id === s.holeId)?.population ?? 0;
  const taken = [...s.holes.flatMap((h) => (h.site ? [h.site] : [])), ...s.convoys.map((c) => c.to)];
  const checks: [boolean, string][] = [
    [s.mapUnlocked, `The map is open (at ${network.mapUnlockPopulation} colonists)`],
    [s.kit.hasBay, `${s.holeName} has a staging bay`],
    [s.kit.progress >= 0.999, `Seed kit gathered (${Math.floor(s.kit.progress * 100)}%${s.kit.progress < 0.999 && !s.kit.gathering ? ": ask the staging bay to gather" : ""})`],
    [pop - kit.volunteers >= kit.minStayBehind, `${kit.volunteers} volunteers, keeping ${kit.minStayBehind} (${pop} now)`],
    [!taken.some((t) => degreesApart(t, site) < kit.minSpacingDeg), "Far enough from other holes"],
  ];
  const near = nearestFeature(site);
  const e = elevation ? elevationAt(elevation, site.lat, site.lon) : null;
  return {
    where: `${fmtLat(site.lat)} ${wrapLon(site.lon).toFixed(1)}°E${e !== null ? ` · ${Math.round(e).toLocaleString()} m` : ""}`,
    near: near.km < 600 ? `At ${near.feature.name}` : `${Math.round(near.km).toLocaleString()} km from ${near.feature.name}`,
    known: s.mapUnlocked || s.holes.some((h) => h.site && degreesApart(h.site, site) <= network.scoutRadiusDeg),
    deposits: depositsAt({ deposits: s.deposits }, site),
    distances: s.holes
      .filter((h) => h.site)
      .map((h) => {
        const km = distanceKm(h.site!, site);
        return `${h.name}: ${Math.round(km).toLocaleString()} km · ${(km / network.roverKmPerDay).toFixed(1)} days by rover`;
      }),
    checks,
    ready: checks.every(([ok]) => ok),
  };
}
