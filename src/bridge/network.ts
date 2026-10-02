import elevationData from "../../data/mars-elevation.json";
import { culture } from "../sim/culture";
import { network } from "../sim/network";
import { resourceDef } from "../sim/resources";
import type { Snapshot } from "../sim/snapshot";
import { num } from "../ui/format";
import { DEPOSIT_STYLE, holeColor, phaseText, siteReport, type Elevation } from "../view/network";

// The network for the Godot viewer, by the web's rules (view/network.ts; laid out as ui/MapScreen.tsx
// and ui/NetworkPanel.tsx): what the map shows, the network panel, and a site's report.

const elevation = elevationData as unknown as Elevation;
const STEPS = [10, 20, 40, 80];
type Place = { lat: number; lon: number };

export interface MapMessage {
  type: "map";
  holeId: number;
  locked: string | null;
  legend: { kind: string; name: string; color: string; hint: string }[];
  deposits: { kind: string; lat: number; lon: number; radiusDeg: number; color: string }[];
  holes: { id: number; name: string; lat: number; lon: number; color: string; here: boolean }[];
  convoys: { from: Place | null; to: Place; progress: number; label: string }[];
  routes: { from: Place; to: Place; at: number | null; outbound: boolean }[];
  migrations: { from: Place; to: Place; at: number }[];
}

export function mapView(s: Snapshot): MapMessage {
  const siteOf = (id: number) => s.holes.find((h) => h.id === id)?.site ?? null;
  const pop = s.holes.reduce((n, h) => n + h.population, 0);
  return {
    type: "map",
    holeId: s.holeId,
    locked: s.mapUnlocked ? null : `Only the ground near your holes is known yet. The map opens at ${network.mapUnlockPopulation} colonists (you have ${pop}).`,
    legend: Object.entries(DEPOSIT_STYLE).map(([kind, d]) => ({ kind, name: d.name, color: d.color, hint: d.hint })),
    deposits: s.deposits.map((d) => ({ kind: d.kind, lat: d.lat, lon: d.lon, radiusDeg: d.radiusDeg, color: DEPOSIT_STYLE[d.kind].color })),
    holes: s.holes.flatMap((h) => (h.site ? [{ id: h.id, name: h.name, lat: h.site.lat, lon: h.site.lon, color: holeColor(s, h.id), here: h.id === s.holeId }] : [])),
    convoys: s.convoys.map((c) => ({ from: c.from, to: c.to, progress: Math.min(1, Math.max(0, c.progress)), label: `${c.name} · ${c.daysLeft.toFixed(1)} d` })),
    routes: s.routes.flatMap((r) => {
      const a = siteOf(r.fromHoleId);
      const b = siteOf(r.toHoleId);
      if (!a || !b) return [];
      const moving = !r.idle && r.phase !== "loading";
      return [{ from: a, to: b, at: moving ? (r.phase === "outbound" ? r.progress : 1 - r.progress) : null, outbound: r.phase === "outbound" }];
    }),
    migrations: s.migrations.flatMap((m) => {
      const a = siteOf(m.from);
      const b = siteOf(m.to);
      return a && b ? [{ from: a, to: b, at: Math.min(1, Math.max(0, m.progress)) }] : [];
    }),
  };
}

export interface SiteMessage {
  type: "site";
  lat: number;
  lon: number;
  where: string;
  near: string;
  ground: { name: string; color: string; text: string }[] | null;
  distances: string[];
  checks: { ok: boolean; text: string }[];
  ready: boolean;
  button: string;
}

export function siteView(s: Snapshot, site: Place): SiteMessage {
  const r = siteReport(s, site, elevation);
  return {
    type: "site",
    ...site,
    where: r.where,
    near: r.near,
    ground: r.known ? r.deposits.map((k) => ({ name: DEPOSIT_STYLE[k].name, color: DEPOSIT_STYLE[k].color, text: DEPOSIT_STYLE[k].hint.split(": ")[1] ?? "" })) : null,
    distances: r.distances,
    checks: r.checks.map(([ok, text]) => ({ ok, text })),
    ready: r.ready,
    button: `Send a convoy from ${s.holeName}`,
  };
}

export interface NetworkMessage {
  type: "network";
  holes: { name: string; color: string; here: boolean; people: number; rovers: string }[];
  axes: { left: string; right: string; holes: { color: string; now: number; target: number; title: string }[] }[];
  opinions: { text: string; opinion: number; tier: string }[];
  moving: string[];
  routes: { id: number; title: string; detail: string; idle: boolean; trip: number | null; outbound: boolean }[];
  form: {
    fromId: number;
    from: string;
    busy: string;
    targets: { id: number; name: string }[];
    resources: { id: string; name: string }[];
    steps: number[];
    hint: string | null;
  };
}

export function networkView(s: Snapshot): NetworkMessage {
  const name = (id: number) => s.holes.find((h) => h.id === id)?.name ?? "?";
  const here = s.holes.find((h) => h.id === s.holeId);
  const others = s.holes.filter((h) => h.id !== s.holeId);
  const used = s.routes.filter((r) => r.fromHoleId === s.holeId).length;
  return {
    type: "network",
    holes: s.holes.map((h) => ({
      name: `${h.name}${h.domed ? " ◓" : ""}`,
      color: holeColor(s, h.id),
      here: h.id === s.holeId,
      people: h.population,
      rovers: `${s.routes.filter((r) => r.fromHoleId === h.id && !r.idle).length}/${h.rovers}`,
    })),
    axes: culture.axes.map((a) => ({
      left: a.left,
      right: a.right,
      holes: s.holes.map((h) => ({
        color: holeColor(s, h.id),
        now: h.culture[a.id] ?? 0,
        target: h.cultureTarget[a.id] ?? 0,
        title: `${h.name}: ${a.left} ${Math.round(((1 - (h.culture[a.id] ?? 0)) / 2) * 100)}% · ${a.right} ${Math.round(((1 + (h.culture[a.id] ?? 0)) / 2) * 100)}%`,
      })),
    })),
    opinions: s.relations.map((r) => ({ text: `${name(r.from)} of ${name(r.to)}`, opinion: r.opinion, tier: `${r.opinion >= 0 ? "+" : "−"}${Math.abs(Math.round(r.opinion))} ${r.tier}` })),
    moving: s.migrations.map((m) => `${m.count} ${m.count === 1 ? "colonist" : "colonists"} moving from ${name(m.from)} to ${name(m.to)} · ${Math.max(0, m.daysLeft).toFixed(1)} d`),
    routes: s.routes.map((r) => ({
      id: r.id,
      title: `${name(r.fromHoleId)} → ${name(r.toHoleId)}: ${num(r.amountPerTrip)} ${resourceDef(r.resource).name.toLowerCase()} a trip`,
      detail: `${phaseText(r)} · ${r.legDays.toFixed(1)} d each way${r.loadFactor > 0 && Math.abs(r.loadFactor - 1) >= 0.01 ? ` · loads ${r.loadFactor > 1 ? "+" : "−"}${Math.round(Math.abs(r.loadFactor - 1) * 100)}%` : ""}`,
      idle: r.idle,
      trip: r.phase === "loading" ? null : r.phase === "outbound" ? r.progress : 1 - r.progress,
      outbound: r.phase === "outbound",
    })),
    form: {
      fromId: s.holeId,
      from: s.holeName,
      busy: `${used}/${here?.rovers ?? 0} rovers busy`,
      targets: others.map((h) => ({ id: h.id, name: h.name })),
      resources: here ? Object.keys(here.stock).map((r) => ({ id: r, name: `${resourceDef(r).name} (${num(here.stock[r] ?? 0)})` })) : [],
      steps: STEPS,
      hint: others.length === 0 ? "Found a second hole to trade with (Map, M)." : (here?.rovers ?? 0) === 0 ? "Build a rover depot on the surface first: each holds 2 rovers." : null,
    },
  };
}
