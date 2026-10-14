import { config } from "../sim/config";
import { corridorWork } from "../sim/construction";
import { corridorCost, finishDef, shortfall } from "../sim/corridors";
import { edgeById, edgeLengthM } from "../sim/edges";
import { corridorRefitPlan, corridorRefitRefusal, liningById, MATERIALS, refitVerb, refitWords } from "../sim/materials";
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
  if (proposal.refit) return refitSummary(proposal.edges, layout, resources, proposal.refit);
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

/** Refitting a chain in a lining (T-142): the segments that can be (not the gallery, nor those in it already), their cost, work and salvage. */
function refitSummary(edges: string[], layout: Layout, resources: Record<string, number>, lining: string): ProposalSummary {
  const to = liningById(lining) ?? MATERIALS.walls[0]!;
  const plans = edges.flatMap((id) => {
    const plan = corridorRefitRefusal(layout, id, to) ? null : corridorRefitPlan(layout, id, to, config);
    return plan ? [{ id, plan }] : [];
  });
  const skipped = edges.length - plans.length;
  let length = 0;
  let work = 0;
  const cost: Record<string, number> = {};
  const salvage: Record<string, number> = {};
  for (const { id, plan } of plans) {
    length += edgeLengthM(layout.hole, edgeById(layout.hole, id)!, config.geometry.roomDepthM);
    work += plan.work;
    for (const [r, v] of Object.entries(plan.cost)) cost[r] = Math.round(((cost[r] ?? 0) + v) * 10) / 10;
    for (const [r, v] of Object.entries(plan.salvage)) salvage[r] = (salvage[r] ?? 0) + v;
  }
  const short = shortfall(resources, cost);
  // Salvage comes back in whole units, so it reads as such.
  const list = (c: Record<string, number>, whole = false) =>
    Object.entries(c)
      .map(([r, v]) => `${whole ? v : num(v)} ${resName(r).toLowerCase()}`)
      .join(", ");
  const n = plans.length;
  const costText = Object.keys(cost).length ? `Costs ${list(cost)}` : "Free";
  return {
    title: `${refitVerb(to)} corridors ${refitWords(to)}?`,
    size: `${n} ${n === 1 ? "segment" : "segments"} · ${Math.round(length)} m${skipped > 0 ? ` · ${skipped} skipped (in it already, under way, or glass)` : ""}`,
    work: n > 0 ? `About ${hoursText(work)} of construction work` : null,
    cost: n ? (short ?? `${costText}${Object.keys(salvage).length ? `; ${list(salvage, true)} salvaged` : ""}`) : "Nothing here to refit.",
    short: !!short,
    ok: n > 0 && !short,
    accept: refitVerb(to),
  };
}
