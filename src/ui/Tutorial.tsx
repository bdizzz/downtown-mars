import { useState } from "react";
import type { Snapshot } from "../sim/snapshot";
import { pickGoal, shownGoal, tutorial, type TutorialStep } from "./tutorialGoals";

interface Props {
  s: Snapshot;
  /** Which goals are met (metGoals), and the step the card is on (App keeps it, for the highlight). */
  met: boolean[];
  step: TutorialStep;
  onStep: (step: TutorialStep) => void;
  onHide: () => void;
}

export function Tutorial({ s, met, step, onStep, onHide }: Props) {
  const [small, setSmall] = useState(false);
  const deputy = s.notables[0];
  const name = deputy?.name ?? "your deputy";
  const done = met.filter(Boolean).length;
  const at = shownGoal(step, met);
  const goal = at >= 0 ? tutorial.goals[at]! : null;
  const go = (i: number) => onStep(pickGoal(i, met));
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
          <p className="say">
            {met[at] && <span className="tick">✓ </span>}
            {fill(goal.text)}
          </p>
          <p className="k">{goal.hint}</p>
        </>
      ) : (
        <p className="say">{fill(tutorial.outro)}</p>
      )}
      <div className="steps">
        {goal && (
          <button className="icon" onClick={() => go(at - 1)} aria-label="Previous step" title="Previous step">
            ‹
          </button>
        )}
        <div className="progress" aria-label={`${done} of ${tutorial.goals.length} goals done`}>
          {tutorial.goals.map((g, i) => (
            <button
              key={g.id}
              className={[met[i] && "done", i === at && "now"].filter(Boolean).join(" ")}
              title={fill(g.text)}
              aria-label={`Step ${i + 1}${met[i] ? ", done" : ""}`}
              onClick={() => go(i)}
            />
          ))}
        </div>
        {goal && (
          <button className="icon" onClick={() => go(at + 1)} aria-label="Next step" title="Next step">
            ›
          </button>
        )}
      </div>
      <button className="link" onClick={onHide}>
        {goal ? "Hide tutorial" : "Close"}
      </button>
    </div>
  );
}
