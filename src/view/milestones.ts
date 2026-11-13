import { milestoneData, NETWORK_CHECKS, type MilestoneDef, type ReachedMilestone } from "../sim/milestones";
import type { Snapshot } from "../sim/snapshot";
import { monthLabel } from "./months";

// The milestones panel (Charts → Milestones, F-005 / T-056): what the hole has
// achieved and what's still ahead, by group, plus what the other holes have
// reached. Built here, out of React, so the Godot viewer can list it the same way.

export interface MilestoneRow {
  id: string;
  /** "The first harvest": the catalog's title, capitalised. */
  title: string;
  /** Reached: when ("Year 2, month 3", or "" for an older save's, day unknown). */
  when?: string;
  /** Ahead: how to get there ("" when the catalog doesn't say). */
  hint?: string;
  /** Ahead, for counted ones: how far along, as 73 of 100. */
  progress?: { value: number; at: number };
}

export interface MilestoneGroup {
  id: string;
  label: string;
  reached: MilestoneRow[];
  ahead: MilestoneRow[];
}

export interface NetworkMilestones {
  holeId: number;
  name: string;
  /** Reached, newest first. */
  reached: MilestoneRow[];
}

/** A network record (#413): "Deepest hole", "Bradbury, 14 floors". */
export interface MilestoneRecord {
  label: string;
  value: string;
}

export interface MilestonesView {
  reached: number;
  total: number;
  groups: MilestoneGroup[];
  /** The network's records: deepest hole, widest hole, holes capped. */
  records: MilestoneRecord[];
  /** The other holes, each with what it has reached (empty with only one hole). */
  network: NetworkMilestones[];
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function reachedRow(m: MilestoneDef, r: ReachedMilestone): MilestoneRow {
  return { id: m.id, title: capital(m.title), when: r.day === null ? "" : monthLabel(r.day) };
}

/** The panel, for the hole being looked at. */
export function milestonesView(s: Snapshot): MilestonesView {
  // The network's milestones (holes capped) count wherever they were reached.
  const isNetwork = (id: string) => NETWORK_CHECKS.includes(milestoneData.milestones.find((m) => m.id === id)?.check ?? "event");
  const own = s.milestones.filter((r) => !isNetwork(r.id));
  const shared = s.holes.flatMap((h) => h.milestones ?? []).filter((r) => isNetwork(r.id));
  const mine = [...own, ...shared.filter((r, i) => shared.findIndex((x) => x.id === r.id) === i)];
  const reached = new Map(mine.map((r) => [r.id, r]));
  const cappedCount = s.holes.filter((h) => h.capped).length;
  const groups = milestoneData.groups.map((g) => {
    const defs = milestoneData.milestones.filter((m) => m.group === g.id);
    return {
      id: g.id,
      label: g.label,
      // Earned in the order they were reached; what's ahead in the catalog's order.
      reached: mine.flatMap((r) => defs.filter((m) => m.id === r.id).map((m) => reachedRow(m, r))),
      ahead: defs
        .filter((m) => !reached.has(m.id))
        .map((m) => {
          const value = NETWORK_CHECKS.includes(m.check) ? cappedCount : s.milestoneProgress[m.id];
          return {
            id: m.id,
            title: capital(m.title),
            hint: m.hint ?? "",
            ...(value !== undefined && m.at !== undefined && m.at > 1 ? { progress: { value: Math.floor(value), at: m.at } } : {}),
          };
        }),
    };
  });
  const byId = new Map(milestoneData.milestones.map((m) => [m.id, m]));
  const network = s.holes
    .filter((h) => h.id !== s.holeId)
    .map((h) => ({
      holeId: h.id,
      name: h.name,
      reached: [...(h.milestones ?? [])].filter((r) => !isNetwork(r.id)).reverse().flatMap((r) => {
        const m = byId.get(r.id);
        return m ? [reachedRow(m, r)] : [];
      }),
    }));
  return {
    reached: mine.filter((r) => byId.has(r.id)).length,
    total: milestoneData.milestones.length,
    groups: groups.filter((g) => g.reached.length || g.ahead.length),
    records: records(s),
    network,
  };
}

/** The network's records (#413): the deepest hole, the widest, and how many are capped. */
export function records(s: Snapshot): MilestoneRecord[] {
  if (!s.holes.length) return [];
  const deepest = s.holes.reduce((a, b) => (b.floors > a.floors ? b : a));
  const capped = s.holes.filter((h) => h.capped);
  const out: MilestoneRecord[] = [{ label: "Deepest hole", value: `${deepest.name}, ${deepest.floors} ${deepest.floors === 1 ? "floor" : "floors"}${deepest.capped ? " (capped)" : ""}` }];
  // Every hole is the same width until holes come in sizes (#118); the record shows once one's wider.
  const widths = new Set(s.holes.map((h) => h.shaftRadiusM ?? 0));
  if (widths.size > 1) {
    const widest = s.holes.reduce((a, b) => ((b.shaftRadiusM ?? 0) > (a.shaftRadiusM ?? 0) ? b : a));
    out.push({ label: "Widest hole", value: `${widest.name}, ${Math.round((widest.shaftRadiusM ?? 0) * 2)} m across` });
  }
  out.push({ label: "Holes capped", value: capped.length ? `${capped.length}: ${capped.map((h) => `${h.name}, ${h.capped!.identity}`).join("; ")}` : "none yet" });
  return out;
}
