import { config } from "../sim/config";
import { corridorWork } from "../sim/construction";
import { corridorCost, finishDef, shortfall } from "../sim/corridors";
import { edgeById, edgeLengthM } from "../sim/edges";
import type { Layout } from "../sim/placement";
import { hoursText, num, resName } from "../ui/format";
import type { Proposal } from "./types";

// What the corridor confirm says about a snaked chain: how many segments, how long, the work and the
// cost, or what's short. Shared by the web's popup (ui/CorridorConfirm.tsx) and the Godot viewer's.

export interface ProposalSummary {
  title: string;
  /** "4 segments · 40 m · 1 already there". */
  size: string;
  /** "About 3 h of construction work", when carving. */
  work: string | null;
  /** The cost, or what's short, or that there's nothing new. */
  cost: string;
  /** The cost line is a warning (something's short). */
  short: boolean;
  ok: boolean;
  accept: string;
}

export function proposalSummary(proposal: Proposal, layout: Layout, resources: Record<string, number>, finish: string): ProposalSummary {
  // Drawing: only new segments cost (existing ones along the way are free). Filling in: each costs its own finish.
  const segments = proposal.edges.filter((id) => (proposal.erase ? !!layout.corridors[id] : !layout.corridors[id]));
  const riding = proposal.edges.length - segments.length;
  let length = 0;
  const cost: Record<string, number> = {};
  for (const id of segments) {
    const e = edgeById(layout.hole, id);
    if (!e) continue;
    length += edgeLengthM(layout.hole, e, config.geometry.roomDepthM);
    const f = proposal.erase ? layout.corridors[id]! : finish;
    for (const [r, v] of Object.entries(corridorCost(layout.hole, e, f, config))) cost[r] = (cost[r] ?? 0) + v;
  }
  const short = shortfall(resources, cost);
  const costText = Object.entries(cost)
    .map(([r, v]) => `${num(v)} ${resName(r).toLowerCase()}`)
    .join(", ");
  return {
    title: proposal.erase ? "Fill in corridors?" : `Carve ${finishDef(finish).name.toLowerCase()} corridors?`,
    size: `${segments.length} ${segments.length === 1 ? "segment" : "segments"} · ${Math.round(length)} m${riding > 0 && !proposal.erase ? ` · ${riding} already there` : ""}`,
    work: !proposal.erase && segments.length > 0 ? `About ${hoursText(corridorWork(layout, segments, config))} of construction work` : null,
    cost: segments.length ? (short ?? `Costs ${costText}${proposal.erase ? ", rebuilding the walls" : ""}`) : "Nothing new to carve.",
    short: !!short,
    ok: segments.length > 0 && !short,
    accept: proposal.erase ? "Fill in" : "Build",
  };
}
