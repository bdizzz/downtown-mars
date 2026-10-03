import { useEffect } from "react";
import type { Layout } from "../sim/placement";
import type { Proposal } from "../view/types";
import { proposalSummary } from "../view/corridorProposal";

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
  const p = proposalSummary(proposal, layout, resources, finish);
  const ok = p.ok;

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

  return (
    <div className="corridor-confirm" role="dialog" aria-label="Confirm corridors">
      <h3>{p.title}</h3>
      <p>{p.size}</p>
      {p.work && <p className="k">{p.work}</p>}
      <p className={p.short ? "warn" : ""}>{p.cost}</p>
      <div className="buttons">
        <button className="primary" disabled={!ok} onClick={onAccept}>
          {p.accept} <kbd>↵</kbd>
        </button>
        <button onClick={onCancel}>
          Cancel <kbd>Esc</kbd>
        </button>
      </div>
    </div>
  );
}
