import { milestoneData, type MilestoneDef, type ReachedMilestone } from "../sim/milestones";
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

export interface MilestonesView {
  reached: number;
  total: number;
  groups: MilestoneGroup[];
  /** The other holes, each with what it has reached (empty with only one hole). */
  network: NetworkMilestones[];
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function reachedRow(m: MilestoneDef, r: ReachedMilestone): MilestoneRow {
  return { id: m.id, title: capital(m.title), when: r.day === null ? "" : monthLabel(r.day) };
}

/** The panel, for the hole being looked at. */
export function milestonesView(s: Snapshot): MilestonesView {
  const reached = new Map(s.milestones.map((r) => [r.id, r]));
  const groups = milestoneData.groups.map((g) => {
    const defs = milestoneData.milestones.filter((m) => m.group === g.id);
    return {
      id: g.id,
      label: g.label,
      // Earned in the order they were reached; what's ahead in the catalog's order.
      reached: s.milestones.flatMap((r) => defs.filter((m) => m.id === r.id).map((m) => reachedRow(m, r))),
      ahead: defs
        .filter((m) => !reached.has(m.id))
        .map((m) => {
          const value = s.milestoneProgress[m.id];
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
      reached: [...(h.milestones ?? [])].reverse().flatMap((r) => {
        const m = byId.get(r.id);
        return m ? [reachedRow(m, r)] : [];
      }),
    }));
  return {
    reached: s.milestones.filter((r) => byId.has(r.id)).length,
    total: milestoneData.milestones.length,
    groups: groups.filter((g) => g.reached.length || g.ahead.length),
    network,
  };
}
