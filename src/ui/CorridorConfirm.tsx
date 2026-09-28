import { useEffect } from "react";
import { config } from "../sim/config";
import { corridorCost, finishDef, shortfall } from "../sim/corridors";
import { edgeById, edgeLengthM } from "../sim/edges";
import type { Layout } from "../sim/placement";
import type { Proposal } from "../view/types";
import { num, resName } from "./format";

// Asks before carving (or filling in) a snaked chain of corridors: how many
// segments, how long, and what it costs.

interface Props {
  proposal: Proposal;
  layout: Layout;
  resources: Record<string, number>;
  finish: string;
  onAccept: () => void;
  onCancel: () => void;
}

export function CorridorConfirm({ proposal, layout, resources, finish, onAccept, onCancel }: Props) {
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
  const ok = segments.length > 0 && !short;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && ok) {
        e.preventDefault();
        e.stopImmediatePropagation();
        onAccept();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation(); // the popup's Escape, not the game's
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [ok, onAccept, onCancel]);

  const costText = Object.entries(cost)
    .map(([r, v]) => `${num(v)} ${resName(r).toLowerCase()}`)
    .join(", ");
  return (
    <div className="corridor-confirm" role="dialog" aria-label="Confirm corridors">
      <h3>{proposal.erase ? "Fill in corridors?" : `Carve ${finishDef(finish).name.toLowerCase()} corridors?`}</h3>
      <p>
        {segments.length} {segments.length === 1 ? "segment" : "segments"} · {Math.round(length)} m
        {riding > 0 && !proposal.erase ? ` · ${riding} already there` : ""}
      </p>
      <p className={short ? "warn" : ""}>{segments.length ? (short ?? `Costs ${costText}${proposal.erase ? ", rebuilding the walls" : ""}`) : "Nothing new to carve."}</p>
      <div className="buttons">
        <button className="primary" disabled={!ok} onClick={onAccept}>
          {proposal.erase ? "Fill in" : "Build"} <kbd>↵</kbd>
        </button>
        <button onClick={onCancel}>
          Cancel <kbd>Esc</kbd>
        </button>
      </div>
    </div>
  );
}
