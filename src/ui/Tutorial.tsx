import { useEffect, useRef, useState } from "react";
import { findTarget, obstacle, place, sameAnchor, type Anchor } from "./anchor";
import type { Snapshot } from "../sim/snapshot";
import { Portrait } from "./Portrait";
import { pickGoal, shownGoal, tutorial, type TutorialStep } from "./tutorialGoals";
import { guided, guideStep } from "./guided";
import type { GuideState } from "../sim/state";

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
        <Portrait who={deputy} />
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

interface GuidedProps {
  s: Snapshot;
  guide: GuideState;
  /** Whether the step's check is met (it moves on by itself a moment later). */
  met: boolean;
  /** Paused on a step that has a check: its button carries on, slowly. */
  paused: boolean;
  /** The step's button: on from a step to read, or carry on after reading. */
  onButton: () => void;
  /** Leave the guided tutorial (or close it once it's over). */
  onLeave: () => void;
  /** What the step points at ("hud:speed", "room:galley"…): the card sits next to it, with an arrow. */
  highlight: string | null;
}

/** How often the card checks where its target is: things open, close and move under it. */
const ANCHOR_EVERY_MS = 250;

/**
 * The guided tutorial's card (F-007, T-083): one step at a time, in order. It sits next to what the
 * step is about, with an arrow to it (anchor.ts), or in the corner when there's nothing on screen to
 * point at.
 */
export function GuidedTutorial({ s, guide, met, paused, onButton, onLeave, highlight }: GuidedProps) {
  const [small, setSmall] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  useEffect(() => {
    if (small) return setAnchor(null);
    const measure = () => {
      const target = findTarget(highlight);
      const box = card.current?.getBoundingClientRect();
      const next = target && box ? place(target.getBoundingClientRect(), box, { width: window.innerWidth, height: window.innerHeight }, obstacle()) : null;
      setAnchor((prev) => (sameAnchor(prev, next) ? prev : next));
    };
    measure();
    const id = window.setInterval(measure, ANCHOR_EVERY_MS);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", measure);
    };
  }, [highlight, small, guide.step]);
  const deputy = s.notables[0];
  const name = deputy?.name ?? "your deputy";
  const fill = (t: string) => t.replaceAll("{name}", name);
  const step = guideStep(guide);
  const n = guided.steps.length;
  const done = Math.min(guide.step, n);

  if (small) {
    return (
      <button className="tutorial-pill" onClick={() => setSmall(false)}>
        Guide · {done}/{n}
      </button>
    );
  }

  const body = (
    <div ref={card} className={`tutorial guided${anchor ? " anchored" : ""}`} role="complementary" aria-label="Guided tutorial">
      <div className="who">
        <Portrait who={deputy} />
        <span>
          <strong>{name}</strong>
          <span className="k"> · deputy</span>
        </span>
        <button className="icon" onClick={() => setSmall(true)} aria-label="Minimize" title="Minimize">
          –
        </button>
      </div>
      {guide.step === 0 && <p>{fill(guided.intro)}</p>}
      {step ? (
        <>
          <p className="say">
            {met && <span className="tick">✓ </span>}
            {fill(step.text)}
          </p>
          <p className="k">{step.hint}</p>
          {(!step.check || paused) && (
            <button className="primary" onClick={onButton}>
              {(!step.check && step.button) || "Go on"}
            </button>
          )}
        </>
      ) : (
        <p className="say">{fill(guided.outro)}</p>
      )}
      <div className="steps">
        <div className="progress" aria-label={`${done} of ${n} steps done`}>
          {guided.steps.map((g, i) => (
            <span key={g.id} className={[i < guide.step && "done", i === guide.step && "now"].filter(Boolean).join(" ")} />
          ))}
        </div>
      </div>
      <button className="link" onClick={onLeave}>
        {step ? guided.leave : "Close"}
      </button>
    </div>
  );
  if (!anchor) return body;
  return (
    <div className={`guide-anchor ${anchor.below ? "below" : "above"}`} style={{ left: anchor.left, top: anchor.top }}>
      {body}
      <span className="guide-arrow" style={{ left: anchor.arrow }} aria-hidden="true" />
    </div>
  );
}
