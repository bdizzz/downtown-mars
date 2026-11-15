import sitesData from "../../data/sites.json";
import { degreesApart, features } from "./mapgeo";

// Site traits (#430): a hole founded after the first takes the trait of its
// place on the map (fixed by place, not rolled), easing one system and
// stressing another. The traits and where they're found live in
// data/sites.json; this module needs no elevation data, so the map screen
// can show a site's trait before it's founded.

export interface SiteTraitEffects {
  /** What a kind of room makes (and uses) here, as a multiple. */
  output?: Record<string, number>;
  /** Goods per slot dug, on top of any deposit's. */
  digYields?: Record<string, number>;
  /** Floor 1's resting temperature shifts by this, °C. */
  restC?: number;
  /** And its cap rises to this, °C. */
  restCapC?: number;
  /** Dust storms' chance per day, and how long they blow, as multiples. */
  stormChance?: number;
  stormLength?: number;
}

export interface SiteTrait {
  id: string;
  name: string;
  blurb: string;
  /** What it eases and what it stresses, in a line each, for the map and the hole. */
  eases: string;
  stresses: string;
  where: { absLatMin?: number; absLatMax?: number; near?: string; nearDeg?: number };
  effects: SiteTraitEffects;
}

export const SITE_TRAITS = sitesData.traits as unknown as SiteTrait[];

const byId = new Map(SITE_TRAITS.map((t) => [t.id, t]));

export function siteTrait(id: string | undefined | null): SiteTrait | undefined {
  return id ? byId.get(id) : undefined;
}

function matches(t: SiteTrait, site: { lat: number; lon: number }): boolean {
  const w = t.where;
  const a = Math.abs(site.lat);
  if (w.absLatMin !== undefined && a < w.absLatMin) return false;
  if (w.absLatMax !== undefined && a > w.absLatMax) return false;
  if (w.near && !features.some((f) => f.kind === w.near && degreesApart(f, site) <= (w.nearDeg ?? 0))) return false;
  return true;
}

/** The trait of a place on the map: the first in data/sites.json whose `where` matches, or none. */
export function traitAt(site: { lat: number; lon: number }): SiteTrait | undefined {
  return SITE_TRAITS.find((t) => matches(t, site));
}

/** A hole's trait, if it has one (the first hole never does). */
export function traitOf(state: { trait?: string }): SiteTrait | undefined {
  return siteTrait(state.trait);
}

/** What a kind of room makes here, as a multiple of normal (1 with no trait). */
export function traitOutput(state: { trait?: string }, roomType: string): number {
  return traitOf(state)?.effects.output?.[roomType] ?? 1;
}
