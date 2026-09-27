import { useState } from "react";
import type { Snapshot } from "../sim/snapshot";
import { CHECKS, tutorial, type Goal, type UiFlags } from "./tutorialGoals";

interface Props {
  s: Snapshot;
  flags: UiFlags;
  onHide: () => void;
}

/** The goal the deputy is talking about now: the first one not yet met, or null when all are. */
export function currentGoal(s: Snapshot, flags: UiFlags): Goal | null {
  return tutorial.goals.find((g) => !CHECKS[g.id]?.(s, flags)) ?? null;
}

export function Tutorial({ s, flags, onHide }: Props) {
  const [small, setSmall] = useState(false);
  const deputy = s.notables[0];
  const name = deputy?.name ?? "your deputy";
  const done = tutorial.goals.filter((g) => CHECKS[g.id]?.(s, flags)).length;
  const goal = currentGoal(s, flags);
  const fill = (t: string) => t.replaceAll("{name}", name);

  if (small) {
    return (
      <button className="tutorial-pill" onClick={() => setSmall(false)}>
        Tutorial · {done}/{tutorial.goals.length}
      </button>
    );
  }

  return (
    <div className="tutorial" role="complementary" aria-label="Tutorial">
      <div className="who">
        <span className="face">
          {name
            .split(" ")
            .map((p) => p[0])
            .join("")}
        </span>
        <span>
          <strong>{name}</strong>
          <span className="k"> · deputy</span>
        </span>
        <button className="icon" onClick={() => setSmall(true)} aria-label="Minimize" title="Minimize">
          –
        </button>
      </div>
      {done === 0 && <p>{fill(tutorial.intro)}</p>}
      {goal ? (
        <>
          <p className="say">{fill(goal.text)}</p>
          <p className="k">{goal.hint}</p>
        </>
      ) : (
        <p className="say">{fill(tutorial.outro)}</p>
      )}
      <div className="progress" aria-label={`${done} of ${tutorial.goals.length} goals done`}>
        {tutorial.goals.map((g) => (
          <span key={g.id} className={CHECKS[g.id]?.(s, flags) ? "done" : g === goal ? "now" : ""} title={g.text} />
        ))}
      </div>
      <button className="link" onClick={onHide}>
        {goal ? "Hide tutorial" : "Close"}
      </button>
    </div>
  );
}
